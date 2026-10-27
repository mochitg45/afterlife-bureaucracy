import { getBackend } from './firebase';
import { playReferral, CODE_ALPHABET, REFERRAL_TIMEOUT_MS } from './referral';
import { clerkName, type BoardView } from './lifetimeBoard';
import { ALLIANCE_MAX, MEMBER_WEEK_CAP, allianceName, allianceWeek } from '../engine/alliance';

/** This player's alliance as last read. `stamps` is this week's total (0 if nobody stamped yet). */
export interface AllianceView {
  id: string;
  name: string;
  /** The 6-letter invite code; readable by members only. */
  code: string | null;
  size: number;
  week: number;
  stamps: number;
}

export type JoinOutcome = AllianceView | 'notfound' | 'full' | null;

/** One flush: how many pending stamps it used up, and the alliance's new week total. */
export interface Contribution {
  consumed: number;
  stamps: number;
}

/**
 * Office Alliance in Firestore (schema and rules: firestore.rules, "Office Alliance").
 * Every method resolves; none throws. Null means "unreachable".
 */
export interface AllianceService {
  /** Android only, like the other Firestore features (App Check needs Play Integrity). */
  available(): boolean;
  mine(): Promise<AllianceView | 'none' | null>;
  joinRandom(name: string): Promise<AllianceView | null>;
  create(name: string): Promise<AllianceView | null>;
  joinByCode(code: string, name: string): Promise<JoinOutcome>;
  leave(): Promise<boolean>;
  contribute(stamps: number, name: string): Promise<Contribution | null>;
  /** Members with this week's stamps; `rank` is this player's place among them. */
  members(): Promise<BoardView | null>;
  /** Top alliances by this week's stamps. */
  ranking(): Promise<BoardView | null>;
}

/** Most stamps one flush may add; firestore.rules enforces the same bound. */
export const FLUSH_CAP = 300;
export const RANKING_SIZE = 20;
/** `rank` = week * RANK_WEEK + weekStamps, so one descending query lists this week's leaders. */
const RANK_WEEK = 1_000_000;

export function withTimeout<T>(p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), REFERRAL_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

function newAllianceCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

const fail = (code: string) => Object.assign(new Error(code), { code });
const thisWeek = () => allianceWeek(Date.now());
const weekStamps = (d: { week?: unknown; weekStamps?: unknown } | undefined, week: number) =>
  d && d.week === week && typeof d.weekStamps === 'number' ? d.weekStamps : 0;

async function fs() {
  const { db, uid } = await getBackend();
  return { db, uid, f: await import('firebase/firestore') };
}

async function readView(id: string): Promise<AllianceView | null> {
  const { db, f } = await fs();
  const [a, secret] = await Promise.all([f.getDoc(f.doc(db, 'alliances', id)), f.getDoc(f.doc(db, 'alliances', id, 'secret', 'code'))]);
  if (!a.exists()) return null;
  const d = a.data();
  const week = thisWeek();
  return {
    id,
    name: String(d.name ?? ''),
    code: secret.exists() ? String(secret.data().code ?? '') || null : null,
    size: Number(d.size ?? 0),
    week,
    stamps: weekStamps(d, week),
  };
}

/** Joins `id` in one transaction; throws 'notfound' / 'full' / 'already'. */
async function join(id: string, name: string): Promise<AllianceView> {
  const { db, uid, f } = await fs();
  const nm = (name || clerkName(uid)).slice(0, 24);
  await f.runTransaction(db, async (tx) => {
    const player = await tx.get(f.doc(db, 'players', uid));
    if (player.exists() && player.data().allianceId) throw fail('already');
    const aRef = f.doc(db, 'alliances', id);
    const a = await tx.get(aRef);
    if (!a.exists()) throw fail('notfound');
    const size = Number(a.data().size ?? 0);
    if (size >= ALLIANCE_MAX) throw fail('full');
    tx.update(aRef, { size: size + 1, lastActive: f.serverTimestamp() });
    tx.set(f.doc(db, 'alliances', id, 'members', uid), { name: nm, week: thisWeek(), stamps: 0, at: f.serverTimestamp() });
    tx.set(f.doc(db, 'players', uid), { allianceId: id });
  });
  return (await readView(id)) ?? Promise.reject(fail('notfound'));
}

async function createAlliance(name: string): Promise<AllianceView> {
  const { db, uid, f } = await fs();
  const nm = (name || clerkName(uid)).slice(0, 24);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newAllianceCode();
    const id = f.doc(f.collection(db, 'alliances')).id;
    const week = thisWeek();
    try {
      await f.runTransaction(db, async (tx) => {
        const player = await tx.get(f.doc(db, 'players', uid));
        if (player.exists() && player.data().allianceId) throw fail('already');
        if ((await tx.get(f.doc(db, 'allianceCodes', code))).exists()) throw fail('taken');
        const now = f.serverTimestamp();
        tx.set(f.doc(db, 'alliances', id), { name: allianceName(), size: 1, week, weekStamps: 0, rank: week * RANK_WEEK, lastActive: now, createdAt: now });
        tx.set(f.doc(db, 'alliances', id, 'secret', 'code'), { code });
        tx.set(f.doc(db, 'allianceCodes', code), { id });
        tx.set(f.doc(db, 'alliances', id, 'members', uid), { name: nm, week, stamps: 0, at: now });
        tx.set(f.doc(db, 'players', uid), { allianceId: id });
      });
      return (await readView(id)) ?? Promise.reject(fail('notfound'));
    } catch (e) {
      if ((e as { code?: string }).code !== 'taken') throw e;
    }
  }
  throw fail('no free code');
}

export const firestoreAlliance: AllianceService = {
  available: () => playReferral.available(),

  async mine() {
    try {
      return await withTimeout((async () => {
        const { db, uid, f } = await fs();
        const p = await f.getDoc(f.doc(db, 'players', uid));
        const id = p.exists() ? (p.data().allianceId as unknown) : null;
        if (typeof id !== 'string' || !id) return 'none' as const;
        return (await readView(id)) ?? ('none' as const);
      })());
    } catch {
      return null;
    }
  },

  async joinRandom(name) {
    try {
      return await withTimeout((async () => {
        const { db, f } = await fs();
        const snap = await f.getDocs(f.query(f.collection(db, 'alliances'), f.orderBy('lastActive', 'desc'), f.limit(25)));
        // Most recently active first; empty (abandoned) alliances are skipped.
        for (const d of snap.docs) {
          const size = Number(d.data().size ?? 0);
          if (size < 1 || size >= ALLIANCE_MAX) continue;
          try {
            return await join(d.id, name);
          } catch (e) {
            if ((e as { code?: string }).code === 'already') throw e;
            // Filled up since the query, or contended: try the next one.
          }
        }
        return await createAlliance(name);
      })());
    } catch {
      return null;
    }
  },

  async create(name) {
    try {
      return await withTimeout(createAlliance(name));
    } catch {
      return null;
    }
  },

  async joinByCode(code, name) {
    try {
      return await withTimeout((async () => {
        const { db, f } = await fs();
        const c = await f.getDoc(f.doc(db, 'allianceCodes', code));
        const id = c.exists() ? (c.data().id as unknown) : null;
        if (typeof id !== 'string') return 'notfound' as const;
        try {
          return await join(id, name);
        } catch (e) {
          const k = (e as { code?: string }).code;
          if (k === 'notfound' || k === 'full') return k;
          throw e;
        }
      })());
    } catch {
      return null;
    }
  },

  async leave() {
    try {
      await withTimeout((async () => {
        const { db, uid, f } = await fs();
        await f.runTransaction(db, async (tx) => {
          const pRef = f.doc(db, 'players', uid);
          const p = await tx.get(pRef);
          const id = p.exists() ? (p.data().allianceId as unknown) : null;
          if (typeof id !== 'string' || !id) return;
          const aRef = f.doc(db, 'alliances', id);
          const a = await tx.get(aRef);
          if (a.exists()) {
            tx.update(aRef, { size: Math.max(0, Number(a.data().size ?? 1) - 1) });
            tx.delete(f.doc(db, 'alliances', id, 'members', uid));
          }
          tx.set(pRef, { allianceId: null });
        });
      })());
      return true;
    } catch {
      return false;
    }
  },

  async contribute(stamps, name) {
    if (!(stamps > 0)) return null;
    try {
      return await withTimeout((async () => {
        const { db, uid, f } = await fs();
        const p = await f.getDoc(f.doc(db, 'players', uid));
        const id = p.exists() ? (p.data().allianceId as unknown) : null;
        if (typeof id !== 'string' || !id) return null;
        const week = thisWeek();
        return await f.runTransaction(db, async (tx) => {
          const aRef = f.doc(db, 'alliances', id);
          const mRef = f.doc(db, 'alliances', id, 'members', uid);
          const [a, m] = await Promise.all([tx.get(aRef), tx.get(mRef)]);
          if (!a.exists() || !m.exists()) throw fail('gone');
          const md = m.data();
          const mBase = md.week === week ? Number(md.stamps ?? 0) : 0;
          const consumed = Math.min(stamps, FLUSH_CAP);
          // Past the weekly cap a member's stamps no longer count; they are used up all the same.
          const add = Math.min(consumed, MEMBER_WEEK_CAP - mBase);
          const aBase = weekStamps(a.data(), week);
          if (add <= 0) return { consumed, stamps: aBase };
          const now = f.serverTimestamp();
          tx.update(mRef, { name: (name || clerkName(uid)).slice(0, 24), week, stamps: mBase + add, at: now });
          tx.update(aRef, { week, weekStamps: aBase + add, rank: week * RANK_WEEK + aBase + add, lastActive: now });
          return { consumed, stamps: aBase + add };
        });
      })());
    } catch {
      return null;
    }
  },

  async members() {
    try {
      return await withTimeout((async () => {
        const { db, uid, f } = await fs();
        const p = await f.getDoc(f.doc(db, 'players', uid));
        const id = p.exists() ? (p.data().allianceId as unknown) : null;
        if (typeof id !== 'string' || !id) return null;
        const week = thisWeek();
        const snap = await f.getDocs(f.collection(db, 'alliances', id, 'members'));
        const rows = snap.docs
          .map((d) => ({ name: String(d.data().name ?? clerkName(d.id)), n: d.data().week === week ? Number(d.data().stamps ?? 0) : 0, me: d.id === uid }))
          .sort((a, b) => b.n - a.n);
        const at = rows.findIndex((r) => r.me);
        return { top: rows.map((r) => ({ name: r.name, souls: String(r.n), me: r.me })), rank: at < 0 ? null : at + 1, total: rows.length };
      })());
    } catch {
      return null;
    }
  },

  async ranking() {
    try {
      return await withTimeout((async () => {
        const { db, uid, f } = await fs();
        const week = thisWeek();
        const col = f.collection(db, 'alliances');
        const thisWeekQ = f.query(col, f.where('rank', '>=', week * RANK_WEEK));
        const [snap, total, p] = await Promise.all([
          f.getDocs(f.query(thisWeekQ, f.orderBy('rank', 'desc'), f.limit(RANKING_SIZE))),
          f.getCountFromServer(thisWeekQ),
          f.getDoc(f.doc(db, 'players', uid)),
        ]);
        const myId = p.exists() ? (p.data().allianceId as unknown) : null;
        const top = snap.docs.map((d) => ({ name: String(d.data().name ?? ''), souls: String(weekStamps(d.data(), week)), me: d.id === myId }));
        let rank: number | null = null;
        const at = top.findIndex((r) => r.me);
        if (at >= 0) rank = at + 1;
        else if (typeof myId === 'string' && myId) {
          const mine = await f.getDoc(f.doc(db, 'alliances', myId));
          const r = mine.exists() ? Number(mine.data().rank ?? 0) : 0;
          if (r >= week * RANK_WEEK) rank = (await f.getCountFromServer(f.query(col, f.where('rank', '>', r)))).data().count + 1;
        }
        return { top, rank, total: total.data().count };
      })());
    } catch {
      return null;
    }
  },
};

/** Web, iOS and tests by default: no alliances. */
export const noopAlliance: AllianceService = {
  available: () => false,
  mine: async () => null,
  joinRandom: async () => null,
  create: async () => null,
  joinByCode: async () => null,
  leave: async () => false,
  contribute: async () => null,
  members: async () => null,
  ranking: async () => null,
};

export function pickAlliance(): AllianceService {
  return firestoreAlliance.available() ? firestoreAlliance : noopAlliance;
}

/** In-memory stand-in for tests: one alliance at most, `others` stamps already in it. */
export function memoryAlliance(opts: { fail?: boolean; full?: boolean; existing?: Partial<AllianceView> } = {}) {
  const fake: AllianceService & { view: AllianceView | null; contributed: number[] } = {
    view: opts.existing ? { id: 'a1', name: 'Eternal Stampers', code: 'ABC234', size: 1, week: thisWeek(), stamps: 0, ...opts.existing } : null,
    contributed: [] as number[],
    available: () => true,
    async mine() {
      return opts.fail ? null : fake.view ? { ...fake.view } : ('none' as const);
    },
    async joinRandom() {
      if (opts.fail) return null;
      fake.view = { id: 'a2', name: 'Misty Clerks', code: 'XYZ789', size: 4, week: thisWeek(), stamps: 1200 };
      return { ...fake.view };
    },
    async create() {
      if (opts.fail) return null;
      fake.view = { id: 'a3', name: 'Cosmic Ledgers', code: 'NEW234', size: 1, week: thisWeek(), stamps: 0 };
      return { ...fake.view };
    },
    async joinByCode(code: string): Promise<JoinOutcome> {
      if (opts.fail) return null;
      if (opts.full) return 'full';
      if (code !== 'ABC234') return 'notfound';
      fake.view = { id: 'a1', name: 'Eternal Stampers', code, size: 2, week: thisWeek(), stamps: 500 };
      return { ...fake.view };
    },
    async leave() {
      if (opts.fail) return false;
      fake.view = null;
      return true;
    },
    async contribute(stamps: number) {
      if (opts.fail || !fake.view) return null;
      const consumed = Math.min(stamps, FLUSH_CAP);
      fake.contributed.push(consumed);
      fake.view.stamps += consumed;
      return { consumed, stamps: fake.view.stamps };
    },
    async members() {
      return opts.fail || !fake.view ? null : { top: [{ name: 'Clerk #ME00', souls: String(fake.view.stamps), me: true }], rank: 1, total: 1 };
    },
    async ranking() {
      return opts.fail || !fake.view ? null : { top: [{ name: fake.view.name, souls: String(fake.view.stamps), me: true }], rank: 1, total: 1 };
    },
  };
  return fake;
}

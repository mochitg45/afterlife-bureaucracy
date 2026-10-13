import { getBackend } from './firebase';
import { playReferral, REFERRAL_TIMEOUT_MS } from './referral';
import { BOARD_SIZE, clerkName, type BoardView } from './lifetimeBoard';

/** A player's place in one occurrence's ranking: 1-based rank among `total` ranked players. */
export interface Standing {
  rank: number;
  total: number;
}

/**
 * Per-occurrence event rankings in Firestore: `eventScores/{key}/entries/{uid}` holds each
 * anonymous player's best `earned` for that run. Play Games boards cannot serve here: the
 * Halloween board keeps every year, and the weekly board resets on Google's week, not ours.
 * Every method resolves; none throws.
 */
export interface EventRanking {
  /** Android only, like referrals (the Firebase backend needs Play Integrity). */
  available(): boolean;
  submit(key: string, score: number, name?: string): Promise<void>;
  /** The top of one run's board plus this player's place; null when unreachable. */
  board?(key: string): Promise<BoardView | null>;
  /** Null when unreachable; 'none' when this player has no entry for that key. */
  standing(key: string): Promise<Standing | 'none' | null>;
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), REFERRAL_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Firestore document ids cannot contain '/'; occurrence keys never do, but stay safe. */
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9-]/g, '_');

export const firestoreEventRanking: EventRanking = {
  available: () => playReferral.available(),

  async submit(key, score, name) {
    if (!(score > 0) || !Number.isFinite(score)) return;
    try {
      await withTimeout((async () => {
        const { db, uid } = await getBackend();
        const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore');
        // A transaction fails fast offline instead of queueing, and never lowers a score.
        await runTransaction(db, async (tx) => {
          const ref = doc(db, 'eventScores', safeKey(key), 'entries', uid);
          const cur = await tx.get(ref);
          const nm = (name || clerkName(uid)).slice(0, 24);
          if (cur.exists() && (cur.data().score as number) >= score && cur.data().name === nm) return;
          const best = cur.exists() ? Math.max(cur.data().score as number, score) : score;
          tx.set(ref, { score: best, name: nm, at: serverTimestamp() });
        });
      })());
    } catch {
      /* the next submit (pause, event page, rollover) tries again */
    }
  },

  async board(key) {
    try {
      return await withTimeout((async () => {
        const { db, uid } = await getBackend();
        const { collection, doc, getDoc, getDocs, query, orderBy, limit, where, getCountFromServer } = await import('firebase/firestore');
        const entries = collection(db, 'eventScores', safeKey(key), 'entries');
        const [snap, mine, total] = await Promise.all([
          getDocs(query(entries, orderBy('score', 'desc'), limit(BOARD_SIZE))),
          getDoc(doc(entries, uid)),
          getCountFromServer(entries),
        ]);
        const top = snap.docs.map((d) => ({ name: String(d.data().name ?? clerkName(d.id)), souls: String(d.data().score ?? 0), me: d.id === uid }));
        let rank: number | null = null;
        if (mine.exists()) rank = (await getCountFromServer(query(entries, where('score', '>', mine.data().score as number)))).data().count + 1;
        return { top, rank, total: total.data().count };
      })());
    } catch {
      return null;
    }
  },

  async standing(key) {
    try {
      return await withTimeout((async () => {
        const { db, uid } = await getBackend();
        const { doc, getDoc, collection, query, where, getCountFromServer } = await import('firebase/firestore');
        const entries = collection(db, 'eventScores', safeKey(key), 'entries');
        const mine = await getDoc(doc(entries, uid));
        if (!mine.exists()) return 'none' as const;
        const score = mine.data().score as number;
        const [above, total] = await Promise.all([
          getCountFromServer(query(entries, where('score', '>', score))),
          getCountFromServer(entries),
        ]);
        return { rank: above.data().count + 1, total: Math.max(1, total.data().count) };
      })());
    } catch {
      return null;
    }
  },
};

/** Web and iOS: no ranking server, so only the took-part prize is paid. */
export const noopEventRanking: EventRanking = {
  available: () => false,
  submit: async () => {},
  standing: async () => null,
};

export function pickEventRanking(): EventRanking {
  return firestoreEventRanking.available() ? firestoreEventRanking : noopEventRanking;
}

/** In-memory stand-in for tests: `others` are everyone else's scores per key. */
export function memoryEventRanking(opts: { others?: Record<string, number[]>; fail?: boolean } = {}): EventRanking & { mine: Record<string, number> } {
  const fake = {
    mine: {} as Record<string, number>,
    available: () => true,
    submit: async (key: string, score: number) => {
      if (score > (fake.mine[key] ?? 0)) fake.mine[key] = score;
    },
    standing: async (key: string): Promise<Standing | 'none' | null> => {
      if (opts.fail) return null;
      const me = fake.mine[key];
      if (me === undefined) return 'none';
      const others = opts.others?.[key] ?? [];
      return { rank: others.filter((s) => s > me).length + 1, total: others.length + 1 };
    },
  };
  return fake;
}

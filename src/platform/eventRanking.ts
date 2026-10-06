import { getBackend } from './firebase';
import { playReferral, REFERRAL_TIMEOUT_MS } from './referral';

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
  submit(key: string, score: number): Promise<void>;
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

  async submit(key, score) {
    if (!(score > 0) || !Number.isFinite(score)) return;
    try {
      await withTimeout((async () => {
        const { db, uid } = await getBackend();
        const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore');
        // A transaction fails fast offline instead of queueing, and never lowers a score.
        await runTransaction(db, async (tx) => {
          const ref = doc(db, 'eventScores', safeKey(key), 'entries', uid);
          const cur = await tx.get(ref);
          if (cur.exists() && (cur.data().score as number) >= score) return;
          tx.set(ref, { score, at: serverTimestamp() });
        });
      })());
    } catch {
      /* the next submit (pause, event page, rollover) tries again */
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

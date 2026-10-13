import { getBackend } from './firebase';
import { playReferral, REFERRAL_TIMEOUT_MS } from './referral';

/** One row of the in-game lifetime-souls board. `souls` is a Decimal string, shown formatted. */
export interface BoardRow {
  name: string;
  souls: string;
  me: boolean;
}

export interface BoardView {
  top: BoardRow[];
  /** This player's 1-based place, or null when they have no entry yet. */
  rank: number | null;
  total: number;
}

/**
 * The in-game lifetime-souls leaderboard: `lifetimeScores/{uid}` holds each player's name,
 * their souls as a Decimal string (Play Games cannot store numbers past 9.2e18), and
 * `score` = log10(souls) for ordering. Every method resolves; none throws.
 */
export interface LifetimeBoard {
  available(): boolean;
  submit(score: number, souls: string, name: string): Promise<void>;
  /** Null when unreachable. */
  view(limit?: number): Promise<BoardView | null>;
}

export const BOARD_SIZE = 50;
const NAME_MAX = 24;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), REFERRAL_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** A stable stand-in name for players who never signed in to Play Games. */
export function clerkName(uid: string): string {
  return `Clerk #${uid.slice(-4).toUpperCase()}`;
}

export const firestoreLifetimeBoard: LifetimeBoard = {
  available: () => playReferral.available(),

  async submit(score, souls, name) {
    if (!(score > 0) || !Number.isFinite(score)) return;
    try {
      await withTimeout((async () => {
        const { db, uid } = await getBackend();
        const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore');
        await runTransaction(db, async (tx) => {
          const ref = doc(db, 'lifetimeScores', uid);
          const cur = await tx.get(ref);
          const nm = (name || clerkName(uid)).slice(0, NAME_MAX);
          // A score never goes down; a name change alone still writes.
          if (cur.exists() && (cur.data().score as number) >= score && cur.data().name === nm) return;
          const best = cur.exists() && (cur.data().score as number) > score;
          tx.set(ref, { score: best ? cur.data().score : score, souls: best ? cur.data().souls : souls.slice(0, 40), name: nm, at: serverTimestamp() });
        });
      })());
    } catch {
      /* the next pause or board open tries again */
    }
  },

  async view(limit = BOARD_SIZE) {
    try {
      return await withTimeout((async () => {
        const { db, uid } = await getBackend();
        const { collection, doc, getDoc, getDocs, query, orderBy, limit: lim, where, getCountFromServer } = await import('firebase/firestore');
        const col = collection(db, 'lifetimeScores');
        const [snap, mine, total] = await Promise.all([
          getDocs(query(col, orderBy('score', 'desc'), lim(limit))),
          getDoc(doc(col, uid)),
          getCountFromServer(col),
        ]);
        const top = snap.docs.map((d) => ({ name: String(d.data().name ?? ''), souls: String(d.data().souls ?? '0'), me: d.id === uid }));
        let rank: number | null = null;
        if (mine.exists()) {
          const above = await getCountFromServer(query(col, where('score', '>', mine.data().score as number)));
          rank = above.data().count + 1;
        }
        return { top, rank, total: total.data().count };
      })());
    } catch {
      return null;
    }
  },
};

export const noopLifetimeBoard: LifetimeBoard = {
  available: () => false,
  submit: async () => {},
  view: async () => null,
};

export function pickLifetimeBoard(): LifetimeBoard {
  return firestoreLifetimeBoard.available() ? firestoreLifetimeBoard : noopLifetimeBoard;
}

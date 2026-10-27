import { getBackend } from './firebase';
import { playReferral } from './referral';
import { withTimeout } from './alliance';
import { VERDICTS, type CaseTally, type Verdict } from '../engine/cases';

/**
 * Case of the Day results in Firestore (schema and rules: firestore.rules, "Case of the Day").
 * One vote doc per player per UTC day, `caseVotes/{day}/votes/{uid}`; the shares come from
 * aggregate count queries, one per verdict. Every method resolves; null means "unreachable".
 */
export interface CaseService {
  /** Android only, like the other Firestore features (App Check needs Play Integrity). */
  available(): boolean;
  /**
   * Records this player's verdict for `day` (a vote already on file stays as it was) and
   * returns the day's tally, or null if the server could not be reached.
   */
  rule(day: string, verdict: Verdict): Promise<CaseTally | null>;
  /** The day's tally without voting (reopening a case already ruled). */
  tally(day: string): Promise<CaseTally | null>;
}

async function count(day: string): Promise<CaseTally> {
  const { db } = await getBackend();
  const f = await import('firebase/firestore');
  const votes = f.collection(db, 'caseVotes', day, 'votes');
  const counts = await Promise.all(VERDICTS.map((v) => f.getCountFromServer(f.query(votes, f.where('verdict', '==', v)))));
  return Object.fromEntries(VERDICTS.map((v, i) => [v, counts[i].data().count])) as CaseTally;
}

export const firestoreCases: CaseService = {
  available: () => playReferral.available(),

  async rule(day, verdict) {
    try {
      return await withTimeout((async () => {
        const { db, uid } = await getBackend();
        const f = await import('firebase/firestore');
        // Create-only by rule: a second write for the same day is refused, and that is fine.
        await f.setDoc(f.doc(db, 'caseVotes', day, 'votes', uid), { verdict, at: f.serverTimestamp() }).catch(() => {});
        return await count(day);
      })());
    } catch {
      return null;
    }
  },

  async tally(day) {
    try {
      return await withTimeout(count(day));
    } catch {
      return null;
    }
  },
};

/** Web, iOS and tests by default: no results, "Results need an internet connection". */
export const noopCases: CaseService = {
  available: () => false,
  rule: async () => null,
  tally: async () => null,
};

export function pickCases(): CaseService {
  return firestoreCases.available() ? firestoreCases : noopCases;
}

/** In-memory stand-in for tests: tallies per day, `fail` for an unreachable server. */
export function memoryCases(opts: { fail?: boolean; seed?: Partial<CaseTally> } = {}) {
  const votes = new Map<string, Verdict>();
  const base = (): CaseTally => ({ heaven: 0, hell: 0, reincarnate: 0, ...opts.seed });
  const fake: CaseService & { votes: Map<string, Verdict> } = {
    votes,
    available: () => true,
    async rule(day, verdict) {
      if (opts.fail) return null;
      if (!votes.has(day)) votes.set(day, verdict);
      return fake.tally(day);
    },
    async tally(day) {
      if (opts.fail) return null;
      const t = base();
      const mine = votes.get(day);
      if (mine) t[mine]++;
      return t;
    },
  };
  return fake;
}

/**
 * Event ranking prizes. Every occurrence has its own ranking (see platform/eventRanking.ts);
 * when it ends, each player who earned anything is paid by final position: 1st, 2nd and 3rd
 * place, then percentile brackets, then a thank-you for taking part. Holiday specials pay more
 * than the weekend weeklies.
 */
import type { GameState } from './state';
import { grantVouchersExact } from './vouchers';

export interface RankPrize {
  /** Exact place (1-3), or a top-percent bracket, or neither for the "took part" row. */
  place?: 1 | 2 | 3;
  topPct?: number;
  vouchers: number;
  seals: number;
}

export const RANK_PRIZES: Record<'special' | 'weekly', RankPrize[]> = {
  special: [
    { place: 1, vouchers: 500, seals: 150 },
    { place: 2, vouchers: 350, seals: 100 },
    { place: 3, vouchers: 250, seals: 75 },
    { topPct: 1, vouchers: 150, seals: 50 },
    { topPct: 5, vouchers: 100, seals: 30 },
    { topPct: 10, vouchers: 70, seals: 20 },
    { topPct: 25, vouchers: 40, seals: 10 },
    { topPct: 50, vouchers: 20, seals: 0 },
    { vouchers: 10, seals: 0 },
  ],
  weekly: [
    { place: 1, vouchers: 200, seals: 60 },
    { place: 2, vouchers: 150, seals: 40 },
    { place: 3, vouchers: 100, seals: 30 },
    { topPct: 1, vouchers: 60, seals: 20 },
    { topPct: 5, vouchers: 40, seals: 10 },
    { topPct: 10, vouchers: 30, seals: 0 },
    { topPct: 25, vouchers: 20, seals: 0 },
    { topPct: 50, vouchers: 10, seals: 0 },
    { vouchers: 5, seals: 0 },
  ],
};

/** The row a final (or current) position pays; `rank` is 1-based, `total` counts everyone ranked. */
export function prizeFor(kind: 'special' | 'weekly', rank: number | null, total: number): RankPrize {
  const rows = RANK_PRIZES[kind];
  const joined = rows[rows.length - 1];
  if (rank === null || rank < 1 || total < 1) return joined;
  for (const row of rows) {
    if (row.place !== undefined) {
      if (rank === row.place) return row;
    } else if (row.topPct !== undefined) {
      if (rank / total <= row.topPct / 100) return row;
    }
  }
  return joined;
}

/** Pays a finished occurrence's ranking prize and takes it off the pending list. */
export function payRankPrize(state: GameState, key: string, prize: RankPrize): GameState {
  if (!state.rankPending.some((p) => p.key === key)) return state;
  const paid = grantVouchersExact(state, prize.vouchers);
  return { ...paid, seals: paid.seals + prize.seals, rankPending: state.rankPending.filter((p) => p.key !== key) };
}

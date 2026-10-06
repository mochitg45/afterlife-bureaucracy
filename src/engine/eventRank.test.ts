import { prizeFor, payRankPrize, RANK_PRIZES } from './eventRank';
import { createInitialState } from './state';
import { content } from '../data';

describe('prizeFor', () => {
  it('pays 1st, 2nd and 3rd by exact place, then percent brackets, then took-part', () => {
    const r = RANK_PRIZES.special;
    expect(prizeFor('special', 1, 1000)).toBe(r[0]);
    expect(prizeFor('special', 2, 1000)).toBe(r[1]);
    expect(prizeFor('special', 3, 1000)).toBe(r[2]);
    expect(prizeFor('special', 4, 1000)).toBe(r[3]); // top 1%: rank 4..10
    expect(prizeFor('special', 10, 1000)).toBe(r[3]);
    expect(prizeFor('special', 11, 1000)).toBe(r[4]); // top 5%
    expect(prizeFor('special', 500, 1000)).toBe(r[7]); // top 50%
    expect(prizeFor('special', 501, 1000)).toBe(r[8]);
    expect(prizeFor('special', null, 0)).toBe(r[8]);
  });
  it('a tiny field still pays places, and nobody gets less than took-part', () => {
    expect(prizeFor('weekly', 1, 1)).toBe(RANK_PRIZES.weekly[0]);
    expect(prizeFor('weekly', 4, 4).vouchers).toBeGreaterThan(0);
  });
  it('every bracket pays at least the one below it', () => {
    for (const rows of Object.values(RANK_PRIZES)) {
      for (let i = 1; i < rows.length; i++) expect(rows[i - 1].vouchers).toBeGreaterThanOrEqual(rows[i].vouchers);
    }
  });
});

describe('payRankPrize', () => {
  it('pays vouchers and seals once, then forgets the key', () => {
    const s = { ...createInitialState({ wall: 0, mono: 0 }, content), vouchers: 0, seals: 0, rankPending: [{ key: 'k', name: 'N', special: true }] };
    const paid = payRankPrize(s, 'k', RANK_PRIZES.special[0]);
    expect(paid.vouchers).toBe(500);
    expect(paid.seals).toBe(150);
    expect(paid.rankPending).toEqual([]);
    expect(payRankPrize(paid, 'k', RANK_PRIZES.special[0])).toBe(paid);
  });
});

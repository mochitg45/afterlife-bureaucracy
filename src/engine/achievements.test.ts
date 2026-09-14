import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import { checkAchievements, achievementMult, isMet } from './achievements';
const now = { wall: 0, mono: 0 };

describe('achievements', () => {
  it('unlocks souls milestones by Decimal comparison and grants vouchers once', () => {
    const s0 = { ...createInitialState(now, content), soulsLifetime: new Decimal('1e6') };
    const r = checkAchievements(s0, content);
    const ids = r.unlocked.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['a-souls-1', 'a-souls-2', 'a-souls-3', 'a-souls-4']));
    expect(r.state.achievements).toEqual(expect.arrayContaining(ids));
    expect(r.state.vouchers).toBe(r.unlocked.reduce((n, a) => n + (a.vouchers ?? 0), 0));
    expect(checkAchievements(r.state, content).state).toBe(r.state);
  });
  it('evaluates count-based conditions', () => {
    const b = createInitialState(now, content);
    const s = { ...b, staff: { dave: 25 }, cards: { 'c-keeper': 5, 'c-dave-overtime': 1 }, equipped: ['c-keeper'], perks: ['throughput-1'], dailies: { ...b.dailies, bestStreak: 7 } };
    expect(isMet(s, content, { type: 'staffOwned', staff: 'dave', target: 25 })).toBe(true);
    expect(isMet(s, content, { type: 'executivesOwned', target: 1 })).toBe(true);
    expect(isMet(s, content, { type: 'fiveStarCards', target: 1 })).toBe(true);
    expect(isMet(s, content, { type: 'cardsOwned', target: 3 })).toBe(false);
    expect(isMet(s, content, { type: 'bestStreak', target: 7 })).toBe(true);
    expect(isMet(s, content, { type: 'perksOwned', target: 2 })).toBe(false);
  });
  it('adds 1% per unlocked achievement', () => {
    expect(achievementMult({ ...createInitialState(now, content), achievements: ['a', 'b', 'c'] }).toNumber()).toBeCloseTo(1.03);
  });
});

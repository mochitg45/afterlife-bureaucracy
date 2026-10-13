import { describe, expect, it } from 'vitest';
import { createInitialState, serialize, deserialize, type GameState } from './state';
import { content } from '../data';
import { beginnerActive, beginnerDay, claimBeginner, welcomeBack, COMEBACK_VOUCHERS, COMEBACK_AFTER_SEC } from './retention';

const INSTALL = new Date(2026, 9, 13, 10).getTime();
function player(date: string, stats: Partial<GameState['stats']> = {}): GameState {
  const s = createInitialState({ wall: INSTALL, mono: 0 }, content);
  return { ...s, dailies: { ...s.dailies, date }, stats: { ...s.stats, ...stats } };
}

describe('Beginner Week', () => {
  it('counts days from install and pays a day once its goal is met', () => {
    const s = player('2026-10-13', { staffHired: 25 });
    expect(beginnerDay(s)).toBe(1);
    const r = claimBeginner(s, content, 1);
    expect(r.state.vouchers - s.vouchers).toBe(20);
    expect(claimBeginner(r.state, content, 1).reward).toBeNull();
  });

  it('keeps tomorrow locked, then pays the guaranteed card', () => {
    const s = { ...player('2026-10-13'), deptsUnlocked: ['intake', 'heaven'] };
    expect(claimBeginner(s, content, 2).reward).toBeNull();
    const next = { ...s, dailies: { ...s.dailies, date: '2026-10-14' } };
    const r = claimBeginner(next, content, 2);
    expect(r.card?.cardId).toBe('c-dave-cooked');
    expect(r.state.cards['c-dave-cooked']).toBeGreaterThanOrEqual(1);
  });

  it('ends after the grace period and survives a save', () => {
    expect(beginnerActive(player('2026-11-30'))).toBe(false);
    const s = { ...player('2026-10-13'), beginner: { claimed: [1, 3] } };
    expect(deserialize(serialize(s), content).beginner.claimed).toEqual([1, 3]);
  });
});

describe('welcome back', () => {
  it('pays vouchers and an hour of boost after three days away', () => {
    const s = player('2026-10-13', { staffHired: 5 });
    expect(welcomeBack(s, COMEBACK_AFTER_SEC - 1, INSTALL)).toBeNull();
    const r = welcomeBack(s, 4 * 86_400, INSTALL)!;
    expect(r.days).toBe(4);
    expect(r.state.vouchers - s.vouchers).toBe(COMEBACK_VOUCHERS);
    expect(r.state.boostUntilWall).toBe(INSTALL + 3_600_000);
  });
  it('skips players who never started', () => {
    expect(welcomeBack(player('2026-10-13'), 10 * 86_400, INSTALL)).toBeNull();
  });
});

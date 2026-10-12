import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { createInitialState, serialize, deserialize, type GameState } from './state';
import { content } from '../data';
import { activeEvent, buyEventPass, claimEventMission, claimEventTierPrize, missionProgress, stampEvent, syncEvent, PASS_FALLBACK_EVENT_VOUCHERS } from './events';
import { claimLogin, loginClaimable, LOGIN_REWARDS } from './login';
import { applyPurchase } from './entitlements';

const NOW = Date.parse('2026-10-25T12:00:00Z'); // inside Halloween
const occ = activeEvent(content, NOW)!;
function inEvent(patch = {}): GameState {
  const s = createInitialState({ wall: 0, mono: 0 }, content);
  return { ...s, dailies: { ...s.dailies, date: '2026-10-25' }, event: { key: occ.key, points: new Decimal(0), earned: new Decimal('1e20'), staff: {}, claimed: [], ...patch } };
}

describe('event missions', () => {
  it('counts stamps per day and pays once', () => {
    let s = inEvent();
    for (let i = 0; i < 100; i++) s = stampEvent(s, content, occ);
    expect(missionProgress(s, 'taps')).toBe(100);
    const r = claimEventMission(s, 'taps');
    expect(r.amount).toBe(5);
    expect(r.state.eventVouchers.special).toBe(5);
    expect(claimEventMission(r.state, 'taps').amount).toBe(0);
    // A new day starts the counters over.
    const tomorrow = { ...r.state, dailies: { ...r.state.dailies, date: '2026-10-26' } };
    expect(missionProgress(tomorrow, 'taps')).toBe(0);
    expect(claimEventMission(tomorrow, 'taps').amount).toBe(0);
  });
});

describe('event pass', () => {
  it('pays the premium row of already-claimed tiers, then 3x on new claims', () => {
    let s = inEvent();
    s = claimEventTierPrize(s, content, occ, 0).state; // 15 holiday vouchers
    expect(s.eventVouchers.special).toBe(15);
    s = applyPurchase(s, content, 'holiday_pass', NOW, new Decimal(1));
    expect(s.event!.pass).toBe(true);
    expect(s.eventVouchers.special).toBe(45);
    const r = claimEventTierPrize(s, content, occ, 2); // 30 -> 90 with pass
    expect(r.state.eventVouchers.special).toBe(45 + 90);
    const card = claimEventTierPrize(r.state, content, occ, 1);
    expect(card.prize?.kind === 'card' && card.prize.extra).toBeTruthy();
  });
  it('falls back to event vouchers when the event is gone', () => {
    const s = { ...inEvent(), event: null };
    expect(buyEventPass(s, content, 'weekly').eventVouchers.weekly).toBe(PASS_FALLBACK_EVENT_VOUCHERS.weekly);
  });
  it('pays premium on unclaimed tiers when the event ends', () => {
    const s = syncEvent(inEvent({ pass: true }), content, Date.parse('2026-11-10T00:00:00Z'));
    const vouchersOnTrack = occ.track.reduce((n, t) => n + (t.reward.type === 'eventVouchers' ? t.reward.amount : 0), 0);
    expect(s.eventVouchers.special).toBe(vouchersOnTrack * 3);
  });
  it('survives a save round-trip', () => {
    const s = deserialize(serialize(inEvent({ pass: true, missions: { date: '2026-10-25', taps: 7, hires: 2, claimed: ['hires'] } })), content);
    expect(s.event).toMatchObject({ pass: true, missions: { taps: 7, hires: 2, claimed: ['hires'] } });
  });
});

describe('login calendar', () => {
  it('pays once per day and walks the 7-day strip', () => {
    let s = inEvent();
    expect(loginClaimable(s)).toBe(true);
    const r = claimLogin(s);
    expect(r.reward).toEqual(LOGIN_REWARDS[0]);
    expect(loginClaimable(r.state)).toBe(false);
    expect(claimLogin(r.state).reward).toBeNull();
    s = r.state;
    for (let i = 1; i < 7; i++) s = claimLogin({ ...s, dailies: { ...s.dailies, date: `2026-11-0${i}` } }).state;
    expect(s.login.day).toBe(0);
    expect(s.seals).toBe(15);
  });
});

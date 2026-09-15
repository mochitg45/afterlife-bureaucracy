import { createInitialState } from './state';
import { content } from '../data';
import { offlineCapSeconds, offlineRateFraction, applyOffline, MIN_OFFLINE_SECONDS } from './offline';
import { fakeClock } from './time';

const now = { wall: 0, mono: 0 };

describe('offline caps', () => {
  it('base cap is 4 hours and grows with night-shift upgrades', () => {
    const s = createInitialState(now, content);
    expect(offlineCapSeconds(s, content)).toBe(4 * 3600);
    s.upgrades['night-shift'] = 2;
    expect(offlineCapSeconds(s, content)).toBe(12 * 3600);
  });
  it('base rate is 50%, capped at 100%', () => {
    const s = createInitialState(now, content);
    expect(offlineRateFraction(s, content)).toBe(0.5);
    s.upgrades['overtime-pay'] = 2;
    expect(offlineRateFraction(s, content)).toBe(1);
  });
});

describe('applyOffline', () => {
  const base = () => ({ ...createInitialState(now, content), staff: { dave: 1 } }); // 0.5 souls/s
  it('pays the Remove-Ads holder double, without touching the cap or the half rate', () => {
    const s = base();
    const plain = applyOffline(s, content, 600, 0);
    const exempt = applyOffline({ ...s, entitlements: { ...s.entitlements, removeAds: true } }, content, 600, 0);
    expect(exempt.souls.div(plain.souls).toNumber()).toBeCloseTo(2);
    expect(exempt.kc.div(plain.kc).toNumber()).toBeCloseTo(2);
    expect(exempt.creditedSec).toBe(plain.creditedSec);
  });
  it('credits half rate for elapsed time under the cap', () => {
    const r = applyOffline(base(), content, 600, 0);
    expect(r.creditedSec).toBe(600);
    expect(r.capped).toBe(false);
    expect(r.souls.toNumber()).toBeCloseTo(0.5 * 600 * 0.5);
    expect(r.kc.toNumber()).toBeCloseTo(0.5 * 600 * 0.5 * 0.4);
    expect(r.state.soulsRun.toNumber()).toBeCloseTo(150);
  });
  it('caps at the offline cap', () => {
    const r = applyOffline(base(), content, 10 * 3600, 0);
    expect(r.creditedSec).toBe(4 * 3600);
    expect(r.capped).toBe(true);
  });
  it('credits nothing under the minimum or for negative elapsed', () => {
    expect(applyOffline(base(), content, MIN_OFFLINE_SECONDS - 1, 0).creditedSec).toBe(0);
    expect(applyOffline(base(), content, -100, 0).creditedSec).toBe(0);
    expect(applyOffline(base(), content, -100, 0).souls.toNumber()).toBe(0);
  });
});

it('perks extend the offline cap and rate', () => {
  const s = { ...createInitialState(now, content), perks: ['overtime-1', 'overtime-4'] };
  expect(offlineCapSeconds(s, content)).toBe(8 * 3600);
  expect(offlineRateFraction(s, content)).toBeCloseTo(0.6);
});

it('equipped cards extend the offline cap', () => {
  const s = { ...createInitialState(now, content), cards: { 'c-gary-break': 2 }, equipped: ['c-gary-break'] };
  expect(offlineCapSeconds(s, content)).toBe(4 * 3600 + 3600);
});

describe('fakeClock', () => {
  it('advances both clocks and allows wall-only changes', () => {
    const c = fakeClock({ wall: 1000, mono: 0 });
    c.advance(500);
    expect(c.wall()).toBe(1500);
    expect(c.mono()).toBe(500);
    c.setWall(100);
    expect(c.wall()).toBe(100);
    expect(c.mono()).toBe(500);
  });
});

import Decimal from 'break_infinity.js';
import { createGameStore } from './game';
import { memoryStorage } from '../platform/storage';
import { fakeClock } from '../engine/time';
import { content } from '../data';
import { POSTCARD_IDS } from '../engine/postcards';

function make() {
  const clock = fakeClock({ wall: 1_000_000, mono: 0 });
  const store = createGameStore({ content, storage: memoryStorage(), clock, tickMs: 1_000_000, autosaveMs: 1_000_000, random: () => 1 });
  return { store, clock };
}

describe('openPostcard', () => {
  it('returns null on an empty mailbox', () => {
    const { store } = make();
    expect(store.getState().openPostcard()).toBeNull();
  });

  it('moves the card to the album, pays souls and pays the 10-card milestone once', () => {
    const { store } = make();
    const ids = POSTCARD_IDS.slice(0, 11);
    store.setState((c) => ({
      state: { ...c.state, soulsLifetime: new Decimal(1e12), postcards: { collected: ids.slice(0, 9), waiting: [ids[9], ids[10]], nextAtWall: 1 } },
    }));
    store.getState().stamp(); // settle once so one-off achievement vouchers are not counted below
    store.setState((c) => ({ rates: { ...c.rates, soulsPerSec: new Decimal(100) } }));
    const v0 = store.getState().state.vouchers;
    const run0 = store.getState().state.soulsRun;
    expect(store.getState().openPostcard()).toBe(ids[9]);
    const s = store.getState().state;
    expect(s.postcards.collected).toHaveLength(10);
    expect(s.vouchers).toBe(v0 + 1);
    expect(s.soulsRun.sub(run0).toNumber()).toBeGreaterThanOrEqual(12_000);
    expect(store.getState().openPostcard()).toBe(ids[10]);
    expect(store.getState().state.vouchers).toBe(v0 + 1);
  });

  it('mints no mail while Reincarnation is closed; once open it schedules, then delivers one card', () => {
    const { store, clock } = make();
    clock.advance(24 * 3_600_000);
    store.getState().stamp();
    expect(store.getState().state.postcards.nextAtWall).toBe(0);
    store.setState((c) => ({ state: { ...c.state, deptsUnlocked: [...c.state.deptsUnlocked, 'reincarnation'] } }));
    store.getState().stamp();
    expect(store.getState().state.postcards.nextAtWall).toBeGreaterThan(clock.wall());
    clock.advance(7 * 3_600_000);
    store.getState().stamp();
    expect(store.getState().state.postcards.waiting).toHaveLength(1);
  });
});

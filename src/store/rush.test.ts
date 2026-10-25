import { createGameStore } from './game';
import { memoryStorage } from '../platform/storage';
import { fakeClock } from '../engine/time';
import { content } from '../data';
import { RUSH_COOLDOWN_MS, RUSH_CAP_SEC } from '../engine/rush';

async function make() {
  const clock = fakeClock({ wall: 1_800_000_000_000, mono: 100_000 });
  const store = createGameStore({ content, storage: memoryStorage(), clock, tickMs: 1_000_000, autosaveMs: 1_000_000 });
  await store.getState().boot();
  return { store, clock };
}

describe('stamp rush store', () => {
  it('pays only for a round the store saw start, once, and never touches event or voucher fields', async () => {
    const { store } = await make();
    expect(store.getState().finishRush(100).souls.eq(0)).toBe(true);
    expect(store.getState().startRush()).toBe(true);
    const before = store.getState().state;
    const pay = store.getState().finishRush(1e9);
    const after = store.getState().state;
    expect(pay.souls.lte(store.getState().rates.soulsPerSec.max(store.getState().rates.clickPower).mul(RUSH_CAP_SEC))).toBe(true);
    expect(after.vouchers).toBe(before.vouchers);
    expect(after.seals).toBe(before.seals);
    expect(after.event).toEqual(before.event);
    expect(store.getState().finishRush(100).souls.eq(0)).toBe(true);
  });
  it('locks after three rounds until the wall-clock cooldown passes', async () => {
    const { store, clock } = await make();
    for (let i = 0; i < 3; i++) { expect(store.getState().startRush()).toBe(true); store.getState().finishRush(0); }
    expect(store.getState().startRush()).toBe(false);
    clock.advance(RUSH_COOLDOWN_MS);
    expect(store.getState().startRush()).toBe(true);
  });
});

import Decimal from 'break_infinity.js';
import { createGameStore } from './game';
import { memoryStorage } from '../platform/storage';
import { fakeClock } from '../engine/time';
import { content } from '../data';
import { computeRates } from '../engine/economy';
import type { GameState } from '../engine/state';
import type { Notifications } from '../platform/notifications';

function fakeNotifications() {
  const calls: string[] = [];
  const n: Notifications = {
    requestPermission: async () => { calls.push('perm'); return true; },
    schedule: async (items) => { calls.push('schedule:' + items.map((i) => i.id).join(',')); },
    cancelAll: async () => { calls.push('cancel'); },
  };
  return { n, calls };
}
async function make(wall = new Date(2026, 8, 14, 10).getTime()) {
  const storage = memoryStorage();
  const clock = fakeClock({ wall, mono: 0 });
  const { n, calls } = fakeNotifications();
  const store = createGameStore({ content, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000_000, notifications: n });
  await store.getState().boot();
  /** State and rates move together, so a seeded state does not leave stale rates behind. */
  const seed = (patch: Partial<GameState>) => {
    const state = { ...store.getState().state, ...patch };
    store.setState({ state, rates: computeRates(state, content, clock.wall()) });
    return state;
  };
  /** An office that actually produces souls, which the in-tray notification requires. */
  const staffUp = () => seed({ staff: { dave: 5 } });
  return { store, storage, clock, calls, seed, staffUp };
}

describe('retention store', () => {
  it('assigns dailies on boot and rolls over at midnight', async () => {
    const { store, clock } = await make();
    expect(store.getState().state.dailies.tasks).toHaveLength(3);
    const date = store.getState().state.dailies.date;
    clock.advance(24 * 3600 * 1000);
    store.getState().stamp();
    expect(store.getState().state.dailies.date).not.toBe(date);
    store.getState().stopLoop();
  });
  it('pulls, reveals, equips', async () => {
    const { store } = await make();
    store.setState({ state: { ...store.getState().state, vouchers: 90 } });
    store.getState().pull(10);
    expect(store.getState().pendingPull).toHaveLength(10);
    expect(store.getState().state.vouchers).toBe(0);
    const id = store.getState().pendingPull![0].cardId;
    store.getState().dismissPull();
    expect(store.getState().pendingPull).toBeNull();
    store.getState().equip(id);
    expect(store.getState().state.equipped).toEqual([id]);
    store.getState().unequip(id);
    expect(store.getState().state.equipped).toEqual([]);
    store.getState().stopLoop();
  });
  it('unlocks achievements and queues story memos after actions', async () => {
    const { store } = await make();
    store.setState({ state: { ...store.getState().state, soulsLifetime: new Decimal(999) } });
    store.getState().stamp();
    expect(store.getState().state.achievements).toContain('a-souls-1');
    expect(store.getState().recentAchievements.map((a) => a.id)).toContain('a-souls-1');
    expect(store.getState().pendingStory.map((m) => m.id)).toContain('s-deja-vu');
    store.getState().dismissStory();
    store.getState().clearAchievementToast();
    expect(store.getState().recentAchievements).toEqual([]);
    store.getState().stopLoop();
  });
  it('claims a finished daily, paying vouchers and KC', async () => {
    const { store, seed } = await make();
    const def = content.dailies.find((d) => d.id === 'd-clicks-1')!;
    const s = store.getState().state;
    // Seeded explicitly rather than relying on today's draw, so the task under test is always
    // the one this assertion is written against.
    seed({
      vouchers: 0,
      kc: new Decimal(0),
      dailies: { ...s.dailies, tasks: [{ id: def.id, claimed: false }], baseline: { ...s.dailies.baseline, clicks: 0 } },
      stats: { ...s.stats, clicks: def.target },
    });
    store.getState().claimDaily(def.id);
    const after = store.getState().state;
    expect(after.dailies.tasks.find((t) => t.id === def.id)!.claimed).toBe(true);
    expect(after.vouchers).toBe(10);
    expect(after.kc.gt(0)).toBe(true);
    expect(after.stats.dailiesClaimed).toBe(1);
    store.getState().stopLoop();
  });
  it('sets cooked mood after a long absence and restores on stamp', async () => {
    const { store, clock } = await make();
    await store.getState().pause();
    clock.advance(13 * 3600 * 1000);
    await store.getState().resume();
    expect(store.getState().mood).toBe('cooked');
    store.getState().stamp();
    expect(store.getState().mood).toBe('ok');
    store.getState().stopLoop();
  });
  it('schedules notifications on pause only after opt-in, cancels on resume', async () => {
    const { store, calls, staffUp } = await make();
    await store.getState().pause();
    expect(calls.filter((c) => c.startsWith('schedule'))).toHaveLength(0);
    await store.getState().setNotifOptIn('yes');
    expect(store.getState().state.settings.notifOptIn).toBe('yes');
    staffUp();
    await store.getState().pause();
    expect(calls).toContain('schedule:1,2');
    await store.getState().resume();
    expect(calls.filter((c) => c === 'cancel').length).toBeGreaterThan(0);
    store.getState().stopLoop();
  });
  it('spends the in-tray notification budget once a day, however many times the app pauses', async () => {
    const { store, calls, clock, staffUp } = await make();
    await store.getState().setNotifOptIn('yes');
    staffUp();
    await store.getState().pause();
    await store.getState().resume();
    staffUp();
    await store.getState().pause();
    const scheduled = calls.filter((c) => c.startsWith('schedule:'));
    expect(scheduled).toEqual(['schedule:1,2', 'schedule:2']);
    expect(store.getState().state.settings.notifsSent).toBe(1);
    // A new local day refills the budget.
    await store.getState().resume();
    clock.advance(24 * 3600 * 1000);
    staffUp();
    await store.getState().pause();
    const afterMidnight = calls.filter((c) => c.startsWith('schedule:'));
    expect(afterMidnight[afterMidnight.length - 1]).toBe('schedule:1,2');
    expect(store.getState().state.settings.notifsSent).toBe(1);
    store.getState().stopLoop();
  });
  it('skips the in-tray notification when the office produces nothing', async () => {
    const { store, calls } = await make();
    await store.getState().setNotifOptIn('yes');
    await store.getState().pause();
    expect(calls.filter((c) => c.startsWith('schedule:'))).toEqual(['schedule:2']);
    expect(store.getState().state.settings.notifsSent).toBe(0);
    store.getState().stopLoop();
  });
  it('asks for notifications only after two days', async () => {
    const { store, clock } = await make();
    expect(store.getState().shouldAskNotifications()).toBe(false);
    clock.advance(2 * 86_400_000 + 1);
    expect(store.getState().shouldAskNotifications()).toBe(true);
    store.getState().stopLoop();
  });
  it('audit keeps cards, dailies, achievements and story', async () => {
    const { store } = await make();
    const s = store.getState().state;
    store.setState({ state: { ...s, soulsRun: new Decimal('1e13'), cards: { 'c-keeper': 2 }, equipped: ['c-keeper'], achievements: ['a-souls-1'], storySeen: ['s-first-stamp'] } });
    store.getState().audit();
    const a = store.getState().state;
    expect(a.cards).toEqual({ 'c-keeper': 2 });
    expect(a.equipped).toEqual(['c-keeper']);
    expect(a.achievements).toContain('a-souls-1');
    expect(a.storySeen).toContain('s-first-stamp');
    expect(a.dailies.date).toBe(s.dailies.date);
    store.getState().stopLoop();
  });
  it('pops one story memo and one achievement toast at a time, leaving the rest queued', async () => {
    const { store } = await make();
    const [s1, s2] = content.story;
    const [a1, a2] = content.achievements;
    store.setState({ pendingStory: [s1, s2], recentAchievements: [a1, a2] });
    store.getState().dismissStory();
    expect(store.getState().pendingStory).toEqual([s2]);
    store.getState().clearAchievementToast();
    expect(store.getState().recentAchievements).toEqual([a2]);
    store.getState().stopLoop();
  });
  it('pause resolves even if native scheduling rejects, and still saves', async () => {
    const storage = memoryStorage();
    const clock = fakeClock({ wall: new Date(2026, 8, 14, 10).getTime(), mono: 0 });
    const n: Notifications = {
      requestPermission: async () => true,
      schedule: async () => { throw new Error('native scheduling failure'); },
      cancelAll: async () => { throw new Error('native cancel failure'); },
    };
    const store = createGameStore({ content, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000_000, notifications: n });
    await store.getState().boot();
    await store.getState().setNotifOptIn('yes');
    const setSpy = vi.spyOn(storage, 'set');
    await expect(store.getState().pause()).resolves.toBeUndefined();
    expect(setSpy).toHaveBeenCalled();
    setSpy.mockRestore();
    store.getState().stopLoop();
  });
});

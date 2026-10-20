import { createGameStore } from './game';
import { memoryStorage } from '../platform/storage';
import { fakeClock } from '../engine/time';
import { content } from '../data';
import { memoryAlliance } from '../platform/alliance';
import { ALLIANCE_TIERS, allianceWeek } from '../engine/alliance';

// The fake service stamps its views with the real week, so the store's clock runs on real time too.
const T0 = Date.now();

async function make(opts: Parameters<typeof memoryAlliance>[0] = {}) {
  const alliance = memoryAlliance(opts);
  const clock = fakeClock({ wall: T0, mono: 100_000 });
  const store = createGameStore({ content, storage: memoryStorage(), clock, tickMs: 1_000_000, autosaveMs: 1_000_000, alliance });
  await store.getState().boot();
  await vi.waitFor(() => expect(store.getState().allianceInfo.status).not.toBe('idle'));
  await vi.waitFor(() => expect(store.getState().allianceInfo.status).not.toBe('loading'));
  return { store, alliance, clock };
}

describe('Office Alliance in the store', () => {
  it('starts outside an alliance and joins a random one', async () => {
    const { store } = await make();
    expect(store.getState().allianceInfo.status).toBe('none');
    expect(await store.getState().joinRandomAlliance()).toBe(true);
    expect(store.getState().allianceInfo.view?.name).toBe('Misty Clerks');
    expect(store.getState().allianceInfo.status).toBe('ready');
  });

  it('says unreachable when the server cannot be reached', async () => {
    const { store } = await make({ fail: true });
    expect(store.getState().allianceInfo.status).toBe('error');
    expect(await store.getState().createAlliance()).toBe(false);
  });

  it('checks codes before calling out, and reports not found / full', async () => {
    const { store } = await make();
    expect(await store.getState().joinAllianceByCode('abc')).toBe('invalid');
    expect(await store.getState().joinAllianceByCode('ZZZ999')).toBe('notfound');
    expect(await store.getState().joinAllianceByCode(' abc234 ')).toBe('ok');
    const full = await make({ full: true });
    expect(await full.store.getState().joinAllianceByCode('ABC234')).toBe('full');
  });

  it('batches stamps and flushes after 30 s of stamping, and on pause', async () => {
    const { store, alliance, clock } = await make({ existing: { stamps: 100 } });
    for (let i = 0; i < 5; i++) store.getState().stamp();
    expect(alliance.contributed).toEqual([]); // the 30 s window starts when the alliance loads
    clock.advance(30_000);
    store.getState().stamp();
    await vi.waitFor(() => expect(alliance.contributed).toEqual([6]));
    expect(store.getState().allianceInfo.view?.stamps).toBe(106);
    store.getState().eventStamp(); // no event running: nothing counted
    store.getState().stamp();
    await store.getState().pause();
    await vi.waitFor(() => expect(alliance.contributed).toEqual([6, 1]));
  });

  it('pays a reached tier once this week', async () => {
    const { store } = await make({ existing: { stamps: ALLIANCE_TIERS[0].stamps } });
    const before = store.getState().state;
    store.getState().claimAllianceTier(0);
    const after = store.getState().state;
    expect(after.vouchers - before.vouchers).toBe(ALLIANCE_TIERS[0].vouchers);
    expect(after.seals).toBe(before.seals);
    expect(after.alliance).toEqual({ week: allianceWeek(T0), claimed: [0] });
    store.getState().claimAllianceTier(0);
    store.getState().claimAllianceTier(1); // not reached
    expect(store.getState().state.vouchers).toBe(after.vouchers);
  });

  it('leaves and stops counting stamps', async () => {
    const { store, alliance, clock } = await make({ existing: {} });
    expect(await store.getState().leaveAlliance()).toBe(true);
    expect(store.getState().allianceInfo.status).toBe('none');
    clock.advance(60_000);
    store.getState().stamp();
    await store.getState().flushAlliance();
    expect(alliance.contributed).toEqual([]);
  });
});

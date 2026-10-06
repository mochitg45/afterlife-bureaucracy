import Decimal from 'break_infinity.js';
import { createGameStore } from './game';
import { memoryStorage } from '../platform/storage';
import { fakeClock } from '../engine/time';
import { content } from '../data';
import { activeEvent } from '../engine/events';
import { memoryEventRanking } from '../platform/eventRanking';
import { RANK_PRIZES } from '../engine/eventRank';

const HALLOWEEN = Date.UTC(2026, 9, 25, 12);
const AFTER = Date.UTC(2026, 10, 6, 12);

async function make(ranking = memoryEventRanking({ others: {} })) {
  const clock = fakeClock({ wall: HALLOWEEN, mono: 0 });
  const store = createGameStore({ content, storage: memoryStorage(), clock, tickMs: 1_000_000, autosaveMs: 1_000_000, eventRanking: ranking });
  await store.getState().boot();
  const occ = activeEvent(content, HALLOWEEN)!;
  const s = store.getState().state;
  store.setState({ state: { ...s, vouchers: 0, seals: 0, achievements: content.achievements.map((a) => a.id), event: { key: occ.key, points: new Decimal(0), earned: new Decimal(5000), staff: {}, claimed: [0] } } });
  return { store, clock, occ, ranking };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('event ranking prizes', () => {
  it('when the event ends, sends the final score, opens the prize for 2nd place, and pays it once', async () => {
    const occ = activeEvent(content, HALLOWEEN)!;
    const { store, clock } = await make(memoryEventRanking({ others: { [occ.key]: [9000, 100, 50] } }));
    clock.advance(AFTER - HALLOWEEN);
    store.getState().stamp(); // settles: the event rolls over
    await flush(); await flush();
    const pr = store.getState().pendingRank!;
    expect(pr).toMatchObject({ key: occ.key, name: occ.name, special: true, standing: { rank: 2, total: 4 } });
    expect(pr.prize).toBe(RANK_PRIZES.special[1]);
    const v0 = store.getState().state.vouchers;
    const s0 = store.getState().state.seals;
    store.getState().collectRankPrize();
    expect(store.getState().state.vouchers - v0).toBe(350);
    expect(store.getState().state.seals - s0).toBe(100);
    expect(store.getState().pendingRank).toBeNull();
    expect(store.getState().state.rankPending).toEqual([]);
    store.getState().collectRankPrize();
    expect(store.getState().state.vouchers - v0).toBe(350);
    store.getState().stopLoop();
  });

  it('waits when the ranking server is unreachable instead of paying a guess', async () => {
    const { store, clock } = await make(memoryEventRanking({ fail: true }));
    clock.advance(AFTER - HALLOWEEN);
    store.getState().stamp();
    await flush(); await flush();
    expect(store.getState().pendingRank).toBeNull();
    expect(store.getState().state.rankPending).toHaveLength(1);
    store.getState().stopLoop();
  });
});

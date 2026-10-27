import { createGameStore } from './game';
import { memoryStorage } from '../platform/storage';
import { fakeClock } from '../engine/time';
import { content } from '../data';
import { memoryCases } from '../platform/cases';
import { CASE_VOUCHERS } from '../engine/cases';

const T0 = Date.UTC(2026, 9, 27, 12, 0, 0);

async function make(opts: Parameters<typeof memoryCases>[0] = {}) {
  const cases = memoryCases(opts);
  const clock = fakeClock({ wall: T0, mono: 100_000 });
  const store = createGameStore({ content, storage: memoryStorage(), clock, tickMs: 1_000_000, autosaveMs: 1_000_000, cases });
  await store.getState().boot();
  return { store, cases, clock };
}

describe('Case of the Day in the store', () => {
  it('rules once, pays once, and reports the shares', async () => {
    const { store, cases } = await make({ seed: { hell: 62, heaven: 37 } });
    const before = store.getState().state.vouchers;
    expect(await store.getState().ruleCase('c-gus', 'hell')).toBe(true);
    const s = store.getState();
    expect(s.state.vouchers - before).toBe(CASE_VOUCHERS);
    expect(s.caseInfo.tally).toEqual({ heaven: 37, hell: 63, reincarnate: 0 });
    expect(s.state.cases.archive[0]).toMatchObject({ caseId: 'c-gus', verdict: 'hell', majority: 'hell' });
    expect(cases.votes.get('2026-10-27')).toBe('hell');
    expect(await s.ruleCase('c-gus', 'heaven')).toBe(false);
    expect(store.getState().state.vouchers - before).toBe(CASE_VOUCHERS);
  });

  it('still pays with no connection, with no results to show', async () => {
    const { store } = await make({ fail: true });
    const before = store.getState().state.vouchers;
    expect(await store.getState().ruleCase('c-gus', 'heaven')).toBe(true);
    expect(store.getState().state.vouchers - before).toBe(CASE_VOUCHERS);
    expect(store.getState().caseInfo.tally).toBeNull();
    expect(store.getState().state.cases.archive[0].majority).toBeNull();
  });

  it('opening the file clears the unread dot once', async () => {
    const { store, clock } = await make();
    store.getState().openCase();
    expect(store.getState().state.cases.seenDay).toBe('2026-10-27');
    clock.advance(86_400_000);
    expect(await store.getState().ruleCase('c-noor', 'reincarnate')).toBe(true);
  });
});

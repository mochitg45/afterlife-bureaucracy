import { createGameStore } from './game';
import { memoryStorage, SAVE_KEY } from '../platform/storage';
import { fakeClock } from '../engine/time';
import { content } from '../data';
import { createInitialState, serialize, type GameState } from '../engine/state';
import { memoryReferral, parseReferrer, referralLink, newCode } from '../platform/referral';
import { memorySharer } from '../platform/share';

const T0 = new Date(2026, 8, 16, 9).getTime();

async function make(opts: { saved?: Partial<GameState>; referral?: Parameters<typeof memoryReferral>[0]; share?: boolean } = {}) {
  const storage = memoryStorage();
  if (opts.saved) await storage.set(SAVE_KEY, serialize({ ...createInitialState({ wall: T0, mono: 0 }, content), ...opts.saved }));
  const referral = memoryReferral(opts.referral);
  const sharer = memorySharer(opts.share ?? true);
  const store = createGameStore({
    content, storage, clock: fakeClock({ wall: T0, mono: 0 }), tickMs: 1_000_000, autosaveMs: 1_000_000,
    referral, sharer,
  });
  await store.getState().boot();
  return { store, referral, sharer };
}

const base = createInitialState({ wall: T0, mono: 0 }, content).referral;

describe('referral platform helpers', () => {
  it('builds the Play link and parses the referrer back', () => {
    const link = referralLink('ABCD2345');
    expect(link).toBe('https://play.google.com/store/apps/details?id=com.afterlifebureaucracy.game&referrer=ref%3DABCD2345');
    expect(parseReferrer('ref=ABCD2345')).toBe('ABCD2345');
    expect(parseReferrer('utm_source=google-play&ref=ABCD2345')).toBe('ABCD2345');
    expect(parseReferrer('ref=abcd2345')).toBeNull();
    expect(parseReferrer('ref=ABCD234')).toBeNull();
    expect(parseReferrer(null)).toBeNull();
  });
  it('mints 8-char codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) expect(newCode()).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
  });
});

describe('referral in the store', () => {
  it('registers a join once on boot and records it', async () => {
    const { store, referral } = await make({ referral: { join: 'joined' } });
    await vi.waitFor(() => expect(store.getState().state.referral.joined).toBe(true));
    expect(store.getState().state.referral.joinChecked).toBe(true);
    expect(referral.registerCalls).toBe(1);
  });

  it('retries a failed join next launch (nothing is recorded)', async () => {
    const { store, referral } = await make({ referral: { fail: true } });
    await vi.waitFor(() => expect(referral.registerCalls).toBe(1));
    expect(store.getState().state.referral.joinChecked).toBe(false);
  });

  it('qualifies a joined install that has already audited', async () => {
    const { store, referral } = await make({
      saved: { referral: { ...base, joinChecked: true, joined: true }, stats: { ...createInitialState({ wall: T0, mono: 0 }, content).stats, audits: 1 } },
    });
    await vi.waitFor(() => expect(store.getState().state.referral.qualified).toBe(true));
    expect(referral.qualifiedCalls).toBe(1);
  });

  it('never calls out for an install that was not invited', async () => {
    const { store, referral } = await make({ saved: { referral: { ...base, joinChecked: true } } });
    await store.getState().refreshReferral();
    expect(referral.registerCalls).toBe(0);
    expect(referral.qualifiedCalls).toBe(0);
  });

  it('shares with the link and pays 10 vouchers once ever', async () => {
    const { store, sharer } = await make({ referral: { code: 'ABCD2345' } });
    await store.getState().refreshReferral();
    expect(store.getState().referralInfo.code).toBe('ABCD2345');
    expect(await store.getState().shareInvite()).toBe(true);
    expect(store.getState().state.vouchers).toBe(10);
    expect(sharer.shared[0]).toContain(referralLink('ABCD2345'));
    await store.getState().shareInvite();
    expect(store.getState().state.vouchers).toBe(10);
  });

  it('pays nothing when the share sheet is cancelled', async () => {
    const { store } = await make({ share: false });
    await store.getState().refreshReferral();
    expect(await store.getState().shareInvite()).toBe(false);
    expect(store.getState().state.vouchers).toBe(0);
    expect(store.getState().state.referral.shareRewarded).toBe(false);
  });

  it('claims invite tiers by the server count, once each', async () => {
    const { store } = await make({ referral: { joined: 5 } });
    await store.getState().refreshReferral();
    store.getState().claimReferralTier(10); // not reached
    store.getState().claimReferralTier(3);
    store.getState().claimReferralTier(3);
    store.getState().claimReferralTier(5);
    expect(store.getState().state.vouchers).toBe(100);
    expect(store.getState().state.referral.claimedTiers).toEqual([3, 5]);
  });

  it('shows the error state when the backend is unreachable, and stays playable', async () => {
    const { store } = await make({ referral: { fail: true } });
    await store.getState().refreshReferral();
    expect(store.getState().referralInfo.status).toBe('error');
    expect(await store.getState().shareInvite()).toBe(false);
  });
});

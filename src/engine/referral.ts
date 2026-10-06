import type { GameState } from './state';

/** Vouchers for sharing the game once, ever. */
export const SHARE_REWARD = 10;

/** Invite tiers: `friends` genuine joins pay `vouchers`, once each. */
export const REFERRAL_TIERS: ReadonlyArray<{ friends: number; vouchers: number }> = [
  { friends: 3, vouchers: 40 },
  { friends: 5, vouchers: 60 },
  { friends: 10, vouchers: 150 },
];

export function tierFor(friends: number) {
  return REFERRAL_TIERS.find((t) => t.friends === friends);
}

/** Tiers the player has reached by `count` genuine joins and not yet taken. */
export function claimableTiers(state: GameState, count: number): number[] {
  return REFERRAL_TIERS.filter((t) => count >= t.friends && !state.referral.claimedTiers.includes(t.friends)).map((t) => t.friends);
}

/** The first tier above `count`, or null once the last is reached; the progress bar aims at it. */
export function nextTier(count: number) {
  return REFERRAL_TIERS.find((t) => count < t.friends) ?? null;
}

/** Pays a tier once. Returned by identity when it is unknown, not yet reached or already taken. */
export function claimTier(state: GameState, friends: number, count: number): GameState {
  const tier = tierFor(friends);
  if (!tier || !claimableTiers(state, count).includes(friends)) return state;
  return {
    ...state,
    vouchers: state.vouchers + tier.vouchers,
    referral: { ...state.referral, claimedTiers: [...state.referral.claimedTiers, friends] },
  };
}

/** Pays the share reward once ever. Returned by identity if it was already paid. */
export function grantShareReward(state: GameState): GameState {
  if (state.referral.shareRewarded) return state;
  return { ...state, vouchers: state.vouchers + SHARE_REWARD, referral: { ...state.referral, shareRewarded: true } };
}

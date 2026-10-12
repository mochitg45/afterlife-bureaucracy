import type { GameState } from './state';
import { grantVouchersExact } from './vouchers';
import { grantEventVouchers } from './events';

export type LoginReward = { type: 'vouchers' | 'seals' | 'eventVouchers'; amount: number };

/** The 7-day check-in strip. A missed day pauses it rather than resetting it; after day 7 it starts over. */
export const LOGIN_REWARDS: readonly LoginReward[] = [
  { type: 'vouchers', amount: 5 },
  { type: 'seals', amount: 5 },
  { type: 'vouchers', amount: 10 },
  { type: 'eventVouchers', amount: 10 },
  { type: 'seals', amount: 10 },
  { type: 'vouchers', amount: 10 },
  { type: 'vouchers', amount: 30 },
];

/**
 * Today is the dailies' day, so the check-in follows the same rollover (and the same
 * clock-tamper guard) as the office tasks.
 */
export function loginClaimable(state: Pick<GameState, 'login' | 'dailies'>): boolean {
  return state.dailies.date !== '' && state.login.lastDate !== state.dailies.date;
}

export function claimLogin(state: GameState): { state: GameState; reward: LoginReward | null } {
  if (!loginClaimable(state)) return { state, reward: null };
  const reward = LOGIN_REWARDS[state.login.day];
  const paid = reward.type === 'vouchers' ? grantVouchersExact(state, reward.amount)
    : reward.type === 'seals' ? { ...state, seals: state.seals + reward.amount }
    : grantEventVouchers(state, 'weekly', reward.amount);
  return { state: { ...paid, login: { day: (state.login.day + 1) % LOGIN_REWARDS.length, lastDate: state.dailies.date } }, reward };
}

import type { GameState } from './state';
import type { Content } from './content';
import { perkSum } from './perks';
import { cardVoucherMult } from './gacha';

export function voucherMult(state: GameState, content: Content): number {
  return 1 + perkSum(state, content, 'voucherMult') + cardVoucherMult(state, content);
}

/**
 * Grants `base` vouchers at the player's multiplier, carrying the sub-voucher remainder in
 * `voucherFraction` rather than rounding each grant up: at a 1.1x multiplier, rounding up
 * would pay 2 vouchers for every 1 earned and double the faucet the multiplier advertises.
 */
export function grantVouchers(state: GameState, content: Content, base: number): GameState {
  if (base <= 0) return state;
  const total = base * voucherMult(state, content) + state.voucherFraction;
  // The epsilon absorbs float drift (0.1 x 10 lands just under 1.0), so a remainder that has
  // genuinely reached a whole voucher is paid out on this grant rather than the next one.
  const whole = Math.floor(total + 1e-9);
  return { ...state, vouchers: state.vouchers + whole, voucherFraction: Math.max(0, total - whole) };
}

/**
 * A flat, unmultiplied grant: purchased or rewarded vouchers are a fixed quantity, so they
 * neither take the voucher multiplier nor touch the carried remainder.
 */
export function grantVouchersExact(state: GameState, amount: number): GameState {
  if (amount <= 0) return state;
  return { ...state, vouchers: state.vouchers + Math.floor(amount) };
}

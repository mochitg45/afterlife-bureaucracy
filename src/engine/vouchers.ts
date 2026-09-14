import type { GameState } from './state';
import type { Content } from './content';
import { perkSum } from './perks';
import { cardVoucherMult } from './gacha';

export function voucherMult(state: GameState, content: Content): number {
  return 1 + perkSum(state, content, 'voucherMult') + cardVoucherMult(state, content);
}

export function grantVouchers(state: GameState, content: Content, base: number): GameState {
  if (base <= 0) return state;
  return { ...state, vouchers: state.vouchers + Math.ceil(base * voucherMult(state, content) - 1e-9) };
}

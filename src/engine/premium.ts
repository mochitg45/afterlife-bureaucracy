import type { GameState } from './state';
import type { ProductId } from '../platform/billing';

/**
 * Premium staff: paid-only hires, bought once through a bundle and kept for good (they live
 * in `entitlements`, so no audit or reset takes them). One premium slot: owning several
 * means choosing who is on duty, so each new one is still worth buying.
 */
export interface PremiumStaffDef {
  id: string;
  product: ProductId;
  /** Added to the global multiplier while on duty: 0.25 = +25% on everything. */
  globalMult: number;
  /** Vouchers that come with the bundle, paid once per purchase. */
  vouchers: number;
}

export const PREMIUM_STAFF: readonly PremiumStaffDef[] = [
  { id: 'cerberus', product: 'cerberus_bundle', globalMult: 0.25, vouchers: 300 },
];

export const premiumDef = (id: string | undefined): PremiumStaffDef | undefined => PREMIUM_STAFF.find((p) => p.id === id);
export const premiumForProduct = (id: ProductId): PremiumStaffDef | undefined => PREMIUM_STAFF.find((p) => p.product === id);

type Holder = Pick<GameState, 'entitlements'>;

export const ownsPremium = (s: Holder, id: string): boolean => (s.entitlements.premium ?? []).includes(id);
export const premiumOnDuty = (s: Holder): PremiumStaffDef | undefined => {
  const id = s.entitlements.premiumOn;
  return id && ownsPremium(s, id) ? premiumDef(id) : undefined;
};

/** The on-duty premium staff's slice of the global multiplier; 1 with the slot empty. */
export const premiumGlobalMult = (s: Holder): number => 1 + (premiumOnDuty(s)?.globalMult ?? 0);

/** Adds premium staff to what the player owns; the first one ever owned goes straight on duty. */
export function grantPremium<S extends Holder>(s: S, ids: readonly string[]): S {
  const held = s.entitlements.premium ?? [];
  const add = ids.filter((id) => premiumDef(id) && !held.includes(id));
  if (!add.length) return s;
  const premium = [...held, ...add];
  const premiumOn = s.entitlements.premiumOn && premium.includes(s.entitlements.premiumOn) ? s.entitlements.premiumOn : add[0];
  return { ...s, entitlements: { ...s.entitlements, premium, premiumOn } };
}

/** Puts an owned premium staff on duty, or empties the slot with null. Refuses (same state) if not owned. */
export function equipPremium<S extends Holder>(s: S, id: string | null): S {
  if (id !== null && !ownsPremium(s, id)) return s;
  const premiumOn = id ?? '';
  if ((s.entitlements.premiumOn ?? '') === premiumOn) return s;
  return { ...s, entitlements: { ...s.entitlements, premiumOn } };
}

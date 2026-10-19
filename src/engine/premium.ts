import type { GameState } from './state';
import type { ProductId } from '../platform/billing';

/**
 * Premium staff and pets: paid-only hires, bought once through a bundle and kept for good
 * (they live in `entitlements`, so no audit or reset takes them). Two slots, each holding
 * one at a time: the premium slot (Cerberus) and the pet slot (Pumpkat), so a pet works
 * alongside premium staff instead of replacing it.
 */
export type PremiumSlot = 'premium' | 'pet';

export interface PremiumStaffDef {
  id: string;
  product: ProductId;
  slot: PremiumSlot;
  /** Added to the global multiplier while on duty: 0.25 = +25% on everything. */
  globalMult: number;
  /** Event-currency multiplier while on duty (2 = double); 1 when absent. */
  eventMult?: number;
  /** Vouchers that come with the bundle, paid once per purchase. */
  vouchers: number;
  /** Limited sale: only on offer while this event (by id) is running. Owners keep it for good. */
  saleEvent?: string;
}

export const PREMIUM_STAFF: readonly PremiumStaffDef[] = [
  { id: 'cerberus', product: 'cerberus_bundle', slot: 'premium', globalMult: 0.25, vouchers: 300 },
  { id: 'pumpkat', product: 'pumpkat_bundle', slot: 'pet', globalMult: 0.15, eventMult: 2, vouchers: 0, saleEvent: 'halloween' },
];

export const premiumDef = (id: string | undefined): PremiumStaffDef | undefined => PREMIUM_STAFF.find((p) => p.id === id);
export const premiumForProduct = (id: ProductId): PremiumStaffDef | undefined => PREMIUM_STAFF.find((p) => p.product === id);

type Holder = Pick<GameState, 'entitlements'>;

const slotKey = (slot: PremiumSlot): 'petOn' | 'premiumOn' => (slot === 'pet' ? 'petOn' : 'premiumOn');

export const ownsPremium = (s: Holder, id: string): boolean => (s.entitlements.premium ?? []).includes(id);

/** Who is in a slot right now (premium staff by default, or the pet). */
export function onDutyIn(s: Holder, slot: PremiumSlot): PremiumStaffDef | undefined {
  const id = s.entitlements[slotKey(slot)];
  const def = id && ownsPremium(s, id) ? premiumDef(id) : undefined;
  return def?.slot === slot ? def : undefined;
}
export const premiumOnDuty = (s: Holder): PremiumStaffDef | undefined => onDutyIn(s, 'premium');
export const petOnDuty = (s: Holder): PremiumStaffDef | undefined => onDutyIn(s, 'pet');

/** Everyone on duty across both slots's slice of the global multiplier; 1 with both empty. */
export const premiumGlobalMult = (s: Holder): number =>
  (1 + (premiumOnDuty(s)?.globalMult ?? 0)) * (1 + (petOnDuty(s)?.globalMult ?? 0));

/** Event-currency multiplier from whoever is on duty (Pumpkat doubles it). */
export const premiumEventMult = (s: Holder): number =>
  (premiumOnDuty(s)?.eventMult ?? 1) * (petOnDuty(s)?.eventMult ?? 1);

/** A limited item is on sale only while its event runs; everything else always is. */
export const onSale = (def: PremiumStaffDef, runningEventId: string | null | undefined): boolean =>
  !def.saleEvent || def.saleEvent === runningEventId;

/** Adds premium staff to what the player owns; the first one owned for an empty slot goes straight on duty. */
export function grantPremium<S extends Holder>(s: S, ids: readonly string[]): S {
  const held = s.entitlements.premium ?? [];
  const add = ids.filter((id) => premiumDef(id) && !held.includes(id));
  if (!add.length) return s;
  const premium = [...held, ...add];
  const ent = { ...s.entitlements, premium };
  for (const id of add) {
    const key = slotKey(premiumDef(id)!.slot);
    const cur = ent[key];
    if (!cur || !premium.includes(cur)) ent[key] = id;
  }
  return { ...s, entitlements: ent };
}

/**
 * Puts an owned premium staff or pet in its slot, or empties `slot` with null. Refuses
 * (same state) if not owned or the id belongs in the other slot.
 */
export function equipPremium<S extends Holder>(s: S, id: string | null, slot: PremiumSlot = 'premium'): S {
  if (id !== null && (!ownsPremium(s, id) || premiumDef(id)?.slot !== slot)) return s;
  const key = slotKey(slot);
  const next = id ?? '';
  if ((s.entitlements[key] ?? '') === next) return s;
  return { ...s, entitlements: { ...s.entitlements, [key]: next } };
}

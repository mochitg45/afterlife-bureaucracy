import { describe, expect, it } from 'vitest';
import { createInitialState } from './state';
import { content } from '../data';
import { applyPurchase } from './entitlements';
import { globalMult } from './economy';
import { equipPremium, grantPremium, onSale, petOnDuty, premiumDef, premiumEventMult, premiumGlobalMult, premiumOnDuty } from './premium';
import Decimal from 'break_infinity.js';

const fresh = () => createInitialState({ wall: 0, mono: 0 }, content);

describe('premium staff', () => {
  it('the Cerberus bundle grants Cerberus on duty plus 300 vouchers', () => {
    const s = fresh();
    const out = applyPurchase(s, content, 'cerberus_bundle', 0, new Decimal(0));
    expect(out.entitlements.premium).toEqual(['cerberus']);
    expect(premiumOnDuty(out)?.id).toBe('cerberus');
    expect(out.vouchers).toBe(s.vouchers + 300);
  });
  it('gives +25% to everything only while on duty', () => {
    const s = grantPremium(fresh(), ['cerberus']);
    expect(premiumGlobalMult(s)).toBeCloseTo(1.25);
    expect(globalMult(s, content, 0).div(globalMult(fresh(), content, 0)).toNumber()).toBeCloseTo(1.25);
    const off = equipPremium(s, null);
    expect(premiumGlobalMult(off)).toBe(1);
    expect(premiumOnDuty(equipPremium(off, 'cerberus'))?.id).toBe('cerberus');
  });
  it('the pet fills its own slot next to Cerberus: +15% on top, and x2 event currency', () => {
    const s = grantPremium(grantPremium(fresh(), ['cerberus']), ['pumpkat']);
    expect(premiumOnDuty(s)?.id).toBe('cerberus');
    expect(petOnDuty(s)?.id).toBe('pumpkat');
    expect(premiumGlobalMult(s)).toBeCloseTo(1.25 * 1.15);
    expect(premiumEventMult(s)).toBe(2);
    // A pet can't take the premium slot, and the pet slot empties on its own.
    expect(equipPremium(s, 'pumpkat', 'premium')).toBe(s);
    expect(premiumEventMult(equipPremium(s, null, 'pet'))).toBe(1);
  });
  it('the pet is on sale only while Halloween runs', () => {
    const pet = premiumDef('pumpkat')!;
    expect(onSale(pet, 'halloween')).toBe(true);
    expect(onSale(pet, 'christmas')).toBe(false);
    expect(onSale(pet, null)).toBe(false);
    expect(onSale(premiumDef('cerberus')!, null)).toBe(true);
  });
  it('cannot put on duty a premium staff the player does not own', () => {
    const s = fresh();
    expect(equipPremium(s, 'cerberus')).toBe(s);
    expect(premiumGlobalMult(s)).toBe(1);
  });
});

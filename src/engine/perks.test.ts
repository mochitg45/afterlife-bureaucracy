import { createInitialState } from './state';
import { content } from '../data';
import { hasPerk, canBuyPerk, perkSum, perkGlobalMult, perkDeptMult, headStart } from './perks';
import { buyPerk } from './actions';

const now = { wall: 0, mono: 0 };
const base = () => createInitialState(now, content);

describe('perk ownership and purchase rules', () => {
  it('root perk needs only seals', () => {
    const s = { ...base(), seals: 1 };
    expect(canBuyPerk(s, content, 'throughput-1')).toEqual({ ok: true });
    expect(canBuyPerk({ ...s, seals: 0 }, content, 'throughput-1')).toEqual({ ok: false, reason: 'seals' });
  });
  it('child perk is locked until prerequisites are owned', () => {
    const s = { ...base(), seals: 50 };
    expect(canBuyPerk(s, content, 'throughput-2')).toEqual({ ok: false, reason: 'locked' });
    expect(canBuyPerk({ ...s, perks: ['throughput-1'] }, content, 'throughput-2')).toEqual({ ok: true });
  });
  it('owned perks cannot be bought again', () => {
    const s = { ...base(), seals: 50, perks: ['throughput-1'] };
    expect(canBuyPerk(s, content, 'throughput-1')).toEqual({ ok: false, reason: 'owned' });
  });
  it('buyPerk deducts seals and records the perk; refuses otherwise', () => {
    const s0 = { ...base(), seals: 3 };
    const s1 = buyPerk(s0, content, 'throughput-1');
    expect(s1.seals).toBe(2);
    expect(hasPerk(s1, 'throughput-1')).toBe(true);
    expect(buyPerk(s1, content, 'throughput-3')).toBe(s1);
    expect(s0.perks).toEqual([]);
  });
});

describe('canBuyPerk wallet', () => {
  it('needs only the Seal count and the owned perk list', () => {
    // The Perk Ledger UI subscribes to these two fields alone, so the check must not
    // reach for anything else on GameState.
    expect(canBuyPerk({ seals: 1, perks: [] }, content, 'throughput-1')).toEqual({ ok: true });
    expect(canBuyPerk({ seals: 0, perks: [] }, content, 'throughput-1')).toEqual({ ok: false, reason: 'seals' });
    expect(canBuyPerk({ seals: 99, perks: ['throughput-1'] }, content, 'throughput-1')).toEqual({ ok: false, reason: 'owned' });
    expect(canBuyPerk({ seals: 99, perks: [] }, content, 'throughput-2')).toEqual({ ok: false, reason: 'locked' });
  });
});

describe('perk effects', () => {
  it('sums additive effects by type', () => {
    const s = { ...base(), perks: ['overtime-1', 'overtime-2', 'stapler-1', 'stapler-2'] };
    expect(perkSum(s, content, 'offlineCapHours')).toBe(12);
    expect(perkSum(s, content, 'click')).toBe(7);
    expect(perkSum(s, content, 'equipSlots')).toBe(0);
  });
  it('compounds global multipliers', () => {
    const s = { ...base(), perks: ['throughput-1', 'throughput-2'] };
    expect(perkGlobalMult(s, content).toNumber()).toBeCloseTo(1.1 * 1.15);
    expect(perkGlobalMult(base(), content).toNumber()).toBe(1);
  });
  it('applies department multipliers only to their department', () => {
    const s = { ...base(), perks: ['throughput-4'] };
    expect(perkDeptMult(s, content, 'intake').toNumber()).toBeCloseTo(1.5);
    expect(perkDeptMult(s, content, 'heaven').toNumber()).toBe(1);
  });
  it('collects head-start departments and staff', () => {
    const s = { ...base(), perks: ['headstart-1', 'headstart-2', 'headstart-3'] };
    expect(headStart(s, content)).toEqual({ depts: ['heaven'], staff: { dave: 10, seraphine: 10 } });
  });
});

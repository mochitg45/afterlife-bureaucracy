import Decimal from 'break_infinity.js';
import { createInitialState, serialize, deserialize } from './state';
import { migrate, SAVE_VERSION } from './migrations';
import { content } from '../data';
import {
  perkLevel, upgradeCost, canUpgradePerk, upgradePerk, perkGlobalMult, perkSum, perkUpgradable,
  levelScale, MAX_PERK_LEVEL, UPGRADE_GROWTH,
} from './perks';
import { findPerk } from './content';
import { globalMult } from './economy';
import { fileCosmic, canCosmic, cosmicThreshold } from './cosmic';
import { auditThreshold, canAudit, COSMIC_AUDIT_LOG10, TAPER_FY } from './prestige';

const now = { wall: 0, mono: 0 };
const base = () => createInitialState(now, content);
const owned = (seals: number) => ({ ...base(), seals, perks: ['throughput-1'] });

describe('perk levels', () => {
  it('an owned perk is level 1, an unowned one level 0', () => {
    expect(perkLevel(owned(0), 'throughput-1')).toBe(1);
    expect(perkLevel(owned(0), 'throughput-2')).toBe(0);
  });
  it('costs perk.cost x 2^(level-1) and scales the effect by 25% of base per level', () => {
    const p = findPerk(content, 'throughput-1'); // cost 6, +10%
    expect(upgradeCost(p, 1)).toBe(6);
    expect(upgradeCost(p, 2)).toBe(6 * UPGRADE_GROWTH);
    expect(upgradeCost(p, 5)).toBe(6 * UPGRADE_GROWTH ** 4);
    expect(levelScale(1)).toBe(1);
    expect(levelScale(5)).toBeCloseTo(2);
  });
  it('upgrades through the checks: unowned, seals, max, fixed effects', () => {
    expect(canUpgradePerk(owned(100), content, 'throughput-2')).toEqual({ ok: false, reason: 'unowned' });
    expect(canUpgradePerk(owned(5), content, 'throughput-1')).toEqual({ ok: false, reason: 'seals' });
    expect(canUpgradePerk(owned(6), content, 'throughput-1')).toEqual({ ok: true });
    const maxed = { ...owned(1e9), perkLevels: { 'throughput-1': MAX_PERK_LEVEL } };
    expect(canUpgradePerk(maxed, content, 'throughput-1')).toEqual({ ok: false, reason: 'max' });
    const slots = { ...base(), seals: 1e9, perks: ['requisition-3'] };
    expect(perkUpgradable(findPerk(content, 'requisition-3'))).toBe(false);
    expect(canUpgradePerk(slots, content, 'requisition-3')).toEqual({ ok: false, reason: 'fixed' });
  });
  it('upgradePerk spends seals, records the level and the invested total', () => {
    const s = upgradePerk(owned(20), content, 'throughput-1');
    expect(s.seals).toBe(14);
    expect(s.sealsInvested).toBe(6);
    expect(perkLevel(s, 'throughput-1')).toBe(2);
    const s3 = upgradePerk(s, content, 'throughput-1'); // 12 more
    expect(s3.seals).toBe(2);
    expect(perkLevel(s3, 'throughput-1')).toBe(3);
  });
  it('returns the same state when refused', () => {
    const s = owned(1);
    expect(upgradePerk(s, content, 'throughput-1')).toBe(s);
    expect(upgradePerk(owned(99), content, 'throughput-2')).toEqual(owned(99));
  });
  it('raises the effect through the same multiplicative combination', () => {
    const lvl3 = { ...owned(0), perkLevels: { 'throughput-1': 3 } };
    expect(perkGlobalMult(lvl3, content).toNumber()).toBeCloseTo(1 + 0.1 * 1.5);
    const clicks = { ...base(), perks: ['stapler-1', 'stapler-2'], perkLevels: { 'stapler-2': 5 } };
    expect(perkSum(clicks, content, 'click')).toBeCloseTo(2 + 5 * 2);
  });
  it('does not lower output when seals are spent: invested seals keep the Seal bonus', () => {
    const before = owned(20);
    const after = upgradePerk(before, content, 'throughput-1');
    const ratio = globalMult(after, content, 0).div(globalMult(before, content, 0)).toNumber();
    // Seal bonus unchanged (20 seals' worth), perk 1.1 -> 1.125.
    expect(ratio).toBeCloseTo(1.125 / 1.1);
  });
  it('a Cosmic Restructuring clears levels and the invested total with the perks', () => {
    const s = { ...owned(cosmicThreshold(0)), perkLevels: { 'throughput-1': 4 }, sealsInvested: 99 };
    const r = fileCosmic(s, content, 0).state;
    expect(r.perks).toEqual([]);
    expect(r.perkLevels).toEqual({});
    expect(r.sealsInvested).toBe(0);
    expect(r.seals).toBe(0);
  });
  it('seals sunk into levels still count toward the Cosmic threshold', () => {
    const t = cosmicThreshold(0);
    expect(canCosmic({ seals: t - 10, stats: { cosmics: 0 } })).toBe(false);
    expect(canCosmic({ seals: t - 10, sealsInvested: 10, stats: { cosmics: 0 } })).toBe(true);
  });
});

describe('perk level persistence', () => {
  it('round-trips levels and invested seals', () => {
    const s = { ...owned(0), perkLevels: { 'throughput-1': 6 }, sealsInvested: 190 };
    const back = deserialize(serialize(s), content);
    expect(back.perkLevels).toEqual({ 'throughput-1': 6 });
    expect(back.sealsInvested).toBe(190);
  });
  it('sanitises: drops unowned perks, level 1 entries, junk, and clamps to the cap', () => {
    const raw = JSON.parse(serialize({ ...owned(0), perks: ['throughput-1', 'throughput-2'] }));
    raw.perkLevels = { 'throughput-1': 99, 'throughput-2': 1, 'throughput-3': 4, nope: 3, 'x': 'abc' };
    raw.sealsInvested = -5;
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.perkLevels).toEqual({ 'throughput-1': MAX_PERK_LEVEL });
    expect(s.sealsInvested).toBe(0);
  });
  it('migrates a v10 save: existing perks become level 1', () => {
    const out = migrate({ saveVersion: 10, perks: ['throughput-1'] });
    expect(out.saveVersion).toBe(SAVE_VERSION);
    expect(out.perkLevels).toEqual({});
    expect(out.sealsInvested).toBe(0);
    const s = deserialize(JSON.stringify({ saveVersion: 10, resetEpoch: 1, perks: ['throughput-1'] }), content);
    expect(perkLevel(s, 'throughput-1')).toBe(1);
  });
});

describe('audit threshold after Restructurings', () => {
  it('is unchanged for a first-cycle player and for the early fiscal years', () => {
    expect(auditThreshold(1, 0).eq(auditThreshold(1))).toBe(true);
    expect(auditThreshold(1, 5).eq(auditThreshold(1))).toBe(true); // ramp: no extra in year 1
    expect(auditThreshold(TAPER_FY, 0).gt(auditThreshold(TAPER_FY - 1, 0))).toBe(true);
  });
  it('grows with every fiscal year, at every Restructuring count, and with the count', () => {
    for (let c = 0; c < COSMIC_AUDIT_LOG10.length + 2; c++) {
      for (let fy = 1; fy < 200; fy++) {
        expect(auditThreshold(fy + 1, c).gt(auditThreshold(fy, c))).toBe(true);
      }
    }
    expect(auditThreshold(40, 3).gt(auditThreshold(40, 1))).toBe(true);
  });
  it('canAudit reads the Restructuring count from the state', () => {
    const need = auditThreshold(30, 2);
    const s = { soulsRun: need.div(10), fiscalYear: 30, stats: { cosmics: 0 } };
    expect(canAudit(s)).toBe(true);
    expect(canAudit({ ...s, stats: { cosmics: 2 } })).toBe(false);
    expect(canAudit({ ...s, soulsRun: new Decimal(need), stats: { cosmics: 2 } })).toBe(true);
  });
});

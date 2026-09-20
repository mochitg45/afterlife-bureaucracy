import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import {
  pull,
  rollRarity,
  equipCard,
  unequipCard,
  equipSlots,
  cardGlobalMult,
  cardDeptMult,
  cardClickMult,
  cardOfflineCapHours,
  ODDS,
  PITY_SENIOR,
  PITY_EXECUTIVE,
  PULL_COST,
  TEN_PULL_COST,
} from './gacha';

const now = { wall: 0, mono: 0 };
const base = () => ({ ...createInitialState(now, content), vouchers: 100, rngSeed: 7 });
const rate = new Decimal(10);

describe('economy constants (playtest round 1)', () => {
  it('prices pulls at 10 / 90 and sums the new odds to 1', () => {
    expect(PULL_COST).toBe(10);
    expect(TEN_PULL_COST).toBe(90);
    expect(ODDS).toEqual({ temp: 0.7, fulltime: 0.245, senior: 0.05, executive: 0.005 });
    const sum = Object.values(ODDS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe('rollRarity', () => {
  it('matches published odds over 100k rolls (no pity)', () => {
    let seed = 99;
    const counts = { temp: 0, fulltime: 0, senior: 0, executive: 0 };
    for (let i = 0; i < 100_000; i++) {
      const r = rollRarity(seed, { senior: 0, executive: 0 });
      seed = r.seed;
      counts[r.rarity]++;
    }
    for (const k of Object.keys(ODDS) as Array<keyof typeof ODDS>) expect(counts[k] / 100_000).toBeCloseTo(ODDS[k], 2);
  });
  it('forces senior+ on the 10th pull and executive on the 60th', () => {
    expect(['senior', 'executive']).toContain(rollRarity(1, { senior: PITY_SENIOR - 1, executive: 0 }).rarity);
    expect(rollRarity(1, { senior: 0, executive: PITY_EXECUTIVE - 1 }).rarity).toBe('executive');
  });
  it('never reports a pity trigger when no pity threshold is met', () => {
    let seed = 123;
    for (let i = 0; i < 1000; i++) {
      const r = rollRarity(seed, { senior: 0, executive: 0 });
      seed = r.seed;
      expect(r.pityTriggered).toBeNull();
    }
  });
});

describe('pull', () => {
  it('charges 10 per single and 90 per ten, advances the seed, records stats, never mutates', () => {
    const s0 = base();
    const one = pull(s0, content, 1, rate);
    expect(one.state.vouchers).toBe(90);
    expect(one.results).toHaveLength(1);
    expect(one.state.rngSeed).not.toBe(s0.rngSeed);
    expect(one.state.stats.pulls).toBe(1);
    const ten = pull(s0, content, 10, rate);
    expect(ten.state.vouchers).toBe(10);
    expect(ten.results).toHaveLength(10);
    expect(s0.vouchers).toBe(100);
  });
  it('draws a free single without spending a voucher', () => {
    const s0 = { ...base(), vouchers: 0 };
    const free = pull(s0, content, 1, rate, { free: true });
    expect(free.results).toHaveLength(1);
    expect(free.state.vouchers).toBe(0);
    expect(free.state.stats.pulls).toBe(1);
  });
  it('refuses when vouchers are short', () => {
    const s0 = { ...base(), vouchers: 8 };
    expect(pull(s0, content, 10, rate).state).toBe(s0);
    const s1 = { ...base(), vouchers: 0 };
    expect(pull(s1, content, 1, rate).state).toBe(s1);
  });
  it('is reproducible from the seed', () => {
    const a = pull(base(), content, 10, rate).results.map((r) => r.cardId);
    const b = pull(base(), content, 10, rate).results.map((r) => r.cardId);
    expect(a).toEqual(b);
  });
  it('never exceeds 10 pulls without a senior+ and 60 without an executive', () => {
    let s = { ...base(), vouchers: 100_000 };
    let sinceSenior = 0,
      sinceExec = 0;
    for (let i = 0; i < 3000; i++) {
      const r = pull(s, content, 1, rate);
      s = r.state;
      const rar = r.results[0].rarity;
      sinceSenior = rar === 'senior' || rar === 'executive' ? 0 : sinceSenior + 1;
      sinceExec = rar === 'executive' ? 0 : sinceExec + 1;
      expect(sinceSenior).toBeLessThan(PITY_SENIOR);
      expect(sinceExec).toBeLessThan(PITY_EXECUTIVE);
    }
  });
  it('raises stars on duplicates and converts past five stars to KC', () => {
    const one = { ...content, cards: [content.cards[0]] };
    let s = { ...base(), vouchers: 60 };
    for (let i = 0; i < 5; i++) s = pull(s, one, 1, rate).state;
    expect(s.cards[content.cards[0].id]).toBe(5);
    const r = pull(s, one, 1, rate);
    expect(r.state.cards[content.cards[0].id]).toBe(5);
    expect(r.results[0].duplicateKc?.toNumber()).toBe(6000);
    expect(r.state.kc.toNumber()).toBe(6000);
    expect(pull({ ...s, kc: new Decimal(0) }, one, 1, new Decimal(0.01)).results[0].duplicateKc?.toNumber()).toBe(100);
  });
});

describe('equip', () => {
  it('has 3 slots by default, more with perks, max 8', () => {
    const s = base();
    expect(equipSlots(s, content)).toBe(3);
    expect(equipSlots({ ...s, perks: ['requisition-1', 'requisition-3', 'requisition-4'] }, content)).toBe(5);
    expect(
      equipSlots(
        { ...s, perks: ['requisition-1', 'requisition-2', 'requisition-3', 'requisition-4', 'requisition-5', 'requisition-6', 'requisition-7', 'requisition-8'] },
        content,
      ),
    ).toBe(8);
  });
  it('equips owned cards up to the slot limit and unequips', () => {
    const ids = content.cards.slice(0, 4).map((c) => c.id);
    let s = { ...base(), cards: Object.fromEntries(ids.map((id) => [id, 1])) };
    for (const id of ids.slice(0, 3)) s = equipCard(s, content, id);
    expect(s.equipped).toEqual(ids.slice(0, 3));
    expect(equipCard(s, content, ids[3])).toBe(s);
    expect(equipCard(s, content, ids[0])).toBe(s);
    expect(equipCard(s, content, 'c-keeper')).toBe(s);
    expect(s.stats.equips).toBe(3);
    const u = unequipCard(s, ids[1]);
    expect(u.equipped).toEqual([ids[0], ids[2]]);
    expect(unequipCard(u, 'zzz')).toBe(u);
  });
  it('applies only equipped card bonuses scaled by stars', () => {
    const s = {
      ...base(),
      cards: { 'c-seraph-board': 3, 'c-dave-overtime': 2, 'c-temp-stapler': 5, 'c-gary-break': 1 },
      equipped: ['c-seraph-board', 'c-dave-overtime', 'c-temp-stapler'],
    };
    expect(cardGlobalMult(s, content).toNumber()).toBeCloseTo(1 + 0.08 * 3);
    expect(cardDeptMult(s, content, 'intake').toNumber()).toBeCloseTo(1 + 0.05 * 2);
    expect(cardDeptMult(s, content, 'heaven').toNumber()).toBe(1);
    expect(cardClickMult(s, content)).toBeCloseTo(0.02 * 5);
    expect(cardOfflineCapHours(s, content)).toBe(0);
  });
  it('ignores a stale equipped card id instead of throwing', () => {
    const s = { ...base(), cards: { ghost: 3 }, equipped: ['ghost'] };
    expect(() => cardGlobalMult(s, content)).not.toThrow();
    expect(cardGlobalMult(s, content).toNumber()).toBe(1);
  });
});

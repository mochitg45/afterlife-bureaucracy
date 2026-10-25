import { createInitialState } from './state';
import { content } from '../data';
import { computeRates } from './economy';
import { eventRate } from './events';
import { setProgress, completedSets, setBonusMult, SET_BONUS_CAP } from './sets';
import { loadContent } from './content';
import sets from '../data/sets.json';
import cards from '../data/cards.json';

const now = { wall: 0, mono: 0 };
const withCards = (ids: string[]) => ({ ...createInitialState(now, content), cards: Object.fromEntries(ids.map((id) => [id, 1])) });
const night = content.sets.find((s) => s.id === 'night-shift')!;
const gates = content.sets.find((s) => s.id === 'pearly-gates')!;

describe('collection sets data', () => {
  it('has 4-8 sets of 3-6 normal cards, each card in at most one set', () => {
    expect(content.sets.length).toBeGreaterThanOrEqual(4);
    expect(content.sets.length).toBeLessThanOrEqual(8);
    const all = content.sets.flatMap((s) => s.cards);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(content.cards.find((c) => c.id === id)?.event).toBeUndefined();
  });
  it('keeps the total bonus of every kind within the cap', () => {
    const total = (type: string) => content.sets.filter((s) => s.bonus.type === type).reduce((a, s) => a + s.bonus.value, 0);
    for (const type of ['souls', 'click', 'offline']) expect(total(type)).toBeLessThanOrEqual(SET_BONUS_CAP);
  });
  it('rejects a card in two sets, an unknown card and an unknown department', () => {
    const load = (s: unknown[]) => loadContent(content.departments, [], { cards, sets: s });
    expect(() => load([sets[0], { ...sets[1], id: 'dup', cards: sets[0].cards.slice(0, 3) }])).toThrow(/more than one/);
    expect(() => load([{ ...sets[0], cards: ['x', 'y', 'z'] }])).toThrow(/Unknown card/);
    expect(() => load([{ ...sets[0], bonus: { type: 'souls', dept: 'nope', value: 0.05 } }])).toThrow(/Unknown department/);
  });
});

describe('setProgress / completedSets', () => {
  it('counts owned cards at any stars and completes at all of them', () => {
    const partial = withCards(night.cards.slice(0, 2));
    expect(setProgress(partial, night)).toEqual({ have: 2, total: night.cards.length });
    expect(completedSets(partial, content)).toEqual([]);
    expect(completedSets(withCards(night.cards), content).map((s) => s.id)).toEqual(['night-shift']);
  });
});

describe('setBonusMult', () => {
  it('is 1 with nothing complete and applies only the matching kind', () => {
    expect(setBonusMult(withCards([]), content, 'offline')).toBe(1);
    const s = withCards(night.cards);
    expect(setBonusMult(s, content, 'offline')).toBeCloseTo(1.05);
    expect(setBonusMult(s, content, 'click')).toBe(1);
  });
  it('applies a department set to its own department only', () => {
    const s = withCards(gates.cards);
    expect(setBonusMult(s, content, 'souls', 'heaven')).toBeCloseTo(1.05);
    expect(setBonusMult(s, content, 'souls', 'hell')).toBe(1);
  });
  it('raises soul output when complete but never the event rate', () => {
    const none = withCards([]);
    const done = withCards(sets.find((x) => x.id === 'front-desk')!.cards);
    const staff = { dave: 10 };
    const a = computeRates({ ...none, staff }, content, 0).soulsPerSec;
    const b = computeRates({ ...done, staff }, content, 0).soulsPerSec;
    expect(b.div(a).toNumber()).toBeCloseTo(1.03, 5);
    const occ = { key: 'k', staff: [{ id: 's', baseRate: 1 }] } as never;
    const ev = { key: 'k', points: none.kc, earned: none.kc, staff: { s: 5 } } as never;
    expect(eventRate({ ...none, event: ev }, content, occ).toNumber()).toBe(eventRate({ ...done, event: ev }, content, occ).toNumber());
  });
});

import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { content } from '../data';
import { createInitialState, deserialize, serialize, type GameState } from './state';
import { equipCard } from './gacha';
import { globalMult } from './economy';
import { resetRun } from './prestige';
import { grantPremium, petOnDuty } from './premium';
import { MISSION_SLOTS, collectMission, freeCards, missionMult, missionPlace, onMission, recallMission, sanitizeMissions, startMission } from './missions';
import { CARE_MS, MAX_PET_LEVEL, adoptPet, canCare, careWait, givePetCare, petCareMult, petLevel, sanitizePets } from './petcare';
import { DESK_CAP, DESK_PAIRS, deskBonus, deskPairs, deskSeats, sanitizeSeats, seatCard } from './desks';

const T = 1_800_000_000_000;
const fresh = (): GameState => createInitialState({ wall: T, mono: 0 }, content);
const withCards = (...ids: string[]): GameState => ({ ...fresh(), soulsLifetime: new Decimal(1e12), cards: Object.fromEntries(ids.map((id) => [id, 1])) });
const DAVE = 'c-dave-overtime', SERA = 'c-seraphine-chipper', CHOIR = 'c-cherub-choir', IMP = 'c-imp-qa', EXEC = 'c-auditor-true';

describe('Field Missions', () => {
  it('sends only free cards, one team per length, and keeps travellers off the desks', () => {
    const s = equipCard(withCards(DAVE, SERA, CHOIR), content, SERA);
    expect(freeCards(s, content)).toEqual([DAVE, CHOIR]);
    expect(startMission(s, content, 0, [SERA], T)).toBe(s);
    expect(startMission(s, content, 0, [DAVE, CHOIR], T)).toBe(s);
    expect(startMission(s, content, 1, [DAVE, DAVE], T)).toBe(s);
    const out = startMission(s, content, 0, [DAVE], T);
    expect(onMission(out, DAVE)).toBe(true);
    expect(startMission(out, content, 0, [CHOIR], T)).toBe(out);
    expect(startMission(out, content, 1, [DAVE], T)).toBe(out);
    expect(equipCard(out, content, DAVE)).toBe(out);
    expect(equipCard(recallMission(out, 0), content, DAVE).equipped).toContain(DAVE);
  });
  it('pays once, only when the trip is over, and moves on to the next place', () => {
    const s = startMission(withCards(DAVE), content, 0, [DAVE], T);
    const end = T + MISSION_SLOTS[0].ms;
    expect(collectMission(s, content, 0, end - 1, new Decimal(10))).toBeNull();
    const r = collectMission(s, content, 0, end, new Decimal(10))!;
    const mult = missionMult(s, content, 0, 'intake', [DAVE]);
    expect(r.reward.souls.toNumber()).toBeCloseTo(10 * MISSION_SLOTS[0].souls * mult);
    expect(r.state.pets.treats).toBe(s.pets.treats + 1);
    expect(missionPlace(r.state, 0)).not.toBe(missionPlace(s, 0));
    expect(collectMission(r.state, content, 0, end, new Decimal(10))).toBeNull();
  });
  it('never pays more than its share of lifetime souls', () => {
    const s = { ...startMission(withCards(DAVE), content, 0, [DAVE], T), soulsLifetime: new Decimal(1000) };
    expect(collectMission(s, content, 0, T + MISSION_SLOTS[0].ms, new Decimal(1e9))!.reward.souls.toNumber()).toBeCloseTo(20);
  });
  it('a matching department and a better card both raise the reward', () => {
    const s = withCards(DAVE, CHOIR, EXEC);
    expect(missionMult(s, content, 2, 'intake', [DAVE])).toBeGreaterThan(missionMult(s, content, 2, 'intake', [CHOIR]));
    expect(missionMult(s, content, 2, 'limbo', [EXEC])).toBeGreaterThan(missionMult(s, content, 2, 'limbo', [DAVE]));
    expect(missionMult({ ...s, cards: { [EXEC]: 5 } }, content, 0, 'intake', [EXEC])).toBe(2);
  });
  it('drops garbage from a save', () => {
    expect(sanitizeMissions('x')).toEqual({ active: [], runs: [0, 0, 0] });
    expect(sanitizeMissions({ active: [{ slot: 9, place: 'hell', cards: [DAVE], endsWall: 1 }, { slot: 0, place: 'nowhere', cards: [DAVE], endsWall: 1 }, { slot: 1, place: 'hell', cards: [DAVE, 4, DAVE], endsWall: 5 }, { slot: 2, place: 'hell', cards: [DAVE], endsWall: 5 }], runs: [2, -1, 'x'] }))
      .toEqual({ active: [{ slot: 1, place: 'hell', cards: [DAVE], endsWall: 5 }], runs: [2, 0, 0] });
  });
});

describe('Pet Care', () => {
  it('Folio is free, goes on duty in an empty slot, and never pushes out a pet already there', () => {
    expect(petOnDuty(adoptPet(fresh()))?.id).toBe('folio');
    const bought = grantPremium(fresh(), ['pumpkat']);
    expect(petOnDuty(adoptPet(bought))?.id).toBe('pumpkat');
    const once = adoptPet(fresh());
    expect(adoptPet(once)).toBe(once);
  });
  it('feeding eats a treat, walking finds one, and each kind waits 6 hours', () => {
    const s = adoptPet(fresh());
    const fed = givePetCare(s, 'folio', 'feed', T);
    expect(fed.pets.treats).toBe(s.pets.treats - 1);
    expect(givePetCare(fed, 'folio', 'feed', T + CARE_MS - 1)).toBe(fed);
    expect(canCare(fed, 'folio', 'walk', T)).toBe(true);
    expect(givePetCare(fed, 'folio', 'walk', T).pets.treats).toBe(s.pets.treats);
    expect(canCare(fed, 'folio', 'feed', T + CARE_MS)).toBe(true);
    expect(canCare({ ...s, pets: { ...s.pets, treats: 0 } }, 'folio', 'feed', T)).toBe(false);
    expect(givePetCare(s, 'pumpkat', 'brush', T)).toBe(s);
    expect(careWait(fed, 'folio', 'feed', T - 1e12)).toBe(CARE_MS);
  });
  it('levels add 1% each while on duty, up to level 10', () => {
    let s = adoptPet(fresh());
    for (const k of ['feed', 'brush', 'walk'] as const) s = givePetCare(s, 'folio', k, T);
    expect(petLevel(s, 'folio')).toEqual({ level: 2, xp: 0, need: 40 });
    expect(petCareMult(s)).toBeCloseTo(1.01);
    const top = { ...s, pets: { ...s.pets, care: { folio: { xp: 99999, feed: 0, brush: 0, walk: 0 } } } };
    expect(petLevel(top, 'folio').level).toBe(MAX_PET_LEVEL);
    expect(globalMult(top, content, T).div(globalMult(fresh(), content, T)).toNumber()).toBeCloseTo(1.02 * 1.09);
    expect(petCareMult({ ...top, entitlements: { ...top.entitlements, petOn: '' } })).toBe(1);
  });
  it('drops garbage from a save and gives an older save its first treats', () => {
    expect(sanitizePets(undefined)).toEqual({ treats: 2, care: {} });
    expect(sanitizePets({ treats: -4, care: { cerberus: { xp: 5 }, folio: { xp: 'a', feed: 7 } } })).toEqual({ treats: 0, care: { folio: { xp: 0, feed: 7, brush: 0, walk: 0 } } });
  });
});

describe('Desk Planner', () => {
  const seated = (...ids: string[]) => ids.reduce((s, id, i) => seatCard(s, id, i), { ...withCards(...ids), equipped: ids });
  it('has ten neighbouring pairs, and only equipped cards count', () => {
    expect(DESK_PAIRS).toHaveLength(10);
    const s = seated(DAVE, SERA);
    expect(deskPairs(s, content)).toEqual([{ a: 0, b: 1, kind: 'team' }]);
    expect(deskSeats({ ...s, equipped: [DAVE] })[1]).toBe('');
    expect(deskBonus({ ...s, equipped: [DAVE] }, content)).toBe(0);
    expect(seatCard(s, CHOIR, 3)).toBe(s);
    expect(deskBonus(fresh(), content)).toBe(0);
  });
  it('teammates and mentors help, rivals cost', () => {
    expect(deskBonus(seated(DAVE, SERA), content)).toBeCloseTo(0.03);
    expect(deskBonus(seated(DAVE, EXEC), content)).toBeCloseTo(0.04);
    expect(deskBonus(seated(CHOIR, IMP), content)).toBeCloseTo(-0.02);
    expect(globalMult(seated(DAVE, SERA), content, T).div(globalMult(fresh(), content, T)).toNumber()).toBeCloseTo(1.03);
  });
  it('swaps seats, stands a card up, and caps the total', () => {
    const s = seatCard(seated(DAVE, SERA), DAVE, 1);
    expect(deskSeats(s).slice(0, 2)).toEqual([SERA, DAVE]);
    expect(deskSeats(seatCard(s, DAVE, null))[1]).toBe('');
    const intake = content.cards.filter((c) => c.dept === 'intake').slice(0, 8).map((c) => c.id);
    expect(deskBonus(seated(...intake), content)).toBeLessThanOrEqual(DESK_CAP);
    expect(sanitizeSeats([DAVE, DAVE, 3])).toEqual([DAVE, '', '', '', '', '', '', '']);
  });
});

it('everything survives a save, a reload and an Annual Audit; an old save loads with defaults', () => {
  let s = adoptPet(startMission({ ...withCards(DAVE, SERA, CHOIR), equipped: [SERA] }, content, 2, [DAVE, CHOIR], T));
  s = seatCard(givePetCare(s, 'folio', 'walk', T), SERA, 4);
  const back = deserialize(serialize(s), content);
  expect([back.missions, back.pets, back.seats, petOnDuty(back)?.id]).toEqual([s.missions, s.pets, s.seats, 'folio']);
  const after = resetRun(s, content);
  expect([after.missions, after.pets, after.seats]).toEqual([s.missions, s.pets, s.seats]);
  const old = JSON.parse(serialize(fresh()));
  delete old.missions; delete old.pets; delete old.seats;
  const loaded = deserialize(JSON.stringify(old), content);
  expect([loaded.missions.active, loaded.pets.treats, loaded.seats.length]).toEqual([[], 2, 8]);
});

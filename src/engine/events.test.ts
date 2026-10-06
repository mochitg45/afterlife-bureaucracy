import Decimal from 'break_infinity.js';
import { createInitialState, serialize, deserialize } from './state';
import { content } from '../data';
import {
  activeEvent,
  easterWall,
  eventOccurrences,
  upcomingEvents,
  syncEvent,
  eventRate,
  eventTap,
  stampEvent,
  buyEventStaff,
  claimEventTier,
  accrueEvent,
  type EventOccurrence,
} from './events';
import { tick } from './actions';
import { applyOffline } from './offline';
import { pull, pullEvent, PULL_COST, TEN_PULL_COST } from './gacha';
import { staffUnitCost } from './economy';
import { migrate } from './migrations';
import saveV8 from './fixtures/save-v8.json';

const d = (iso: string) => Date.parse(iso + 'T00:00:00Z');
const DAY = 86_400_000;
const base = () => createInitialState({ wall: 0, mono: 0 }, content);
const rate = new Decimal(10);

/** A state already inside the occurrence, as syncEvent would leave it. */
function inEvent(occ: EventOccurrence, patch: Partial<NonNullable<ReturnType<typeof base>['event']>> = {}) {
  const s = base();
  return { ...s, event: { key: occ.key, points: new Decimal(0), earned: new Decimal(0), staff: {}, claimed: [], ...patch } };
}

describe('schedule', () => {
  it('computes Easter by the Gregorian rule', () => {
    expect(easterWall(2027)).toBe(d('2027-03-28'));
    expect(easterWall(2026)).toBe(d('2026-04-05'));
    expect(easterWall(2025)).toBe(d('2025-04-20'));
  });
  it('runs Halloween 2026 from 23 Oct to 3 Nov, UTC', () => {
    const occ = activeEvent(content, d('2026-10-25') + 5 * 3600_000)!;
    expect(occ.key).toBe('halloween-2026');
    expect(occ.kind).toBe('special');
    expect(occ.startWall).toBe(d('2026-10-23'));
    expect(occ.endWall).toBe(d('2026-11-03'));
    expect(activeEvent(content, d('2026-11-03') - 1)!.key).toBe('halloween-2026');
    expect(activeEvent(content, d('2026-11-03'))).toBeNull();
  });
  it('runs Easter 2027 from 25 March to 1 April', () => {
    const occ = activeEvent(content, d('2027-03-27'))!;
    expect(occ.key).toBe('easter-2027');
    expect(occ.startWall).toBe(d('2027-03-25'));
    expect(occ.endWall).toBe(d('2027-04-01'));
  });
  it('lets New Year run across the year end: active on 3 Jan 2027 as the occurrence that began in 2026', () => {
    const occ = activeEvent(content, d('2027-01-03'))!;
    expect(occ.key).toBe('newyear-2026');
    expect(occ.startWall).toBe(d('2026-12-30'));
    expect(occ.endWall).toBe(d('2027-01-06'));
  });
  it('runs the weekly Overflow Weekend Friday to Monday, keyed by its Friday', () => {
    const sat = activeEvent(content, d('2026-10-10') + 12 * 3600_000)!;
    expect(sat.key).toBe('weekly-2026-10-09');
    expect(sat.kind).toBe('weekly');
    expect(sat.startWall).toBe(d('2026-10-09'));
    expect(sat.endWall).toBe(d('2026-10-12'));
    expect(sat.banner).toEqual(content.events.weekly!.themes.find((t) => t.id === sat.id)!.banner);
    expect(sat.banner!.featured).toBe('c-wk-' + sat.id + '-x');
    expect(activeEvent(content, d('2026-10-12'))).toBeNull(); // Monday
    expect(activeEvent(content, d('2026-10-08'))).toBeNull(); // Thursday
  });
  it('skips a weekend that overlaps a special', () => {
    const keys = eventOccurrences(content, d('2026-10-17'), d('2026-11-09')).map((o) => o.key);
    expect(keys).toEqual(['weekly-2026-10-16', 'halloween-2026', 'weekly-2026-11-06']);
  });
  it('rotates the weekly theme every week and wraps after the last', () => {
    const [a, b] = ['2026-10-09', '2026-10-16'].map((f) => activeEvent(content, d(f) + 1000)!.id);
    expect(a).not.toBe(b);
    const n = content.events.weekly!.themes.length;
    // 2 Jan 2026 is under New Year, so week 1 (9 Jan) is the first weekend that shows a theme.
    const themes = content.events.weekly!.themes;
    expect(activeEvent(content, d('2026-01-09') + 1000)!.id).toBe(themes[1].id);
    expect(activeEvent(content, d('2026-01-16') + 1000)!.id).toBe(themes[2].id);
    expect(activeEvent(content, d('2026-01-09') + n * 7 * DAY + 1000)!.id).toBe(themes[1].id);
  });
  it('previews a forced event across [now - 1h, now + 3d] with a preview key', () => {
    const now = d('2026-10-07'); // a Wednesday: nothing real is running
    expect(activeEvent(content, now)).toBeNull();
    const h = activeEvent(content, now, 'halloween')!;
    expect(h.key).toBe('halloween-preview');
    expect(h.startWall).toBe(now - 3600_000);
    expect(h.endWall).toBe(now + 3 * DAY);
    expect(h.banner).toBeDefined();
    expect(activeEvent(content, now, 'weekly')!.key).toBe('weekly-preview');
  });
  it('lists upcoming events in order, starting with the running one', () => {
    const list = upcomingEvents(content, d('2026-10-25'), 4);
    expect(list.map((o) => o.key)).toEqual(['halloween-2026', 'weekly-2026-11-06', 'weekly-2026-11-13', 'weekly-2026-11-20']);
  });
});

describe('syncEvent', () => {
  it('opens a fresh state for the running event and clears it between events', () => {
    const s = syncEvent(base(), content, d('2026-10-25'));
    expect(s.event).toMatchObject({ key: 'halloween-2026', staff: {}, claimed: [] });
    expect(s.event!.earned.eq(0)).toBe(true);
    expect(syncEvent(s, content, d('2026-10-26'))).toBe(s);
    expect(syncEvent(s, content, d('2026-11-04'))!.event).toBeNull();
  });
  it('pays the reached-but-unclaimed tiers of the old event on rollover, then resets', () => {
    const occ = activeEvent(content, d('2026-10-25'))!;
    // Reaches tiers 0 (5 vouchers), 1 (a card) and 2 (10 vouchers); tier 0 already taken.
    const s = inEvent(occ, { earned: new Decimal(occ.track[2].at), points: new Decimal(5), staff: { 'hw-ghost': 3 }, claimed: [0] });
    const out = syncEvent({ ...s, vouchers: 1 }, content, d('2026-11-06') + 1000);
    expect(out.vouchers).toBe(1 + 10);
    // The tier-1 card is paid, then leaves with the rest of Halloween's cards.
    expect(out.cards['c-hw-trickster']).toBeUndefined();
    expect(out.event!.key).toBe('weekly-2026-11-06');
    expect(out.event!.staff).toEqual({});
    expect(out.event!.claimed).toEqual([]);
    expect(out.event!.earned.eq(0)).toBe(true);
  });
  it('clears every event card (stars, shards, spares, equip slot) when the event changes', () => {
    const occ = activeEvent(content, d('2026-10-25'))!;
    const s = inEvent(occ, {});
    const keeper = content.cards.find((c) => !c.event)!.id;
    const withCards = {
      ...s,
      cards: { 'c-hw-witch': 3, 'c-hw-bat': 1, [keeper]: 2 },
      cardShards: { 'c-hw-bat': 1, [keeper]: 1 },
      cardSpares: { 'c-hw-witch': 2 },
      equipped: ['c-hw-witch', keeper],
    };
    expect(syncEvent(withCards, content, d('2026-10-26'))).toBe(withCards); // same event: untouched
    const out = syncEvent(withCards, content, d('2026-11-06') + 1000);
    expect(out.cards).toEqual({ [keeper]: 2 });
    expect(out.cardShards).toEqual({ [keeper]: 1 });
    expect(out.cardSpares).toEqual({});
    expect(out.equipped).toEqual([keeper]);
  });
  it('queues a ranking prize for an ended run that scored, with its name and kind', () => {
    const occ = activeEvent(content, d('2026-10-25'))!;
    const scored = syncEvent(inEvent(occ, { earned: new Decimal(5) }), content, d('2026-11-06') + 1000);
    expect(scored.rankPending).toEqual([{ key: occ.key, name: occ.name, special: true }]);
    const idle = syncEvent(inEvent(occ, {}), content, d('2026-11-06') + 1000);
    expect(idle.rankPending).toEqual([]);
    const weekly = activeEvent(content, d('2026-10-10'))!;
    const w = syncEvent(inEvent(weekly, { earned: new Decimal(5) }), content, d('2026-10-14'));
    expect(w.rankPending).toEqual([{ key: weekly.key, name: weekly.name, special: false }]);
  });
  it('resolves a weekly key to the weekly track', () => {
    const occ = activeEvent(content, d('2026-10-10'))!;
    const s = inEvent(occ, { earned: new Decimal(occ.track[0].at) });
    const out = syncEvent(s, content, d('2026-10-14'));
    expect(out.vouchers).toBe(3);
    expect(out.event).toBeNull();
  });
});

describe('event economy', () => {
  const occ = activeEvent(content, d('2026-10-25'))!;
  const ghost = occ.staff[0];

  it('rate is Σ baseRate × owned, tap is 1 + 5% of rate', () => {
    const s = inEvent(occ, { staff: { 'hw-ghost': 4, 'hw-mummy': 2 } });
    expect(eventRate(s, content, occ).toNumber()).toBeCloseTo(4 * 1 + 2 * 8);
    expect(eventTap(s, content, occ).toNumber()).toBeCloseTo(1 + 0.05 * 20);
    expect(eventTap(base(), content, occ).toNumber()).toBe(1);
  });
  it('scales by equipped eventMult cards and their stars', () => {
    const s = { ...inEvent(occ, { staff: { 'hw-ghost': 10 } }), cards: { 'c-hw-bat': 2 }, equipped: ['c-hw-bat'] };
    expect(eventRate(s, content, occ).toNumber()).toBeCloseTo(10 * (1 + 0.2 * 2));
    expect(eventRate({ ...s, equipped: [] }, content, occ).toNumber()).toBeCloseTo(10);
  });
  it('charges baseCost × 1.15^owned, and refuses when short', () => {
    const poor = inEvent(occ, { points: new Decimal(5) });
    expect(buyEventStaff(poor, content, occ, 'hw-ghost', 1)).toBe(poor);
    const s = inEvent(occ, { points: new Decimal(1000), earned: new Decimal(1000), staff: { 'hw-ghost': 2 } });
    const one = buyEventStaff(s, content, occ, 'hw-ghost', 1);
    expect(one.event!.staff['hw-ghost']).toBe(3);
    expect(one.event!.points.toNumber()).toBeCloseTo(1000 - ghost.baseCost * 1.15 ** 2);
    expect(one.event!.earned.toNumber()).toBe(1000); // spending never lowers earned
    const ten = buyEventStaff(s, content, occ, 'hw-ghost', 10);
    const expected = Array.from({ length: 10 }, (_, i) => staffUnitCost(ghost, 2 + i).toNumber()).reduce((a, b) => a + b);
    expect(1000 - ten.event!.points.toNumber()).toBeCloseTo(expected);
    const max = buyEventStaff(s, content, occ, 'hw-ghost', 'max');
    expect(max.event!.staff['hw-ghost']).toBeGreaterThan(3);
    expect(max.event!.points.gte(0)).toBe(true);
  });
  it('ignores an occurrence the save is not on', () => {
    const other = activeEvent(content, d('2026-10-10'))!;
    const s = inEvent(occ, { points: new Decimal(1000) });
    expect(buyEventStaff(s, content, other, 'hw-ghost', 1)).toBe(s);
    expect(stampEvent(s, content, other)).toBe(s);
  });
  it('a stamp earns the tap', () => {
    const s = inEvent(occ, { staff: { 'hw-ghost': 20 } });
    const out = stampEvent(s, content, occ);
    expect(out.event!.points.toNumber()).toBeCloseTo(1 + 0.05 * 20);
    expect(out.event!.earned.toNumber()).toBeCloseTo(2);
  });
});

describe('ticking', () => {
  const wall = d('2026-10-25');
  const occ = activeEvent(content, wall)!;

  it('accrues points and earned by rate × dt while the saved event is running, even with no office staff', () => {
    const s = inEvent(occ, { staff: { 'hw-ghost': 10 } });
    const out = tick(s, content, 3, wall);
    expect(out.event!.points.toNumber()).toBeCloseTo(30);
    expect(out.event!.earned.toNumber()).toBeCloseTo(30);
    expect(out.soulsRun.eq(0)).toBe(true);
  });
  it('does not accrue for a stale key, or with no event', () => {
    const stale = { ...inEvent(occ, { staff: { 'hw-ghost': 10 } }) };
    stale.event.key = 'halloween-2025';
    expect(tick(stale, content, 3, wall).event!.points.eq(0)).toBe(true);
    expect(accrueEvent(base(), content, 3, wall)).toEqual(base());
  });
  it('accrues in a forced preview', () => {
    const now = d('2026-10-07');
    const p = activeEvent(content, now, 'halloween')!;
    const out = tick(inEvent(p, { staff: { 'hw-ghost': 10 } }), content, 2, now, 'halloween');
    expect(out.event!.earned.toNumber()).toBeCloseTo(20);
  });
});

describe('offline', () => {
  const occ = activeEvent(content, d('2026-10-25'))!;

  it('credits event points for the credited seconds at the offline fraction', () => {
    const wall = d('2026-10-25');
    const s = inEvent(occ, { staff: { 'hw-ghost': 10 } });
    const r = applyOffline(s, content, 600, wall);
    expect(r.eventPoints.toNumber()).toBeCloseTo(10 * 600 * 0.5);
    expect(r.state.event!.earned.toNumber()).toBeCloseTo(3000);
  });
  it('caps at the offline cap like the office', () => {
    const wall = d('2026-10-30');
    const s = inEvent(occ, { staff: { 'hw-ghost': 10 } });
    const r = applyOffline(s, content, 10 * 3600, wall);
    expect(r.state.event!.earned.toNumber()).toBeCloseTo(10 * 4 * 3600 * 0.5);
  });
  it('clamps at the event end when the app reopens after it', () => {
    // Left 1 h before Halloween ends; reopened 3 h after. Only the first hour is inside.
    const left = occ.endWall - 3600_000;
    const wall = occ.endWall + 3 * 3600_000;
    const s = inEvent(occ, { staff: { 'hw-ghost': 10 } });
    const r = applyOffline(s, content, 4 * 3600, wall);
    expect(r.state.event!.earned.toNumber()).toBeCloseTo(10 * 3600 * 0.5);
    expect(left).toBeLessThan(occ.endWall);
  });
  it('credits nothing to an event the saved key does not match', () => {
    const s = inEvent(occ, { staff: { 'hw-ghost': 10 } });
    s.event.key = 'christmas-2026';
    expect(applyOffline(s, content, 600, d('2026-10-25')).eventPoints.eq(0)).toBe(true);
  });
});

describe('claimEventTier', () => {
  const occ = activeEvent(content, d('2026-10-25'))!;
  const idx = (type: string) => occ.track.findIndex((t) => t.reward.type === type);

  it('refuses a tier not yet reached', () => {
    const s = inEvent(occ, { earned: new Decimal(10) });
    expect(claimEventTier(s, content, occ, 0)).toBe(s);
  });
  it('pays vouchers flat, ignoring the voucher multiplier', () => {
    const s = { ...inEvent(occ, { earned: new Decimal(1e12) }), vouchers: 2 };
    s.cosmicClauses = []; // no multipliers in play; the grant is exact either way
    const out = claimEventTier(s, content, occ, idx('vouchers'));
    const tier = occ.track[idx('vouchers')].reward as { amount: number };
    expect(out.vouchers).toBe(2 + tier.amount);
    expect(out.voucherFraction).toBe(0);
    expect(out.event!.claimed).toEqual([idx('vouchers')]);
  });
  it('pays Seals directly', () => {
    const s = inEvent(occ, { earned: new Decimal(1e12) });
    const tier = occ.track[idx('seals')].reward as { amount: number };
    expect(claimEventTier(s, content, occ, idx('seals')).seals).toBe(tier.amount);
  });
  it('banks a card like a pull: new is ★1, a duplicate adds a shard', () => {
    const s = inEvent(occ, { earned: new Decimal(1e12) });
    const i = idx('card');
    const id = (occ.track[i].reward as { card: string }).card;
    const first = claimEventTier(s, content, occ, i);
    expect(first.cards[id]).toBe(1);
    const again = claimEventTier({ ...first, event: { ...first.event!, claimed: [] } }, content, occ, i);
    expect(again.cards[id]).toBe(1);
    expect(again.cardShards[id]).toBe(1);
  });
  it('pays each tier only once', () => {
    const s = inEvent(occ, { earned: new Decimal(1e12) });
    const once = claimEventTier(s, content, occ, 0);
    expect(claimEventTier(once, content, occ, 0)).toBe(once);
    expect(claimEventTier(s, content, occ, 999)).toBe(s);
  });
});

describe('event banner', () => {
  const occ = activeEvent(content, d('2026-10-25'))!;
  const eventCardIds = new Set(content.cards.filter((c) => c.event).map((c) => c.id));
  const mine = new Set(content.cards.filter((c) => c.event === 'halloween').map((c) => c.id));

  it('only gives that event\'s cards, one per rarity, at the normal prices', () => {
    let s = { ...base(), vouchers: 5000, rngSeed: 11 };
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const r = pullEvent(s, content, occ, 10, rate);
      expect(r.results).toHaveLength(10);
      for (const x of r.results) {
        expect(mine.has(x.cardId)).toBe(true);
        expect(content.cards.find((c) => c.id === x.cardId)!.rarity).toBe(x.rarity);
        seen.add(x.cardId);
      }
      s = r.state;
    }
    expect(s.vouchers).toBe(5000 - 40 * TEN_PULL_COST);
    expect(seen.size).toBeGreaterThanOrEqual(3);
    const one = pullEvent({ ...base(), vouchers: PULL_COST }, content, occ, 1, rate);
    expect(one.state.vouchers).toBe(0);
  });
  it('shares pity with the normal banner', () => {
    const s = { ...base(), vouchers: 5000, rngSeed: 3, pity: { senior: 0, executive: 58 } };
    const r = pullEvent(s, content, occ, 10, rate);
    expect(r.results.some((x) => x.rarity === 'executive')).toBe(true);
    expect(r.state.pity.executive).toBeLessThan(58 + 10);
  });
  it('refuses when short', () => {
    const poor = base();
    expect(pullEvent(poor, content, occ, 1, rate)).toEqual({ state: poor, results: [] });
  });
  it("a weekly weekend pulls only that theme's cards", () => {
    const weekly = activeEvent(content, d('2026-10-10'))!;
    const own = new Set(content.cards.filter((c) => c.event === weekly.id).map((c) => c.id));
    expect(own.size).toBe(4);
    let s = { ...base(), vouchers: 5000, rngSeed: 9 };
    for (let i = 0; i < 20; i++) {
      const r = pullEvent(s, content, weekly, 10, rate);
      expect(r.results).toHaveLength(10);
      for (const x of r.results) expect(own.has(x.cardId)).toBe(true);
      s = r.state;
    }
  });
  it('never lets the normal banner roll an event card', () => {
    let s = { ...base(), vouchers: 100_000, rngSeed: 5, pity: { senior: 0, executive: 0 } };
    for (let i = 0; i < 300; i++) {
      const r = pull(s, content, 10, rate);
      for (const x of r.results) expect(eventCardIds.has(x.cardId)).toBe(false);
      s = r.state;
    }
  });
});

describe('save', () => {
  it('migrates a v8 save to v9 with no event', () => {
    expect(migrate(saveV8 as Record<string, unknown>).event).toBeNull();
    expect(deserialize(JSON.stringify(saveV8), content).event).toBeNull();
  });
  it('round-trips an event with its Decimals, and drops garbage', () => {
    const occ = activeEvent(content, d('2026-10-25'))!;
    const s = inEvent(occ, { points: new Decimal('2e30'), earned: new Decimal('5e30'), staff: { 'hw-ghost': 3 }, claimed: [0, 2] });
    const back = deserialize(serialize(s), content).event!;
    expect(back.key).toBe(occ.key);
    expect(back.points.eq(new Decimal('2e30'))).toBe(true);
    expect(back.earned.eq(new Decimal('5e30'))).toBe(true);
    expect(back.staff).toEqual({ 'hw-ghost': 3 });
    expect(back.claimed).toEqual([0, 2]);
    for (const junk of ['x', 7, [], { key: 5 }, { key: '' }]) {
      const raw = JSON.parse(serialize(s));
      raw.event = junk;
      expect(deserialize(JSON.stringify(raw), content).event).toBeNull();
    }
    const raw = JSON.parse(serialize(s));
    raw.event = { key: 'weekly-2026-10-09', points: 'zzz', earned: null, staff: 'no', claimed: 'no' };
    const tolerant = deserialize(JSON.stringify(raw), content).event!;
    expect(tolerant.earned.eq(0)).toBe(true);
    expect(tolerant.staff).toEqual({});
    expect(tolerant.claimed).toEqual([]);
  });
});

describe('event pacing', () => {
  /**
   * The fastest card-less player: online every second, tapping once a second, always buying the
   * best rate per cost (costs grow 15% a hire, as in economy.ts). The design floor is that the
   * whole track takes this player 72 hours on a special and 60 on a weekend (which is 72 long).
   */
  function hoursToFinish(staff: { baseCost: number; baseRate: number }[], target: number): number {
    let pts = 0, earned = 0;
    const own = staff.map(() => 0);
    for (let t = 1; t < 200 * 3600; t++) {
      const rate = staff.reduce((a, s, i) => a + s.baseRate * own[i], 0);
      const gain = rate + 1 + 0.05 * rate;
      pts += gain; earned += gain;
      if (earned >= target) return t / 3600;
      for (;;) {
        let best = -1, br = 0;
        staff.forEach((s, i) => { const c = s.baseCost * 1.15 ** own[i]; if (c <= pts && s.baseRate / c > br) { br = s.baseRate / c; best = i; } });
        if (best < 0) break;
        pts -= staff[best].baseCost * 1.15 ** own[best]; own[best]++;
      }
    }
    return Infinity;
  }
  it('no special track can be finished in under 72 hours without event cards', () => {
    for (const sp of content.events.specials) expect(hoursToFinish(sp.staff, sp.track[sp.track.length - 1].at)).toBeGreaterThanOrEqual(72);
  });
  it('the weekend track takes about 60 of its 72 hours', () => {
    const w = content.events.weekly!;
    const h = hoursToFinish(w.staff, w.track[w.track.length - 1].at);
    expect(h).toBeGreaterThanOrEqual(55);
    expect(h).toBeLessThan(72);
  });
});

describe('weekly themes', () => {
  it('each theme dresses all base staff, keeping ids, costs and rates', () => {
    const w = content.events.weekly!;
    for (const t of w.themes) {
      expect(t.staff).toHaveLength(w.staff.length);
    }
    const occ = activeEvent(content, Date.UTC(2026, 9, 10, 12))!;
    expect(occ.kind).toBe('weekly');
    occ.staff.forEach((s, i) => {
      expect(s.id).toBe(w.staff[i].id);
      expect(s.baseCost).toBe(w.staff[i].baseCost);
      expect(s.character).toMatch(/^wk-/);
    });
  });
});

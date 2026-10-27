import Decimal from 'break_infinity.js';
import { createInitialState, serialize, deserialize } from './state';
import { content } from '../data';
import reviewsJson from '../data/reviews.json';
import { computeRates } from './economy';
import { applyOffline } from './offline';
import { tickWithRates } from './actions';
import { eventRate, activeEvent } from './events';
import {
  reputationTarget, stepScore, reputationMult, pickReview, addReview, respondTo, sanitizeReputation, tierOf, nextReviewDelay,
  REVIEW_MIN_MS, REVIEW_MAX_MS, FEED_SIZE, COMPLAINTS_PER_HOUR, START_SCORE, IDLE_FLOOR, MAX_MULT, REPLY_COUNT,
  type ReviewTemplate, type RepSignals, type Reputation, type SavedReview,
} from './reviews';

const templates = reviewsJson as ReviewTemplate[];
const quiet: RepSignals = { stamps: 0, dailiesClaimed: 0, incidentsFixed: 0, incidentsIgnored: 0, idleMs: 0 };
const now = { wall: 0, mono: 0 };

describe('review data', () => {
  it('ships 60+ templates with valid fields and unique ids', () => {
    expect(templates.length).toBeGreaterThanOrEqual(60);
    expect(new Set(templates.map((r) => r.id)).size).toBe(templates.length);
    const depts = ['intake', 'heaven', 'hell', 'limbo', 'reincarnation', 'valhalla', 'any'];
    for (const r of templates) {
      expect(r.stars).toBeGreaterThanOrEqual(1);
      expect(r.stars).toBeLessThanOrEqual(5);
      expect(depts).toContain(r.dept);
      expect(r.text.length).toBeGreaterThan(10);
      expect(r.who && r.handle).toBeTruthy();
    }
    for (let s = 1; s <= 5; s++) expect(templates.some((r) => r.stars === s && r.dept === 'any')).toBe(true);
  });
});

describe('cadence', () => {
  it('one review every 1-2 minutes', () => {
    expect(nextReviewDelay(() => 0)).toBe(REVIEW_MIN_MS);
    expect(nextReviewDelay(() => 1)).toBe(REVIEW_MAX_MS);
  });
});

describe('reputation score', () => {
  it('a pure idler holds 3.5 and is never punished below 3.0', () => {
    expect(reputationTarget(quiet)).toBe(START_SCORE);
    const worst = reputationTarget({ ...quiet, incidentsIgnored: 5, idleMs: 1e9 });
    expect(worst).toBeGreaterThanOrEqual(IDLE_FLOOR);
    let s = START_SCORE;
    for (let i = 0; i < 200; i++) s = stepScore(s, worst);
    expect(s).toBeGreaterThanOrEqual(IDLE_FLOOR);
  });
  it('ignored incidents and a long backlog pull the target down gently', () => {
    expect(reputationTarget({ ...quiet, incidentsIgnored: 2 })).toBeLessThan(START_SCORE);
    expect(reputationTarget({ ...quiet, incidentsIgnored: 1, idleMs: 3600_000 })).toBeLessThan(reputationTarget({ ...quiet, incidentsIgnored: 1 }));
  });
  it('active play climbs past 4.5', () => {
    const active: RepSignals = { stamps: 60, dailiesClaimed: 2, incidentsFixed: 1, incidentsIgnored: 0, idleMs: 0 };
    let s = START_SCORE;
    for (let i = 0; i < 30; i++) s = stepScore(s, reputationTarget(active));
    expect(s).toBeGreaterThan(4.5);
    expect(s).toBeLessThanOrEqual(5);
  });
  it('tierOf is the whole-star floor', () => {
    expect(tierOf(3.99)).toBe(3);
    expect(tierOf(4)).toBe(4);
    expect(tierOf(5)).toBe(5);
  });
});

describe('income multiplier', () => {
  it('3 stars = 1.00x, 5 stars = 1.10x, never below 1.00x', () => {
    expect(reputationMult(3)).toBe(1);
    expect(reputationMult(4)).toBeCloseTo(1.05);
    expect(reputationMult(5)).toBeCloseTo(MAX_MULT);
    expect(reputationMult(1)).toBe(1);
    expect(reputationMult(NaN)).toBeGreaterThanOrEqual(1);
    expect(reputationMult(99)).toBeCloseTo(MAX_MULT);
  });
  it('scales office income through computeRates, and only that', () => {
    const s = { ...createInitialState(now, content), staff: { dave: 5 } };
    const base = computeRates(s, content, 0);
    const best = computeRates(s, content, 0, 1, reputationMult(5));
    expect(best.soulsPerSec.div(base.soulsPerSec).toNumber()).toBeCloseTo(1.1);
    expect(computeRates(s, content, 0, 1, reputationMult(3)).soulsPerSec.eq(base.soulsPerSec)).toBe(true);
  });
  it('leaves event currency, event score and the event rate untouched by reputation', () => {
    const wall = Date.parse('2026-10-25T00:00:00Z');
    const occ = activeEvent(content, wall)!;
    const ev = { key: occ.key, points: new Decimal(0), earned: new Decimal(0), staff: { [occ.staff[0].id]: 4 }, claimed: [] as number[], pass: false };
    const s = { ...createInitialState(now, content), staff: { dave: 5 }, event: ev };
    const lo = { ...s, reputation: { score: 1, reviews: [] } };
    const hi = { ...s, reputation: { score: 5, reviews: [] } };
    expect(eventRate(hi, content, occ, wall).eq(eventRate(lo, content, occ, wall))).toBe(true);
    // Even the live tick, which does carry the office bonus, accrues the same event points.
    const a = tickWithRates(lo, content, 10, wall, null, 1, 1);
    const b = tickWithRates(hi, content, 10, wall, null, 1, reputationMult(5));
    expect(b.state.event!.points.gt(0)).toBe(true);
    expect(b.state.event!.points.eq(a.state.event!.points)).toBe(true);
    expect(b.state.event!.earned.eq(a.state.event!.earned)).toBe(true);
    expect(b.state.vouchers).toBe(a.state.vouchers);
    expect(b.state.seals).toBe(a.state.seals);
    expect(b.state.soulsRun.gt(a.state.soulsRun)).toBe(true);
  });
  it('leaves offline earnings untouched by reputation', () => {
    const s = { ...createInitialState(now, content), staff: { dave: 3 } };
    const lo = applyOffline({ ...s, reputation: { score: 1, reviews: [] } }, content, 3600, 0);
    const hi = applyOffline({ ...s, reputation: { score: 5, reviews: [] } }, content, 3600, 0);
    expect(hi.souls.eq(lo.souls)).toBe(true);
    expect(hi.kc.eq(lo.kc)).toBe(true);
    expect(hi.eventPoints.eq(lo.eventPoints)).toBe(true);
  });
});

describe('pickReview', () => {
  const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };
  it('only uses unlocked departments (and "any")', () => {
    for (let i = 0; i < 300; i++) {
      const r = pickReview(templates, ['intake'], 3.5, [], 0, i, Math.random)!;
      const t = templates.find((x) => x.id === r.id)!;
      expect(['intake', 'any']).toContain(t.dept);
    }
  });
  it('returns null with nothing to pick from', () => {
    expect(pickReview([], ['intake'], 3, [], 0, 1)).toBeNull();
  });
  it('mean stars follow the score', () => {
    const avg = (score: number) => {
      let sum = 0;
      for (let i = 0; i < 600; i++) {
        const id = pickReview(templates, ['intake', 'heaven', 'hell', 'limbo', 'reincarnation', 'valhalla'], score, [], 0, i)!.id;
        sum += templates.find((x) => x.id === id)!.stars;
      }
      return sum / 600;
    };
    expect(avg(4.8)).toBeGreaterThan(avg(3.2) + 0.5);
  });
  it('complaints are 1-2 stars only and capped per hour', () => {
    const hist: SavedReview[] = Array.from({ length: COMPLAINTS_PER_HOUR }, (_, i) => ({ n: i, id: 'x', wall: 1000, complaint: true as const }));
    // rng 0 would always complain if allowed
    const capped = pickReview(templates, ['intake'], 1, hist, 2000, 9, seq(0, 0, 0, 0, 0))!;
    expect(capped.complaint).toBeUndefined();
    const open = pickReview(templates, ['intake'], 1, [], 2000, 9, seq(0, 0, 0, 0, 0))!;
    expect(open.complaint).toBe(true);
    expect(templates.find((x) => x.id === open.id)!.stars).toBeLessThanOrEqual(2);
    // an hour later the old complaints no longer count
    expect(pickReview(templates, ['intake'], 1, hist, 1000 + 3600_000, 9, seq(0, 0, 0, 0, 0))!.complaint).toBe(true);
  });
  it('keeps only the latest 20', () => {
    let rep: Reputation = { score: 3.5, reviews: [] };
    for (let i = 0; i < 30; i++) rep = addReview(rep, { n: i, id: 'a', wall: i });
    expect(rep.reviews).toHaveLength(FEED_SIZE);
    expect(rep.reviews[0].n).toBe(29);
  });
});

describe('respondTo', () => {
  const rep: Reputation = { score: 3.5, reviews: [{ n: 1, id: 'a', wall: 0, complaint: true }, { n: 2, id: 'b', wall: 0 }] };
  it('answers a complaint once and nudges the score up', () => {
    const r = respondTo(rep, 1, 3);
    expect(r.score).toBeGreaterThan(3.5);
    expect(r.reviews[0].reply).toBe(3);
    expect(respondTo(r, 1, 0)).toBe(r);
  });
  it('ignores non-complaints and unknown reviews', () => {
    expect(respondTo(rep, 2, 0)).toBe(rep);
    expect(respondTo(rep, 99, 0)).toBe(rep);
  });
  it('never exceeds five stars', () => {
    expect(respondTo({ ...rep, score: 5 }, 1, 0).score).toBe(5);
  });
});

describe('save', () => {
  it('sanitizes junk and round-trips', () => {
    expect(sanitizeReputation(undefined)).toEqual({ score: START_SCORE, reviews: [] });
    expect(sanitizeReputation({ score: 'x', reviews: 'y' }).score).toBe(START_SCORE);
    expect(sanitizeReputation({ score: 99 }).score).toBe(5);
    expect(sanitizeReputation({ score: -4 }).score).toBe(1);
    const dirty = sanitizeReputation({ score: 4, reviews: [{ n: 1, id: 'a', wall: 5, complaint: true, reply: 99 }, { n: 1, id: 'dup' }, { id: 'no-n' }, null, { n: 2, id: 'b', wall: 1, reply: 2 }] });
    expect(dirty.reviews).toEqual([{ n: 1, id: 'a', wall: 5, complaint: true }, { n: 2, id: 'b', wall: 1 }]);
    const s = { ...createInitialState(now, content), reputation: { score: 4.4, reviews: [{ n: 3, id: 'rv-any-coffee', wall: 9, complaint: true as const, reply: REPLY_COUNT - 1 }] } };
    expect(deserialize(serialize(s), content).reputation).toEqual(s.reputation);
    expect(createInitialState(now, content).reputation).toEqual({ score: START_SCORE, reviews: [] });
  });
});

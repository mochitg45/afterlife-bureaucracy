import Decimal from 'break_infinity.js';
import type { EventMissionDay, EventPool, EventState, GameState } from './state';
import type { Content, EventTier, StaffDef } from './content';
import { canAfford, staffBulkCost, maxAffordable } from './economy';
import { bankCard, cardEventMult, keptCard, type PullResult } from './gacha';
import { grantVouchersExact } from './vouchers';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
/** Weekly themes are counted from this Friday (2026-01-02). */
const WEEKLY_EPOCH = Date.UTC(2026, 0, 2);
/** A weekend runs Friday 00:00 to Monday 00:00 UTC. */
const WEEKLY_LENGTH = 3 * DAY;
/** The tap is worth this share of the event rate on top of 1. */
export const EVENT_TAP_FRACTION = 0.05;
/** A brand-new player joins events after a few minutes of the main game: this many hires, ever. */
export const EVENT_UNLOCK_HIRES = 10;
export function eventUnlocked(state: GameState): boolean {
  return state.stats.staffHired >= EVENT_UNLOCK_HIRES;
}

export interface EventOccurrence {
  /** Progress belongs to one key: `${specialId}-${startYear}` or `weekly-YYYY-MM-DD`. */
  key: string;
  kind: 'weekly' | 'special';
  /** The special's id, or the weekly theme's id. */
  id: string;
  name: string;
  blurb: string;
  currency: string;
  deptName: string;
  accent: string;
  staff: StaffDef[];
  track: EventTier[];
  banner?: { name: string; featured: string };
  /** UTC ms-epoch; the window is [startWall, endWall). */
  startWall: number;
  endWall: number;
}

/** Easter Sunday of `year` (Gregorian calendar) as a UTC midnight ms-epoch. */
export function easterWall(year: number): number {
  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(year, month - 1, day);
}

function mmdd(year: number, s: string): number {
  const [m, d] = s.split('-').map(Number);
  return Date.UTC(year, m - 1, d);
}

/** Special occurrences overlapping [from, to), by start. */
function specialOccurrences(content: Content, from: number, to: number): EventOccurrence[] {
  const out: EventOccurrence[] = [];
  const y0 = new Date(from).getUTCFullYear() - 1;
  const y1 = new Date(to).getUTCFullYear() + 1;
  for (const sp of content.events.specials) {
    for (let y = y0; y <= y1; y++) {
      let startWall: number;
      let endWall: number;
      if (sp.window.type === 'easter') {
        const easter = easterWall(y);
        startWall = easter - sp.window.before * DAY;
        endWall = easter + sp.window.after * DAY;
      } else {
        startWall = mmdd(y, sp.window.start);
        // An end before the start (New Year, 12-30 -> 01-06) runs into the next year.
        const end = mmdd(y, sp.window.end);
        endWall = end > startWall ? end : mmdd(y + 1, sp.window.end);
      }
      if (startWall >= to || endWall <= from) continue;
      out.push({
        key: `${sp.id}-${y}`,
        kind: 'special',
        id: sp.id,
        name: sp.name,
        blurb: sp.blurb,
        currency: sp.currency,
        deptName: sp.deptName,
        accent: sp.accent,
        staff: sp.staff,
        track: sp.track,
        banner: sp.banner,
        startWall,
        endWall,
      });
    }
  }
  return out.sort((a, b) => a.startWall - b.startWall);
}

function weeklyOccurrence(content: Content, startWall: number, key: string): EventOccurrence | null {
  const w = content.events.weekly;
  if (!w) return null;
  const week = Math.floor((startWall - WEEKLY_EPOCH) / WEEK);
  const theme = w.themes[((week % w.themes.length) + w.themes.length) % w.themes.length];
  return {
    key,
    kind: 'weekly',
    id: theme.id,
    name: theme.name,
    blurb: theme.blurb,
    currency: w.currency,
    deptName: w.deptName,
    accent: w.accent,
    staff: w.staff.map((s, i) => ({ ...s, ...theme.staff?.[i] })),
    track: w.track,
    banner: theme.banner,
    startWall,
    endWall: startWall + WEEKLY_LENGTH,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
function weeklyKey(startWall: number): string {
  const d = new Date(startWall);
  return `weekly-${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Every occurrence overlapping [fromWall, toWall), in start order. Weekends under a special are skipped. */
export function eventOccurrences(content: Content, fromWall: number, toWall: number): EventOccurrence[] {
  const specials = specialOccurrences(content, fromWall - WEEKLY_LENGTH, toWall + WEEKLY_LENGTH);
  const out = specials.filter((o) => o.startWall < toWall && o.endWall > fromWall);
  if (content.events.weekly) {
    for (let k = Math.floor((fromWall - WEEKLY_LENGTH - WEEKLY_EPOCH) / WEEK); ; k++) {
      const startWall = WEEKLY_EPOCH + k * WEEK;
      if (startWall >= toWall) break;
      const endWall = startWall + WEEKLY_LENGTH;
      if (endWall <= fromWall) continue;
      if (specials.some((s) => s.startWall < endWall && s.endWall > startWall)) continue;
      const occ = weeklyOccurrence(content, startWall, weeklyKey(startWall));
      if (occ) out.push(occ);
    }
  }
  return out.sort((a, b) => a.startWall - b.startWall);
}

/** A synthetic occurrence for previews and tests: `forceId` is a special's id or 'weekly'. */
function forcedOccurrence(content: Content, nowWall: number, forceId: string): EventOccurrence | null {
  const startWall = nowWall - HOUR;
  const endWall = nowWall + 3 * DAY;
  const key = `${forceId}-preview`;
  if (forceId === 'weekly') {
    const fri = WEEKLY_EPOCH + Math.floor((nowWall - WEEKLY_EPOCH) / WEEK) * WEEK;
    const occ = weeklyOccurrence(content, fri, key);
    return occ && { ...occ, startWall, endWall };
  }
  const sp = specialOccurrences(content, nowWall - 400 * DAY, nowWall + 400 * DAY).find((o) => o.id === forceId);
  return sp ? { ...sp, key, startWall, endWall } : null;
}

// The tick asks every 100 ms; the answer only changes at an occurrence boundary, so it is
// remembered for the window it is valid for. All boundaries are UTC midnights.
let cache: { content: Content; from: number; to: number; occ: EventOccurrence | null } | null = null;

/** The occurrence running at `nowWall`, or null. `forceId` runs that event now (dev and test-ads builds only; the caller gates it). */
export function activeEvent(content: Content, nowWall: number, forceId?: string | null): EventOccurrence | null {
  if (forceId) {
    const forced = forcedOccurrence(content, nowWall, forceId);
    if (forced) return forced;
  }
  if (cache && cache.content === content && nowWall >= cache.from && nowWall < cache.to) return cache.occ;
  const found = eventOccurrences(content, nowWall, nowWall + 1)[0] ?? null;
  if (found) {
    cache = { content, from: found.startWall, to: found.endWall, occ: found };
  } else {
    const next = eventOccurrences(content, nowWall, nowWall + 8 * DAY)[0];
    cache = { content, from: nowWall - (nowWall % DAY), to: next ? next.startWall : Infinity, occ: null };
  }
  return found;
}

/** The next `n` occurrences that have not ended yet (the running one first), for a schedule list. */
export function upcomingEvents(content: Content, nowWall: number, n: number): EventOccurrence[] {
  const out: EventOccurrence[] = [];
  // Specials are at most a year apart, so a year of look-ahead per round always finds more.
  for (let from = nowWall, i = 0; out.length < n && i < 4; i++, from += 366 * DAY) {
    for (const o of eventOccurrences(content, from, from + 366 * DAY)) {
      if (o.endWall > nowWall && !out.some((x) => x.key === o.key)) out.push(o);
    }
  }
  return out.slice(0, n);
}

/** The reward track an old key's occurrence had, so an ended event can still be paid out. */
function trackForKey(content: Content, key: string): EventTier[] {
  if (key.startsWith('weekly-')) return content.events.weekly?.track ?? [];
  const id = /^(.*)-(\d{4}|preview)$/.exec(key)?.[1];
  return content.events.specials.find((s) => s.id === id)?.track ?? [];
}

/** An ended key's display name and kind, for its ranking-prize popup. */
function keyInfo(content: Content, key: string): { name: string; special: boolean } {
  const m = /^weekly-(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (m) return { name: weeklyOccurrence(content, Date.UTC(+m[1], +m[2] - 1, +m[3]), key)?.name ?? '', special: false };
  if (key.startsWith('weekly-')) return { name: content.events.weekly?.deptName ?? '', special: false };
  const id = /^(.*)-(\d{4}|preview)$/.exec(key)?.[1];
  return { name: content.events.specials.find((s) => s.id === id)?.name ?? '', special: true };
}

/** What a claimed tier paid, for the claim popup: a card reads like a one-card pull. */
export type EventPrize =
  | { kind: 'vouchers' | 'seals'; amount: number }
  | { kind: 'eventVouchers'; pool: EventPool; amount: number }
  | { kind: 'card'; result: PullResult; extra?: PullResult };

/** Which event-voucher wallet an occurrence (or its key) pays into and spends from. */
export function eventPool(occOrKey: { kind: 'weekly' | 'special' } | string): EventPool {
  if (typeof occOrKey === 'string') return occOrKey.startsWith('weekly-') ? 'weekly' : 'special';
  return occOrKey.kind === 'weekly' ? 'weekly' : 'special';
}

/** Adds event vouchers to one wallet. */
export function grantEventVouchers(state: GameState, pool: EventPool, amount: number): GameState {
  return { ...state, eventVouchers: { ...state.eventVouchers, [pool]: state.eventVouchers[pool] + amount } };
}

/** Banks a card the way a pull does: a new card is ★1, a duplicate adds a shard. */
export function bankEventCard(state: GameState, content: Content, cardId: string): { state: GameState; result: PullResult } {
  const cards = { ...state.cards };
  const cardShards = { ...state.cardShards };
  const cardSpares = { ...state.cardSpares };
  const { kc, ...banked } = bankCard(content, cards, cardShards, cardSpares, cardId, state.kc, new Decimal(0));
  const rarity = content.cards.find((c) => c.id === cardId)?.rarity ?? 'temp';
  return { state: { ...state, cards, cardShards, cardSpares, kc }, result: { cardId, rarity, pityTriggered: null, ...banked } };
}

/**
 * One tier's payout. `free` and `premium` pick the rows: the free row is the tier's reward,
 * the Event Pass row pays PASS_PREMIUM_MULT times its amount, or one more copy of its card.
 */
function grantTier(state: GameState, content: Content, tier: EventTier, pool: EventPool, rows: { free: boolean; premium: boolean } = { free: true, premium: false }): { state: GameState; prize: EventPrize } {
  const r = tier.reward;
  if (r.type !== 'card') {
    const amount = (rows.free ? r.amount : 0) + (rows.premium ? r.amount * PASS_PREMIUM_MULT : 0);
    if (r.type === 'eventVouchers') return { state: grantEventVouchers(state, pool, amount), prize: { kind: 'eventVouchers', pool, amount } };
    if (r.type === 'vouchers') return { state: grantVouchersExact(state, amount), prize: { kind: 'vouchers', amount } };
    return { state: { ...state, seals: state.seals + amount }, prize: { kind: 'seals', amount } };
  }
  const first = bankEventCard(state, content, r.card);
  if (!(rows.free && rows.premium)) return { state: first.state, prize: { kind: 'card', result: first.result } };
  const second = bankEventCard(first.state, content, r.card);
  return { state: second.state, prize: { kind: 'card', result: first.result, extra: second.result } };
}

/** The Event Pass row pays this many times each tier's amount (so a pass holder gets 3x in all). */
export const PASS_PREMIUM_MULT = 2;
/** Paid if the pass is bought after its event has already ended (the store was charged anyway). */
export const PASS_FALLBACK_EVENT_VOUCHERS: Record<EventPool, number> = { weekly: 200, special: 400 };

/**
 * Turns on the Event Pass for the running event of `pool`'s kind and pays the premium row of
 * every tier already claimed. With no such event (it ended mid-checkout) the player gets event
 * vouchers instead, since the store has already taken the money.
 */
export function buyEventPass(state: GameState, content: Content, pool: EventPool): GameState {
  const ev = state.event;
  if (!ev || eventPool(ev.key) !== pool || ev.pass) return grantEventVouchers(state, pool, PASS_FALLBACK_EVENT_VOUCHERS[pool]);
  const track = trackForKey(content, ev.key);
  let next = state;
  for (const i of ev.claimed) if (track[i]) next = grantTier(next, content, track[i], pool, { free: false, premium: true }).state;
  return { ...next, event: { ...ev, pass: true } };
}

/** Each event day's three missions: a stamping goal, a hiring goal, and clearing the office dailies. */
export const EVENT_MISSIONS = [
  { id: 'taps', target: 100, reward: 5 },
  { id: 'hires', target: 10, reward: 5 },
  { id: 'dailies', target: 3, reward: 10 },
] as const;
export type EventMissionId = (typeof EVENT_MISSIONS)[number]['id'];

/** Today's mission counters: the saved day if it is today's, else a fresh one. Days follow the office dailies. */
export function missionDay(state: Pick<GameState, 'event' | 'dailies'>): EventMissionDay {
  const today = state.dailies.date;
  const m = state.event?.missions;
  return m && m.date === today ? m : { date: today, taps: 0, hires: 0, claimed: [] };
}

export function missionProgress(state: Pick<GameState, 'event' | 'dailies'>, id: EventMissionId): number {
  const m = missionDay(state);
  if (id === 'taps') return m.taps;
  if (id === 'hires') return m.hires;
  const d = state.dailies;
  return d.completedToday ? 3 : d.tasks.filter((t) => t.claimed).length;
}

function bumpMission(ev: EventState, state: GameState, field: 'taps' | 'hires', n: number): EventState {
  const m = missionDay(state);
  return { ...ev, missions: { ...m, [field]: m[field] + n } };
}

/** Pays one finished, unclaimed mission in this event's vouchers. */
export function claimEventMission(state: GameState, id: EventMissionId): { state: GameState; amount: number } {
  const ev = state.event;
  const def = EVENT_MISSIONS.find((x) => x.id === id);
  const m = missionDay(state);
  if (!ev || !def || !state.dailies.date || m.claimed.includes(id) || missionProgress(state, id) < def.target) return { state, amount: 0 };
  const paid = grantEventVouchers(state, eventPool(ev.key), def.reward);
  return { state: { ...paid, event: { ...ev, missions: { ...m, claimed: [...m.claimed, id] } } }, amount: def.reward };
}

/** Grants every tier of `track` that `ev` has reached and not yet taken; marks them claimed. */
function grantReached(state: GameState, content: Content, ev: EventState, track: EventTier[]): GameState {
  let next = state;
  const claimed = [...ev.claimed];
  track.forEach((tier, i) => {
    if (claimed.includes(i) || ev.earned.lt(tier.at)) return;
    next = grantTier(next, content, tier, eventPool(ev.key), { free: true, premium: !!ev.pass }).state;
    claimed.push(i);
  });
  return { ...next, event: { ...ev, claimed } };
}

/**
 * Keeps `state.event` on the running occurrence. When the key changes the old event's reached
 * tiers are paid out (the player was never made to claim in time), then progress starts fresh
 * for the new one, or clears if nothing is running.
 */
export function syncEvent(state: GameState, content: Content, nowWall: number, forceId?: string | null): GameState {
  const occ = activeEvent(content, nowWall, forceId);
  if (state.event?.key === occ?.key) return state;
  const old = state.event;
  const paid = old ? grantReached(state, content, old, trackForKey(content, old.key)) : state;
  // Anyone who scored is ranked; their prize waits until the final standings can be read.
  const rankPending = old && old.earned.gt(0) && !paid.rankPending.some((p) => p.key === old.key)
    ? [...paid.rankPending, { key: old.key, ...keyInfo(content, old.key) }]
    : paid.rankPending;
  return {
    ...dropEventCards({ ...paid, rankPending }, content),
    event: occ ? { key: occ.key, points: new Decimal(0), earned: new Decimal(0), staff: {}, claimed: [] } : null,
  };
}

/**
 * Event cards belong to their run of the event: when it ends they leave with the event staff
 * (stars, shards, spares and their equip slot), and the next run collects from scratch.
 */
export function dropEventCards(state: GameState, content: Content): GameState {
  const gone = new Set(content.cards.filter((c) => !keptCard(c)).map((c) => c.id));
  const keep = <T,>(rec: Record<string, T>) => Object.fromEntries(Object.entries(rec).filter(([id]) => !gone.has(id)));
  if (!Object.keys(state.cards).some((id) => gone.has(id)) && !state.equipped.some((id) => gone.has(id))) return state;
  return {
    ...state,
    cards: keep(state.cards),
    cardShards: keep(state.cardShards),
    cardSpares: keep(state.cardSpares),
    equipped: state.equipped.filter((id) => !gone.has(id)),
  };
}

/** Event currency per second: staff base rate × owned × (1 + equipped eventMult cards). */
export function eventRate(state: GameState, content: Content, occ: EventOccurrence): Decimal {
  const ev = state.event;
  if (!ev || ev.key !== occ.key) return new Decimal(0);
  const mult = 1 + cardEventMult(state, content);
  let rate = 0;
  for (const s of occ.staff) rate += s.baseRate * (ev.staff[s.id] ?? 0);
  return new Decimal(rate * mult);
}

export function eventTap(state: GameState, content: Content, occ: EventOccurrence): Decimal {
  return eventRate(state, content, occ).mul(EVENT_TAP_FRACTION).add(1);
}

function credit(ev: EventState, amount: Decimal): EventState {
  return { ...ev, points: ev.points.add(amount), earned: ev.earned.add(amount) };
}

/** One tap on the event stamp. */
export function stampEvent(state: GameState, content: Content, occ: EventOccurrence): GameState {
  if (!state.event || state.event.key !== occ.key) return state;
  return { ...state, event: bumpMission(credit(state.event, eventTap(state, content, occ)), state, 'taps', 1) };
}

/** Accrues `dtSec` of event currency if the saved event is the one running (the tick path). */
export function accrueEvent(state: GameState, content: Content, dtSec: number, nowWall: number, forceId?: string | null): GameState {
  if (!state.event) return state;
  const occ = activeEvent(content, nowWall, forceId);
  if (!occ || occ.key !== state.event.key) return state;
  const rate = eventRate(state, content, occ);
  if (rate.eq(0)) return state;
  return { ...state, event: credit(state.event, rate.mul(dtSec)) };
}

export function buyEventStaff(
  state: GameState,
  content: Content,
  occ: EventOccurrence,
  staffId: string,
  count: 1 | 10 | 'max',
): GameState {
  const ev = state.event;
  const staff = occ.staff.find((s) => s.id === staffId);
  if (!ev || ev.key !== occ.key || !staff) return state;
  const owned = ev.staff[staffId] ?? 0;
  const n = count === 'max' ? maxAffordable(staff, owned, ev.points) : count;
  if (n <= 0) return state;
  const cost = staffBulkCost(staff, owned, n);
  if (!canAfford(cost, ev.points)) return state;
  return { ...state, event: bumpMission({ ...ev, points: ev.points.sub(cost), staff: { ...ev.staff, [staffId]: owned + n } }, state, 'hires', n) };
}

/** Takes one reward-track tier: earned must have reached it, and it pays out once. */
export function claimEventTier(state: GameState, content: Content, occ: EventOccurrence, index: number): GameState {
  return claimEventTierPrize(state, content, occ, index).state;
}

/** `claimEventTier`, plus what it paid (null when nothing was claimable). */
export function claimEventTierPrize(state: GameState, content: Content, occ: EventOccurrence, index: number): { state: GameState; prize: EventPrize | null } {
  const ev = state.event;
  const tier = occ.track[index];
  if (!ev || ev.key !== occ.key || !tier || ev.claimed.includes(index) || ev.earned.lt(tier.at)) return { state, prize: null };
  const { state: paid, prize } = grantTier(state, content, tier, eventPool(occ), { free: true, premium: !!ev.pass });
  return { state: { ...paid, event: { ...ev, claimed: [...ev.claimed, index] } }, prize };
}

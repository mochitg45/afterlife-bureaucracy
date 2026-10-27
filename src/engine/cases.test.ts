import { describe, expect, it } from 'vitest';
import { content } from '../data';
import cases from '../data/cases.json';
import { createInitialState, deserialize, serialize } from './state';
import {
  ARCHIVE_MAX, CASE_VOUCHERS, canRule, caseDay, caseIndex, caseOfDay, caseUnread, majorityOf, markCaseSeen, ruleCase, sanitizeCases, sharesOf, VERDICTS,
} from './cases';

const T = Date.UTC(2026, 9, 27, 15, 0, 0);
const DAY = 86_400_000;
const fresh = () => createInitialState({ wall: T, mono: 0 }, content);

describe('case of the day', () => {
  it('ships 30+ complete files with unique ids', () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) for (const f of [c.name, c.text, c.desc, c.line, c.hint]) expect(f.length).toBeGreaterThan(5);
  });

  it('uses the UTC day, so the same instant gives the same day everywhere', () => {
    expect(caseDay(Date.UTC(2026, 9, 27, 23, 59, 59))).toBe('2026-10-27');
    expect(caseDay(Date.UTC(2026, 9, 28, 0, 0, 0))).toBe('2026-10-28');
  });

  it('is deterministic and cycles through every case before repeating', () => {
    expect(caseOfDay(cases, T)).toBe(caseOfDay(cases, T + 3_600_000));
    const seen = new Set<number>();
    for (let d = 0; d < cases.length; d++) seen.add(caseIndex(caseDay(T + d * DAY), cases.length));
    expect(seen.size).toBe(cases.length);
    expect(caseIndex(caseDay(T), cases.length)).not.toBe(caseIndex(caseDay(T + DAY), cases.length));
  });

  it('still cycles when the list length shares a factor with the stride', () => {
    const seen = new Set<number>();
    for (let d = 0; d < 35; d++) seen.add(caseIndex(caseDay(T + d * DAY), 35));
    expect(seen.size).toBe(35);
  });

  it('pays once a day, flat, and a replay changes nothing', () => {
    const s0 = fresh();
    expect(canRule(s0, T)).toBe(true);
    const s1 = ruleCase(s0, T, 'c-gus', 'heaven', 'hell');
    expect(s1.vouchers - s0.vouchers).toBe(CASE_VOUCHERS);
    expect(s1.voucherFraction).toBe(s0.voucherFraction);
    expect(s1.cases.archive).toEqual([{ day: '2026-10-27', caseId: 'c-gus', verdict: 'heaven', majority: 'hell' }]);
    expect(canRule(s1, T + 1000)).toBe(false);
    expect(ruleCase(s1, T + 1000, 'c-gus', 'hell', null)).toBe(s1);
    expect(canRule(s1, T + DAY)).toBe(true);
  });

  it('keeps only the last 30 rulings', () => {
    let s = fresh();
    for (let d = 0; d < 35; d++) s = ruleCase(s, T + d * DAY, `c${d}`, 'hell', null);
    expect(s.cases.archive).toHaveLength(ARCHIVE_MAX);
    expect(s.cases.archive[0].caseId).toBe('c5');
    expect(s.cases.archive[s.cases.archive.length - 1].caseId).toBe('c34');
    expect(s.vouchers).toBe(35 * CASE_VOUCHERS);
  });

  it('is unread until opened or ruled', () => {
    const s0 = fresh();
    expect(caseUnread(s0, T)).toBe(true);
    const seen = markCaseSeen(s0, T);
    expect(caseUnread(seen, T)).toBe(false);
    expect(markCaseSeen(seen, T)).toBe(seen);
    expect(caseUnread(seen, T + DAY)).toBe(true);
    expect(caseUnread(ruleCase(s0, T, 'c', 'hell', null), T)).toBe(false);
  });

  it('works out the majority and whole-number shares', () => {
    expect(majorityOf(null)).toBeNull();
    expect(majorityOf({ heaven: 0, hell: 0, reincarnate: 0 })).toBeNull();
    expect(majorityOf({ heaven: 3, hell: 8, reincarnate: 1 })).toBe('hell');
    expect(sharesOf({ heaven: 0, hell: 0, reincarnate: 0 })).toBeNull();
    const s = sharesOf({ heaven: 1, hell: 1, reincarnate: 1 })!;
    expect(VERDICTS.reduce((a, v) => a + s[v], 0)).toBe(100);
    expect(sharesOf({ heaven: 38, hell: 62, reincarnate: 0 })).toEqual({ heaven: 38, hell: 62, reincarnate: 0 });
  });

  it('sanitizes junk and survives a save round trip', () => {
    expect(sanitizeCases(null)).toEqual({ lastDay: '', seenDay: '', archive: [] });
    const bad = sanitizeCases({ lastDay: 5, seenDay: '2026-10-27', archive: [null, { day: 'x', caseId: 'a', verdict: 'hell' }, { day: '2026-10-01', caseId: 'a', verdict: 'nope' }, { day: '2026-10-02', caseId: 'a', verdict: 'hell', majority: 'zzz' }] });
    expect(bad).toEqual({ lastDay: '', seenDay: '2026-10-27', archive: [{ day: '2026-10-02', caseId: 'a', verdict: 'hell', majority: null }] });
    const s = ruleCase(fresh(), T, 'c-noor', 'reincarnate', 'heaven');
    expect(deserialize(serialize(s), content).cases).toEqual(s.cases);
  });
});

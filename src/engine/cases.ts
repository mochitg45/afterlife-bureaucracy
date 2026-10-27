import type { GameState } from './state';
import { grantVouchersExact } from './vouchers';

/** Case of the Day: one soul's file a (UTC) day, one ruling, one small reward. */
export const VERDICTS = ['heaven', 'hell', 'reincarnate'] as const;
export type Verdict = (typeof VERDICTS)[number];
export type CaseTally = Record<Verdict, number>;

/** Flat, unmultiplied vouchers for the day's ruling. Paid once a day, ruling or no network. */
export const CASE_VOUCHERS = 10;
export const ARCHIVE_MAX = 30;

export interface ArchiveEntry {
  day: string;
  caseId: string;
  verdict: Verdict;
  /** What most players chose; null when the results could not be fetched. */
  majority: Verdict | null;
}
export interface CasesState {
  /** UTC day of the last ruling (the reward is paid then). */
  lastDay: string;
  /** UTC day whose file the player last opened, for the unread dot. */
  seenDay: string;
  /** Newest last. */
  archive: ArchiveEntry[];
}

export const emptyCases = (): CasesState => ({ lastDay: '', seenDay: '', archive: [] });

const isVerdict = (v: unknown): v is Verdict => VERDICTS.includes(v as Verdict);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The UTC day id, "YYYY-MM-DD". Everyone on Earth shares it, which is why everyone shares the case. */
export function caseDay(wallMs: number): string {
  return new Date(wallMs).toISOString().slice(0, 10);
}

/** Any stride coprime with the list length visits every case once before repeating. */
const STRIDE = 7;
function stride(n: number): number {
  let s = STRIDE;
  while (n > 1 && gcd(s, n) !== 1) s++;
  return s;
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Index into the case list for a UTC day: deterministic, so every player gets the same file. */
export function caseIndex(day: string, n: number): number {
  if (n <= 0) return 0;
  const days = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  return (((days * stride(n)) % n) + n) % n;
}

export function caseOfDay<T>(cases: readonly T[], wallMs: number): T {
  return cases[caseIndex(caseDay(wallMs), cases.length)];
}

export const canRule = (state: Pick<GameState, 'cases'>, wallMs: number): boolean => state.cases.lastDay !== caseDay(wallMs);

/** True until the player has opened today's file or ruled on it. */
export const caseUnread = (state: Pick<GameState, 'cases'>, wallMs: number): boolean =>
  canRule(state, wallMs) && state.cases.seenDay !== caseDay(wallMs);

export function markCaseSeen(state: GameState, wallMs: number): GameState {
  const day = caseDay(wallMs);
  return state.cases.seenDay === day ? state : { ...state, cases: { ...state.cases, seenDay: day } };
}

/** The most-chosen verdict, or null with no votes. A tie goes to the earlier in VERDICTS. */
export function majorityOf(tally: CaseTally | null): Verdict | null {
  if (!tally) return null;
  let best: Verdict | null = null;
  for (const v of VERDICTS) if (tally[v] > 0 && (best === null || tally[v] > tally[best])) best = v;
  return best;
}

/** Whole-number shares that sum to 100 (largest remainder), or null with no votes. */
export function sharesOf(tally: CaseTally): CaseTally | null {
  const total = VERDICTS.reduce((a, v) => a + tally[v], 0);
  if (total <= 0) return null;
  const raw = VERDICTS.map((v) => ({ v, exact: (tally[v] * 100) / total }));
  const out = { heaven: 0, hell: 0, reincarnate: 0 } as CaseTally;
  for (const r of raw) out[r.v] = Math.floor(r.exact);
  let left = 100 - VERDICTS.reduce((a, v) => a + out[v], 0);
  for (const r of [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (left-- <= 0) break;
    out[r.v]++;
  }
  return out;
}

export function trimArchive(archive: ArchiveEntry[]): ArchiveEntry[] {
  return archive.slice(-ARCHIVE_MAX);
}

/**
 * Files today's ruling: pays CASE_VOUCHERS and adds the archive entry. A second ruling on the
 * same UTC day changes nothing, so a replay (or a double tap) cannot pay twice.
 */
export function ruleCase(state: GameState, wallMs: number, caseId: string, verdict: Verdict, majority: Verdict | null): GameState {
  if (!canRule(state, wallMs)) return state;
  const day = caseDay(wallMs);
  const paid = grantVouchersExact(state, CASE_VOUCHERS);
  return {
    ...paid,
    cases: { lastDay: day, seenDay: day, archive: trimArchive([...state.cases.archive, { day, caseId, verdict, majority }]) },
  };
}

export function sanitizeCases(v: unknown): CasesState {
  const r = (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
  const day = (x: unknown) => (typeof x === 'string' && DAY_RE.test(x) ? x : '');
  const archive = (Array.isArray(r.archive) ? r.archive : []).flatMap((e): ArchiveEntry[] => {
    const a = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
    if (!day(a.day) || typeof a.caseId !== 'string' || !isVerdict(a.verdict)) return [];
    return [{ day: a.day as string, caseId: a.caseId.slice(0, 40), verdict: a.verdict, majority: isVerdict(a.majority) ? a.majority : null }];
  });
  return { lastDay: day(r.lastDay), seenDay: day(r.seenDay), archive: trimArchive(archive) };
}

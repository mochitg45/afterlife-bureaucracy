import { simulate, vouchersPerDay, maxSealsPerAudit } from './simulate';
import { content } from '../data';
import { SEAL_CAP_PER_AUDIT, sealCap } from '../engine/prestige';

/** Thirty days, because Cosmic Restructuring and the Seal cap are thirty-day targets. */
const checkIn = { sessionsPerDay: 5, sessionSec: 180, clicksPerSec: 3, days: 30 };
/** Played seconds in the first fourteen days of the check-in profile. */
const DAY_14_SEC = 14 * checkIn.sessionsPerDay * checkIn.sessionSec;

describe('pacing targets (spec §4)', () => {
  const r = simulate(checkIn, content);

  it('unlocks Heaven within 15 minutes of play', () => {
    expect(r.firstUnlockSec.heaven).toBeLessThanOrEqual(15 * 60);
  });

  it('makes the first audit available on day 2 or 3, never day 1', () => {
    expect(r.firstAuditReadySec).not.toBeNull();
    expect(r.firstAuditReadySec!).toBeGreaterThan(900);
    expect(r.firstAuditReadySec!).toBeLessThanOrEqual(2700);
  });

  it('unlocks Hell during the first run, before the first Audit', () => {
    expect(r.firstUnlockSec.hell).toBeDefined();
    expect(r.firstAuditReadySec).not.toBeNull();
    expect(r.firstUnlockSec.hell!).toBeLessThan(r.firstAuditReadySec!);
  });

  it('unlocks Reincarnation no earlier than FY2 and Limbo no earlier than FY3, both by day 14', () => {
    expect(r.firstUnlockYear.reincarnation).toBeDefined();
    expect(r.firstUnlockYear.reincarnation!).toBeGreaterThanOrEqual(2);
    expect(r.firstUnlockYear.limbo).toBeDefined();
    expect(r.firstUnlockYear.limbo!).toBeGreaterThanOrEqual(3);
    expect(r.firstUnlockSec.reincarnation!).toBeLessThanOrEqual(DAY_14_SEC);
    expect(r.firstUnlockSec.limbo!).toBeLessThanOrEqual(DAY_14_SEC);
  });

  it('files between 20 and 90 Audits in 30 days (at most three 8-hour fiscal years a day)', () => {
    // The souls threshold is met well inside the 8-hour minimum fiscal year, so the clock, not
    // the economy, paces the Audits. The per-run "15% faster" ratios no longer describe that.
    const audits = r.days[r.days.length - 1].audits;
    expect(audits).toBeGreaterThanOrEqual(20);
    expect(audits).toBeLessThanOrEqual(30 * 3);
  });

  it('a 20-seal, four-perk run reaches the audit threshold at least 1.3x faster', () => {
    // Only the first Audit matters here, and the target puts it inside day 3; simulating the
    // remaining days would just be an expensive way to reach the same number.
    const seeded = simulate(
      { ...checkIn, days: 4, startSeals: 20, startPerks: ['throughput-1', 'throughput-2', 'headstart-1', 'headstart-2'] },
      content,
    );
    expect(r.firstAuditReadySec).not.toBeNull();
    expect(seeded.firstAuditReadySec).not.toBeNull();
    expect(seeded.firstAuditReadySec! * 1.3).toBeLessThanOrEqual(r.firstAuditReadySec!);
  });

  it('files no Cosmic Restructuring in the first 30 days', () => {
    // Six thousand Seals is a two-month climb (about day 55 in the 365-day report).
    expect(r.cosmicDays.length).toBe(0);
  });

  it('pays a free player 8-16 vouchers a day from the daily faucet over days 3-14', () => {
    // The recurring faucet — three daily tasks plus the seven-day streak pack. Lowered from
    // 20-40 when a task dropped to 1 voucher (5 when ad-skipped): two claims plus one ad-skip
    // is 7 a day, and the streak pack adds about 30/7 on top. Achievement grants are a separate one-off budget (1,700
    // vouchers across 80 unlocks) that lands mostly in the first fortnight on top of this.
    const faucet = vouchersPerDay(r, 3, 14, 'tasks');
    expect(faucet).toBeGreaterThanOrEqual(8);
    expect(faucet).toBeLessThanOrEqual(16);
  });

  it('never pays an Audit more than the cap its Clauses have earned', () => {
    // The ceiling scales with the Clause Seal multiplier, so the target is per-Audit rather
    // than a single number: each payout is checked against the cap in force at that filing.
    expect(r.sealsPerAudit.length).toBeGreaterThan(0);
    expect(r.sealMultPerAudit).toHaveLength(r.sealsPerAudit.length);
    for (const [i, seals] of r.sealsPerAudit.entries()) {
      expect(seals).toBeLessThanOrEqual(sealCap(r.sealMultPerAudit[i]));
    }
    // And with no Clause bought at all, that cap is the flat constant.
    expect(maxSealsPerAudit(r)).toBeLessThanOrEqual(SEAL_CAP_PER_AUDIT * Math.max(...r.sealMultPerAudit));
    expect(SEAL_CAP_PER_AUDIT).toBe(120);
    expect(sealCap()).toBe(120);
  });
});

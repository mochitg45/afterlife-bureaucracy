import { simulate } from './simulate';
import { content } from '../data';

const checkIn = { sessionsPerDay: 5, sessionSec: 180, clicksPerSec: 3, days: 14 };

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
  });

  it('makes each of the first five runs at least 15% faster to the Audit than the one before', () => {
    const t = r.auditReadySecByRun;
    expect(t.length).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < 4; i++) {
      expect(t[i]).toBeGreaterThan(0);
      expect(t[i + 1]).toBeLessThanOrEqual(0.85 * t[i]);
    }
  });

  it('a 20-seal, four-perk run reaches the audit threshold at least 1.3x faster', () => {
    // Only the first Audit matters here, and the target puts it inside day 3; simulating the
    // remaining eleven days would just be an expensive way to reach the same number.
    const seeded = simulate(
      { ...checkIn, days: 4, startSeals: 20, startPerks: ['throughput-1', 'throughput-2', 'headstart-1', 'headstart-2'] },
      content,
    );
    expect(r.firstAuditReadySec).not.toBeNull();
    expect(seeded.firstAuditReadySec).not.toBeNull();
    expect(seeded.firstAuditReadySec! * 1.3).toBeLessThanOrEqual(r.firstAuditReadySec!);
  });
});

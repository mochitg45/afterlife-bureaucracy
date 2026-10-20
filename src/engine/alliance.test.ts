import { allianceWeek, allianceWeekEnd, allianceName, claimAllianceTier, claimableAllianceTiers, normalizeAllianceCode, sanitizeAlliance, ALLIANCE_TIERS } from './alliance';
import { createInitialState, deserialize, serialize } from './state';
import { content } from '../data';

const fresh = () => createInitialState({ wall: 0, mono: 0 }, content);

describe('alliance week', () => {
  it('rolls over at Monday 00:00 UTC', () => {
    const sunday = Date.UTC(2026, 9, 25, 23, 59, 59); // Sun 25 Oct 2026
    const monday = Date.UTC(2026, 9, 26, 0, 0, 0);
    expect(allianceWeek(monday)).toBe(allianceWeek(sunday) + 1);
    expect(allianceWeek(Date.UTC(2026, 9, 20, 12))).toBe(allianceWeek(sunday)); // Tue, same week
    expect(allianceWeekEnd(allianceWeek(sunday))).toBe(monday);
    expect(allianceWeek(Date.UTC(1970, 0, 5))).toBe(0);
  });
});

describe('alliance tiers', () => {
  const week = 2963;
  it('lists reached, untaken tiers', () => {
    expect(claimableAllianceTiers(fresh(), week, 2_999)).toEqual([]);
    expect(claimableAllianceTiers(fresh(), week, 10_000)).toEqual([0, 1]);
    expect(claimableAllianceTiers(fresh(), week, 99_999)).toEqual([0, 1, 2]);
  });

  it('pays a tier once per week, vouchers flat and seals', () => {
    const s = claimAllianceTier(fresh(), 1, week, 12_000);
    expect(s.vouchers).toBe(ALLIANCE_TIERS[1].vouchers);
    expect(s.seals).toBe(ALLIANCE_TIERS[1].seals);
    expect(s.alliance).toEqual({ week, claimed: [1] });
    expect(claimAllianceTier(s, 1, week, 12_000)).toBe(s);
    expect(claimAllianceTier(s, 2, week, 12_000)).toBe(s); // not reached
    expect(claimAllianceTier(s, 7, week, 99_999)).toBe(s); // no such tier
    // Next week the same tier pays again, and last week's claims are dropped.
    const next = claimAllianceTier(s, 1, week + 1, 12_000);
    expect(next.alliance).toEqual({ week: week + 1, claimed: [1] });
    expect(next.vouchers).toBe(2 * ALLIANCE_TIERS[1].vouchers);
  });

  it('sanitizes the saved claims', () => {
    expect(sanitizeAlliance(undefined)).toEqual({ week: 0, claimed: [] });
    expect(sanitizeAlliance({ week: -3, claimed: [0, 0, 9, 'x', 1.5, 2] })).toEqual({ week: 0, claimed: [0, 2] });
    const s = { ...fresh(), alliance: { week, claimed: [0, 1] } };
    expect(deserialize(serialize(s), content).alliance).toEqual({ week, claimed: [0, 1] });
    // An old save without the field loads with none claimed.
    const raw = JSON.parse(serialize(fresh()));
    delete raw.alliance;
    expect(deserialize(JSON.stringify(raw), content).alliance).toEqual({ week: 0, claimed: [] });
  });
});

describe('alliance names and codes', () => {
  it('names fit the 24-character limit', () => {
    for (let i = 0; i < 200; i++) expect(allianceName().length).toBeLessThanOrEqual(24);
    expect(allianceName(() => 0)).toBe('Eternal Stampers');
  });
  it('normalizes invite codes', () => {
    expect(normalizeAllianceCode(' abc234 ')).toBe('ABC234');
    expect(normalizeAllianceCode('ABCI23')).toBeNull();
    expect(normalizeAllianceCode('ABC23')).toBeNull();
  });
});

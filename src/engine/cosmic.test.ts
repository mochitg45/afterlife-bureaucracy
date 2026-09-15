import Decimal from 'break_infinity.js';
import { createInitialState, deserialize, startingDepartments, type GameState } from './state';
import { content } from '../data';
import { loadContent } from './content';
import intake from '../data/departments/intake.json';
import valhalla from '../data/departments/valhalla.json';
import clauses from '../data/cosmic.json';
import {
  COSMIC_THRESHOLD, CLAUSE_COST, canCosmic, fileCosmic, canBuyClause, buyClause,
  clauseGlobalMult, clauseSealMult, clauseOfflineCapHours, clauseVoucherMult,
} from './cosmic';
import { unlockDepartments } from './actions';
import { globalMult } from './economy';
import { offlineCapSeconds } from './offline';
import { grantVouchers } from './vouchers';
import { sealsForRun, fileAudit, auditThreshold, AUDIT_BASE, SEAL_COEFF } from './prestige';

const now = { wall: 0, mono: 0 };

/** A state that has already earned its way to the Cosmic threshold, with things to lose. */
function loaded(): GameState {
  const base = createInitialState(now, content);
  return {
    ...base,
    seals: 150,
    perks: ['throughput-1', 'requisition-1', 'requisition-3'],
    kc: new Decimal('1e20'),
    soulsRun: new Decimal('5e20'),
    soulsLifetime: new Decimal('9e30'),
    vouchers: 11,
    fiscalYear: 7,
    staff: { dave: 40, seraphine: 12 },
    upgrades: { 'faster-stapler': 3 },
    deptsUnlocked: ['intake', 'heaven', 'hell'],
    activeDept: 'hell',
    cards: { 'c-dave-overtime': 3, 'c-seraphine-chipper': 2, 'c-gary-break': 1, 'c-cherub-choir': 1 },
    equipped: ['c-dave-overtime', 'c-seraphine-chipper', 'c-gary-break', 'c-cherub-choir'],
    cosmicPoints: 2,
    stats: { ...base.stats, cosmics: 4, audits: 9 },
  };
}

describe('canCosmic', () => {
  it('opens at exactly COSMIC_THRESHOLD seals', () => {
    expect(COSMIC_THRESHOLD).toBe(100);
    expect(canCosmic({ seals: COSMIC_THRESHOLD - 1 })).toBe(false);
    expect(canCosmic({ seals: COSMIC_THRESHOLD })).toBe(true);
    expect(canCosmic({ seals: COSMIC_THRESHOLD + 500 })).toBe(true);
  });
});

describe('fileCosmic', () => {
  it('is a no-op below the threshold, handing back the very same state', () => {
    const s = { ...loaded(), seals: 99 };
    const r = fileCosmic(s, content);
    expect(r.state).toBe(s);
    expect(r.pointsGained).toBe(0);
  });
  it('clears seals and perks, resets the run and grants one Cosmic Point', () => {
    const s = loaded();
    const r = fileCosmic(s, content);
    expect(r.pointsGained).toBe(1);
    expect(r.state.seals).toBe(0);
    expect(r.state.perks).toEqual([]);
    expect(r.state.kc.eq(0)).toBe(true);
    expect(r.state.soulsRun.eq(0)).toBe(true);
    expect(r.state.staff).toEqual({});
    expect(r.state.upgrades).toEqual({});
    expect(r.state.deptsUnlocked).toEqual(startingDepartments(content));
    expect(r.state.activeDept).toBe(startingDepartments(content)[0]);
    expect(r.state.cosmicPoints).toBe(3);
    expect(r.state.stats.cosmics).toBe(5);
  });
  it('leaves the fiscal year, lifetime souls, vouchers, cards and audit count alone', () => {
    const s = loaded();
    const r = fileCosmic(s, content);
    expect(r.state.fiscalYear).toBe(7);
    expect(r.state.soulsLifetime.eq(s.soulsLifetime)).toBe(true);
    expect(r.state.vouchers).toBe(11);
    expect(r.state.cards).toEqual(s.cards);
    expect(r.state.stats.audits).toBe(9);
  });
  it('clamps equipped cards back to the slots the perk-less state pays for', () => {
    const s = loaded();
    expect(s.equipped).toHaveLength(4);
    expect(fileCosmic(s, content).state.equipped).toEqual(s.equipped.slice(0, 3));
  });
  it('keeps clauses and branches already bought', () => {
    const s = { ...loaded(), cosmicClauses: ['clause-throughput-1'], branchesUnlocked: ['valhalla'] };
    const r = fileCosmic(s, content);
    expect(r.state.cosmicClauses).toEqual(['clause-throughput-1']);
    expect(r.state.branchesUnlocked).toEqual(['valhalla']);
  });
});

describe('buyClause', () => {
  const withPoints = (points: number, owned: string[] = []): GameState => ({
    ...createInitialState(now, content),
    cosmicPoints: points,
    cosmicClauses: owned,
  });

  it('costs one point and appends the clause', () => {
    expect(CLAUSE_COST).toBe(1);
    const s = buyClause(withPoints(2), content, 'clause-throughput-1');
    expect(s.cosmicPoints).toBe(1);
    expect(s.cosmicClauses).toEqual(['clause-throughput-1']);
  });
  it('refuses an unknown clause id', () => {
    const s = withPoints(3);
    expect(buyClause(s, content, 'clause-nope')).toBe(s);
    expect(canBuyClause(s, content, 'clause-nope')).toEqual({ ok: false, reason: 'unknown' });
  });
  it('refuses a clause already owned', () => {
    const s = withPoints(3, ['clause-throughput-1']);
    expect(buyClause(s, content, 'clause-throughput-1')).toBe(s);
    expect(canBuyClause(s, content, 'clause-throughput-1')).toEqual({ ok: false, reason: 'owned' });
  });
  it('refuses a clause whose prerequisite is not owned', () => {
    const s = withPoints(3);
    expect(buyClause(s, content, 'clause-throughput-2')).toBe(s);
    expect(canBuyClause(s, content, 'clause-throughput-2')).toEqual({ ok: false, reason: 'locked' });
    const ready = withPoints(3, ['clause-throughput-1']);
    expect(canBuyClause(ready, content, 'clause-throughput-2')).toEqual({ ok: true });
  });
  it('refuses when the player has no Cosmic Point to spend', () => {
    const s = withPoints(0);
    expect(buyClause(s, content, 'clause-throughput-1')).toBe(s);
    expect(canBuyClause(s, content, 'clause-throughput-1')).toEqual({ ok: false, reason: 'points' });
  });
  it('appends the branch for an unlockBranch clause, once', () => {
    const s = buyClause(withPoints(2, ['clause-throughput-1']), content, 'clause-valhalla');
    expect(s.cosmicClauses).toContain('clause-valhalla');
    expect(s.branchesUnlocked).toEqual(['valhalla']);
  });
  it('leaves branchesUnlocked alone for clauses that unlock nothing', () => {
    expect(buyClause(withPoints(1), content, 'clause-seals-1').branchesUnlocked).toEqual([]);
  });
});

describe('clause multipliers', () => {
  const owning = (...ids: string[]) => ({ cosmicClauses: ids });

  it('compounds the throughput clauses into the global multiplier', () => {
    expect(clauseGlobalMult(owning(), content).toNumber()).toBe(1);
    expect(clauseGlobalMult(owning('clause-throughput-1'), content).toNumber()).toBeCloseTo(1.5);
    expect(clauseGlobalMult(owning('clause-throughput-1', 'clause-throughput-2'), content).toNumber()).toBeCloseTo(3);
    expect(
      clauseGlobalMult(owning('clause-throughput-1', 'clause-throughput-2', 'clause-throughput-3'), content).toNumber(),
    ).toBeCloseTo(9);
  });
  it('multiplies the seal clauses together', () => {
    expect(clauseSealMult(owning(), content)).toBe(1);
    expect(clauseSealMult(owning('clause-seals-1'), content)).toBeCloseTo(1.5);
    expect(clauseSealMult(owning('clause-seals-1', 'clause-seals-2'), content)).toBeCloseTo(3);
  });
  it('sums the offline cap clauses in hours', () => {
    expect(clauseOfflineCapHours(owning(), content)).toBe(0);
    expect(clauseOfflineCapHours(owning('clause-overtime-1'), content)).toBe(24);
  });
  it('raises the voucher multiplier', () => {
    expect(clauseVoucherMult(owning(), content)).toBe(1);
    expect(clauseVoucherMult(owning('clause-requisition-1'), content)).toBeCloseTo(1.5);
  });
  it('ignores clause ids this build does not ship', () => {
    expect(clauseGlobalMult(owning('clause-from-the-future'), content).toNumber()).toBe(1);
    expect(clauseSealMult(owning('clause-from-the-future'), content)).toBe(1);
  });
});

describe('clauses applied across the engine', () => {
  it('feeds the global multiplier in economy', () => {
    const base = createInitialState(now, content);
    const before = globalMult(base, content, 0);
    const after = globalMult({ ...base, cosmicClauses: ['clause-throughput-1'] }, content, 0);
    expect(after.div(before).toNumber()).toBeCloseTo(1.5);
  });
  it('adds its hours to the offline cap', () => {
    const base = createInitialState(now, content);
    expect(offlineCapSeconds(base, content)).toBe(4 * 3600);
    expect(offlineCapSeconds({ ...base, cosmicClauses: ['clause-overtime-1'] }, content)).toBe(28 * 3600);
  });
  it('multiplies voucher grants', () => {
    const base = createInitialState(now, content);
    expect(grantVouchers(base, content, 10).vouchers).toBe(10);
    expect(grantVouchers({ ...base, cosmicClauses: ['clause-requisition-1'] }, content, 10).vouchers).toBe(15);
  });
  it('multiplies the Seals a run pays out', () => {
    const souls = new Decimal(AUDIT_BASE);
    expect(sealsForRun(souls, 1)).toBe(SEAL_COEFF);
    expect(sealsForRun(souls, 1, 1.5)).toBe(Math.floor(SEAL_COEFF * 1.5));
    expect(sealsForRun(souls, 1, 3)).toBe(SEAL_COEFF * 3);
  });
  it('pays fileAudit at the clause seal multiplier without the caller asking', () => {
    const base = { ...createInitialState(now, content), soulsRun: auditThreshold(1) };
    const plain = fileAudit(base, content).sealsGained;
    const doubled = fileAudit({ ...base, cosmicClauses: ['clause-seals-1', 'clause-seals-2'] }, content).sealsGained;
    expect(plain).toBe(SEAL_COEFF);
    expect(doubled).toBe(SEAL_COEFF * 3);
  });
});

describe('branch gating', () => {
  it('keeps a branch department out of the starting set even at unlockSouls 0', () => {
    const free = { ...valhalla, unlockSouls: 0 };
    const c = loadContent([intake, free]);
    expect(startingDepartments(c)).toEqual(['intake']);
  });
  it('does not unlock a branch department on souls alone', () => {
    const base = createInitialState(now, content);
    const rich = { ...base, soulsRun: new Decimal('1e30') };
    expect(unlockDepartments(rich, content).deptsUnlocked).not.toContain('valhalla');
  });
  it('unlocks it once the branch is open and the souls threshold is met', () => {
    const base = createInitialState(now, content);
    const rich = { ...base, soulsRun: new Decimal('1e30'), branchesUnlocked: ['valhalla'] };
    expect(unlockDepartments(rich, content).deptsUnlocked).toContain('valhalla');
  });
  it('drops a branch department from a save whose branch is not open', () => {
    const raw = { saveVersion: 6, deptsUnlocked: ['intake', 'valhalla'], activeDept: 'valhalla', branchesUnlocked: [] };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.deptsUnlocked).toEqual(['intake']);
    expect(s.activeDept).toBe('intake');
  });
  it('keeps it when the save also carries the unlocked branch', () => {
    const raw = { saveVersion: 6, deptsUnlocked: ['intake', 'valhalla'], activeDept: 'valhalla', branchesUnlocked: ['valhalla'] };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.deptsUnlocked).toEqual(['intake', 'valhalla']);
    expect(s.activeDept).toBe('valhalla');
  });
  it('still withholds it below the souls threshold with the branch open', () => {
    const base = createInitialState(now, content);
    const poor = { ...base, soulsRun: new Decimal(1000), branchesUnlocked: ['valhalla'] };
    expect(unlockDepartments(poor, content).deptsUnlocked).not.toContain('valhalla');
  });
});

describe('cosmic content', () => {
  it('ships eight clauses with unique ids and prerequisites that exist', () => {
    expect(content.clauses).toHaveLength(8);
    const ids = content.clauses.map((c) => c.id);
    expect(new Set(ids).size).toBe(8);
    expect(ids).toEqual([
      'clause-throughput-1', 'clause-throughput-2', 'clause-throughput-3',
      'clause-seals-1', 'clause-seals-2', 'clause-overtime-1',
      'clause-requisition-1', 'clause-valhalla',
    ]);
    for (const c of content.clauses) for (const r of c.requires) expect(ids, c.id).toContain(r);
  });
  it('writes every clause in the Cosmic Restructuring memo voice', () => {
    for (const c of content.clauses) {
      expect(c.name.length, c.id).toBeGreaterThan(0);
      expect(c.desc, c.id).toMatch(/Memo from Cosmic Restructuring:/);
    }
  });
  it('rejects a duplicate clause id', () => {
    expect(() => loadContent([intake], [], { clauses: [clauses[0], clauses[0]] })).toThrow(/duplicate clause/i);
  });
  it('rejects a clause whose prerequisite does not exist', () => {
    const bad = [{ id: 'x', name: 'X', desc: '', requires: ['nope'], effect: { type: 'globalMult', value: 1 } }];
    expect(() => loadContent([intake], [], { clauses: bad })).toThrow(/unknown clause prerequisite/i);
  });
  it('rejects an unlockBranch clause naming a branch no department declares', () => {
    const bad = [{ id: 'x', name: 'X', desc: '', requires: [], effect: { type: 'unlockBranch', branch: 'atlantis' } }];
    expect(() => loadContent([intake, valhalla], [], { clauses: bad })).toThrow(/unknown branch/i);
  });
  it('accepts an unlockBranch clause a department declares', () => {
    const ok = [{ id: 'x', name: 'X', desc: '', requires: [], effect: { type: 'unlockBranch', branch: 'valhalla' } }];
    expect(() => loadContent([intake, valhalla], [], { clauses: ok })).not.toThrow();
  });
});

describe('Valhalla content', () => {
  const dept = () => content.departments.find((d) => d.id === 'valhalla')!;

  it('ships as a branch department behind the Valhalla clause', () => {
    const d = dept();
    expect(d.branch).toBe('valhalla');
    expect(d.name).toBe('Valhalla Intake Annex');
    expect(d.unlockSouls).toBe(1e15);
    expect(d.accent).toBe('#B5651D');
  });
  it('ships five staff, four upgrades and full queue and memo pools', () => {
    const d = dept();
    expect(d.staff.map((s) => s.id)).toEqual(['v-shieldmaiden', 'v-skald', 'v-quartermaster', 'v-einherjar', 'v-valkyrie']);
    expect(d.upgrades).toHaveLength(4);
    expect(d.queue.length).toBeGreaterThanOrEqual(15);
    expect(d.memos.length).toBeGreaterThanOrEqual(15);
    expect(new Set(d.queue).size).toBe(d.queue.length);
    expect(new Set(d.memos).size).toBe(d.memos.length);
  });
  it('prices its staff from 1e14 rising sevenfold, at rates from 1e12 rising fivefold', () => {
    const d = dept();
    d.staff.forEach((s, i) => {
      expect(s.baseCost / (1e14 * 7 ** i), s.id).toBeCloseTo(1, 6);
      expect(s.baseRate / (1e12 * 5 ** i), s.id).toBeCloseTo(1, 6);
    });
  });
  it('draws its staff from the angel and demon archetypes', () => {
    for (const s of dept().staff) expect(s.character, s.id).toMatch(/^(angel|demon):\d+$/);
  });
  it('keeps the office voice, mead included', () => {
    expect(dept().memos.join('\n')).toContain('Mead is not a stationery item.');
  });
});

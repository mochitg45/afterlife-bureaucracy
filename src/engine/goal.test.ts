import Decimal from 'break_infinity.js';
import { createInitialState, type GameState } from './state';
import { content } from '../data';
import { nextGoal } from './goal';
import { auditThreshold } from './prestige';
import { staffUnitCost, upgradeCost } from './economy';
import { findDepartment } from './content';

const fresh = (patch: Partial<GameState> = {}): GameState => ({ ...createInitialState({ wall: 0, mono: 0 }, content), ...patch });
const intake = findDepartment(content, 'intake');
const [dave, second] = intake.staff;
const firstUpgrade = intake.upgrades[0];
/** Enough Karma for one hire of `s` at `owned`, but less than any upgrade. */
const kcFor = (cost: Decimal) => cost.mul(1.0001);

describe('nextGoal', () => {
  it('tells a broke player to stamp', () => {
    expect(nextGoal(fresh(), content)).toEqual({ text: 'Stamp souls to earn Karma Credits', where: { kind: 'office', selector: '[data-coach="stamp"]' } });
  });

  it('says "Hire <name>" for a first hire', () => {
    const g = nextGoal(fresh({ kc: kcFor(staffUnitCost(dave, 0)) }), content);
    expect(g.text).toBe(`Hire ${dave.name}`);
    expect(g.where).toEqual({ kind: 'office', selector: `[data-goal="staff-${dave.id}"]` });
  });

  it('prefers the clerk closest to its next ×2 and counts the hires left', () => {
    const kc = Decimal.max(staffUnitCost(dave, 7), staffUnitCost(second, 1)).mul(1.0001);
    const g = nextGoal(fresh({ kc, staff: { [dave.id]: 7, [second.id]: 1 }, upgrades: Object.fromEntries(intake.upgrades.map((u) => [u.id, u.maxLevel])) }), content);
    expect(g.text).toBe(`Hire 3 more ${dave.name} for ×2 speed`);
  });

  it('suggests an affordable upgrade before staff', () => {
    const g = nextGoal(fresh({ kc: upgradeCost(firstUpgrade, 0).mul(1.0001) }), content);
    expect(g.text).toBe(`Buy upgrade ${firstUpgrade.name}`);
  });

  it('points at a nearly-open department', () => {
    const next = content.departments.find((d) => d.unlockSouls > 0 && !d.branch)!;
    const g = nextGoal(fresh({ soulsRun: new Decimal(next.unlockSouls * 0.6) }), content);
    expect(g.text).toMatch(new RegExp(`^Reach .+ souls to open ${next.name}$`));
    expect(nextGoal(fresh({ soulsRun: new Decimal(next.unlockSouls * 0.1) }), content).text).toBe('Stamp souls to earn Karma Credits');
  });

  it('sends a player with vouchers to Personnel', () => {
    expect(nextGoal(fresh({ vouchers: 10 }), content)).toEqual({ text: 'Draw a requisition in Personnel', where: { kind: 'tab', tab: 'personnel' } });
    expect(nextGoal(fresh({ vouchers: 9 }), content).text).not.toMatch(/requisition/);
  });

  it('sends a finished, unclaimed daily to Tasks', () => {
    const def = content.dailies.find((d) => d.kind === 'clicks')!;
    const s = fresh({ vouchers: 50 });
    const withTask = { ...s, stats: { ...s.stats, clicks: def.target }, dailies: { ...s.dailies, tasks: [{ id: def.id, claimed: false }] } };
    expect(nextGoal(withTask, content).text).toBe('Claim your daily task');
    const claimed = { ...withTask, dailies: { ...withTask.dailies, tasks: [{ id: def.id, claimed: true }] } };
    expect(nextGoal(claimed, content).text).toBe('Draw a requisition in Personnel');
  });

  it('puts an available Audit above everything', () => {
    const g = nextGoal(fresh({ soulsRun: auditThreshold(1), vouchers: 50 }), content);
    expect(g).toEqual({ text: 'File an Audit in the Ledger for Seals', where: { kind: 'tab', tab: 'ledger' } });
  });
});

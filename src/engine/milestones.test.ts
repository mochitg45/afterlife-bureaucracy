import Decimal from 'break_infinity.js';
import { content } from '../data';
import { createInitialState, startingDepartments, type GameState } from './state';
import { nextMilestones, soulsTier } from './milestones';

const base = (over: Partial<GameState> = {}): GameState => ({ ...createInitialState({ wall: 0, mono: 0 }, content), ...over });
const extraDept = content.departments.map((d) => d.id).find((id) => !startingDepartments(content).includes(id))!;

describe('milestones', () => {
  it('tier math', () => {
    expect(soulsTier(new Decimal(999_999))).toBe(0);
    expect(soulsTier(new Decimal(1e6))).toBe(2);
    expect(soulsTier(new Decimal(1e9))).toBe(3);
    expect(soulsTier(new Decimal(1e12))).toBe(4);
    expect(soulsTier(new Decimal(9.99e14))).toBe(4);
    expect(soulsTier(new Decimal(1e15))).toBe(5);
  });

  it('silently baselines an existing player', () => {
    const s = base({ soulsLifetime: new Decimal(5e9), deptsUnlocked: [...startingDepartments(content), extraDept] });
    const r = nextMilestones(s, content);
    expect(r.queue).toEqual([]);
    expect(r.next.soulsTier).toBe(3);
    expect(r.next.depts).toContain(extraDept);
    expect(nextMilestones({ ...s, milestones: r.next }, content).queue).toEqual([]);
  });

  it('celebrates new crossings once, and never starting depts', () => {
    let s = base({ soulsLifetime: new Decimal(10) });
    s = { ...s, milestones: nextMilestones(s, content).next };
    expect(nextMilestones(s, content).queue).toEqual([]);
    s = { ...s, soulsLifetime: new Decimal(2e9), deptsUnlocked: [...s.deptsUnlocked, extraDept] };
    const r = nextMilestones(s, content);
    expect(r.queue).toEqual([{ kind: 'souls', tier: 2 }, { kind: 'souls', tier: 3 }, { kind: 'dept', id: extraDept }]);
    expect(nextMilestones({ ...s, milestones: r.next }, content).queue).toEqual([]);
  });
});

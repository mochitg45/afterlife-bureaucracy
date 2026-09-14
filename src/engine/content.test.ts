import { loadContent, findStaff, findUpgrade } from './content';
import { content } from '../data';
import intake from '../data/departments/intake.json';

describe('content', () => {
  it('loads the intake department', () => {
    const c = loadContent([intake]);
    expect(c.departments[0].id).toBe('intake');
    expect(c.departments[0].staff.map((s) => s.id)).toEqual(['dave', 'seraphine', 'gary', 'auditor']);
    expect(c.departments[0].upgrades.length).toBeGreaterThanOrEqual(3);
    expect(c.departments[0].queue.length).toBeGreaterThanOrEqual(15);
    expect(c.departments[0].memos.length).toBeGreaterThanOrEqual(15);
  });
  it('rejects a department with a duplicate staff id', () => {
    const bad = { ...intake, staff: [intake.staff[0], intake.staff[0]] };
    expect(() => loadContent([bad])).toThrow(/duplicate/i);
  });
  it('rejects unknown effect types', () => {
    const bad = { ...intake, upgrades: [{ ...intake.upgrades[0], effect: { type: 'nope', value: 1 } }] };
    expect(() => loadContent([bad])).toThrow();
  });
  it('finds staff and upgrades by id', () => {
    const c = loadContent([intake]);
    expect(findStaff(c, 'gary').staff.name).toBe('Gary');
    expect(findUpgrade(c, 'faster-stapler').upgrade.effect.type).toBe('click');
    expect(() => findStaff(c, 'nobody')).toThrow(/unknown staff/i);
  });
  it('gives every department at least two distinct queue and memo lines', () => {
    // pick() rotates by re-drawing until it differs from the current line; a
    // department with only one distinct line would make that a pointless spin.
    for (const dept of content.departments) {
      expect(new Set(dept.queue).size).toBeGreaterThanOrEqual(2);
      expect(new Set(dept.memos).size).toBeGreaterThanOrEqual(2);
    }
  });
});

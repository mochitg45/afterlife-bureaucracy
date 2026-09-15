import { loadContent, findStaff, findUpgrade, findPerk, findCard } from './content';
import { content } from '../data';
import intake from '../data/departments/intake.json';
import cards from '../data/cards.json';
import dailies from '../data/dailies.json';
import achievements from '../data/achievements.json';

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
  it('rejects a content set with no starting department', () => {
    const paid = { ...intake, unlockSouls: 100 };
    expect(() => loadContent([paid])).toThrow(/starting department/i);
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

describe('perks content', () => {
  it('loads the perk tree with five branches and about 40 nodes', () => {
    expect(content.perks.length).toBeGreaterThanOrEqual(36);
    const branches = new Set(content.perks.map((p) => p.branch));
    expect([...branches].sort()).toEqual(['headstart', 'overtime', 'requisition', 'stapler', 'throughput']);
  });
  it('rejects a perk whose prerequisite does not exist', () => {
    const bad = [{ id: 'x', name: 'X', desc: '', branch: 'stapler', cost: 1, requires: ['nope'], effect: { type: 'click', value: 1 } }];
    expect(() => loadContent([intake], bad)).toThrow(/unknown perk/i);
  });
  it('rejects a perk referencing an unknown department or staff', () => {
    const badDept = [{ id: 'x', name: 'X', desc: '', branch: 'headstart', cost: 1, requires: [], effect: { type: 'headStartDept', dept: 'nowhere' } }];
    expect(() => loadContent([intake], badDept)).toThrow(/unknown department/i);
    const badStaff = [{ id: 'y', name: 'Y', desc: '', branch: 'headstart', cost: 1, requires: [], effect: { type: 'headStartStaff', staff: 'nobody', count: 1 } }];
    expect(() => loadContent([intake], badStaff)).toThrow(/unknown staff/i);
  });
  it('finds a perk by id and throws for unknown', () => {
    expect(findPerk(content, 'throughput-1').branch).toBe('throughput');
    expect(() => findPerk(content, 'zzz')).toThrow(/unknown perk/i);
  });
  it('accepts an optional memosLate pool', () => {
    const c = loadContent([{ ...intake, memosLate: ['MEMO: year two.'] }]);
    expect(c.departments[0].memosLate).toEqual(['MEMO: year two.']);
  });
});

describe('shipped departments', () => {
  it('ships six departments in unlock order with the spec thresholds and accents', () => {
    expect(content.departments.map((d) => [d.id, d.unlockSouls, d.accent])).toEqual([
      ['intake', 0, '#1F3B33'],
      ['heaven', 10000, '#3E9C93'],
      ['hell', 250000, '#A6402B'],
      ['reincarnation', 9.6e15, '#A8823C'],
      ['limbo', 2.4e17, '#6B6478'],
      ['valhalla', 5e18, '#B5651D'],
    ]);
  });
  it('gates exactly one department behind a Cosmic branch', () => {
    expect(content.departments.filter((d) => d.branch).map((d) => d.id)).toEqual(['valhalla']);
  });
  it('every department has 4-6 staff, 3-6 upgrades, 15+ queue lines and 15+ memos', () => {
    for (const d of content.departments) {
      expect(d.staff.length, d.id).toBeGreaterThanOrEqual(4);
      expect(d.staff.length, d.id).toBeLessThanOrEqual(6);
      expect(d.upgrades.length, d.id).toBeGreaterThanOrEqual(3);
      expect(d.upgrades.length, d.id).toBeLessThanOrEqual(6);
      expect(d.queue.length, d.id).toBeGreaterThanOrEqual(15);
      expect(d.memos.length, d.id).toBeGreaterThanOrEqual(15);
    }
  });
  it('staff costs and rates rise monotonically within each department', () => {
    for (const d of content.departments) {
      for (let i = 1; i < d.staff.length; i++) {
        expect(d.staff[i].baseCost, `${d.id} cost`).toBeGreaterThan(d.staff[i - 1].baseCost);
        expect(d.staff[i].baseRate, `${d.id} rate`).toBeGreaterThan(d.staff[i - 1].baseRate);
      }
    }
  });
});

describe('retention content', () => {
  it('ships cards across all rarities with valid departments', () => {
    const byRarity = (r: string) => content.cards.filter((c) => c.rarity === r).length;
    expect(content.cards.length).toBeGreaterThanOrEqual(28);
    for (const r of ['temp', 'fulltime', 'senior', 'executive']) expect(byRarity(r), r).toBeGreaterThanOrEqual(3);
    const depts = new Set(content.departments.map((d) => d.id));
    for (const c of content.cards) expect(depts.has(c.dept), c.id).toBe(true);
  });
  it('rejects a card with an unknown department', () => {
    const bad = [{ ...cards[0], id: 'x', dept: 'nowhere' }];
    expect(() => loadContent([intake], [], { cards: bad })).toThrow(/unknown department/i);
  });
  it('rejects a card set missing an entire rarity', () => {
    const onlyTemp = cards.filter((c) => c.rarity === 'temp' && c.dept === 'intake');
    expect(() => loadContent([intake], [], { cards: onlyTemp })).toThrow(/no fulltime cards/i);
  });
  it('ships at least 8 daily task definitions with {n} placeholders', () => {
    expect(content.dailies.length).toBeGreaterThanOrEqual(8);
    for (const d of content.dailies) expect(d.text).toContain('{n}');
  });
  it('rejects a daily without a placeholder', () => {
    expect(() => loadContent([intake], [], { dailies: [{ ...dailies[0], text: 'no placeholder' }] })).toThrow(/\{n\}/);
  });
  it('ships about 80 achievements with unique ids', () => {
    expect(content.achievements.length).toBeGreaterThanOrEqual(76);
    expect(new Set(content.achievements.map((a) => a.id)).size).toBe(content.achievements.length);
  });
  it('rejects an achievement referencing unknown staff', () => {
    const bad = [{ ...achievements[0], id: 'x', condition: { type: 'staffOwned', staff: 'nobody', target: 1 } }];
    expect(() => loadContent([intake], [], { achievements: bad })).toThrow(/unknown staff/i);
  });
  it('ships at least 24 story memos and finds cards by id', () => {
    expect(content.story.length).toBeGreaterThanOrEqual(24);
    expect(() => findCard(content, content.cards[0].id)).not.toThrow();
    expect(() => findCard(content, 'nope')).toThrow(/unknown card/i);
  });
  it('keeps every story memo to at most three sentences', () => {
    for (const s of content.story) {
      const body = s.text.slice(s.text.indexOf(':') + 1).trim();
      const sentences = body.split(/[.!?]+['")\]]*\s/);
      expect(sentences.length, s.id).toBeLessThanOrEqual(3);
    }
  });
});

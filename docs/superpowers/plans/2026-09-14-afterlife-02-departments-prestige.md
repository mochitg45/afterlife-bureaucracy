# Afterlife Bureaucracy — Plan 2: Departments, Prestige and Perk Ledger

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four more departments (Heaven Admissions, Hell Compliance, Reincarnation Desk, Limbo Records) selectable from chips on the Office tab, the Fiscal Year Audit prestige loop that converts a run into Karma Seals, a data-driven Perk Ledger spent with Seals on the Ledger tab, year-aware memos, a 10 Hz performance pass, and a headless balance simulator that asserts the spec's pacing targets.

**Architecture:** Content stays JSON (`src/data/departments/*.json`, new `src/data/perks.json`) validated by zod in `src/engine/content.ts`. Prestige and perks are pure engine modules (`src/engine/prestige.ts`, `src/engine/perks.ts`) that feed the existing multiplier functions in `src/engine/economy.ts` and `src/engine/offline.ts`. The save gains `perks: string[]` at `SAVE_VERSION = 3`. The store exposes `audit()` and `buyPerk()`; the tick loop stops computing rates twice. New UI: `DeptChips` on the Office tab, `LedgerScreen` with `PerkTree`, and an `AuditCeremony` overlay. A `src/sim/` script models a check-in player and a test asserts the pacing targets.

**Tech Stack:** unchanged from Plan 1 — Vite 6, React 18, TypeScript 5, zustand 4, break_infinity.js, zod, vitest 2 + Testing Library; add `tsx` as a devDependency to run the simulator.

**Spec:** `docs/superpowers/specs/2026-09-14-afterlife-bureaucracy-design.md` — sections 2, 4 (pacing targets), 5, 6, 8 (memo pools), 11, 13.

## Global Constraints

- Engine code in `src/engine` must not import React, zustand, or `@capacitor/*`. Engine functions are pure and never mutate their input.
- All soul/KC quantities are `Decimal`. Counts, seals, levels are plain numbers.
- Department unlock thresholds (souls this run): Intake 0, Heaven Admissions 10,000, Hell Compliance 250,000, Reincarnation Desk 10,000,000, Limbo Records 500,000,000. Accents: Intake `#1F3B33`, Heaven `#3E9C93`, Hell `#A6402B`, Reincarnation `#A8823C`, Limbo `#6B6478`.
- Every department: 4–6 staff, 3–6 upgrades, ≥ 15 queue lines, ≥ 15 memos.
- Audit available when `soulsRun ≥ 1,000,000`. Seals awarded `floor(sqrt(soulsRun / 1e6))`. Reset: KC, staff, upgrades, department unlocks, souls-this-run, active department. Keep: seals, perks, vouchers, lifetime stats, fiscal year (+1), `boostUntilWall`, settings.
- Each Seal held: +2% global multiplier (already implemented in `globalMult`).
- Perk Ledger: about 40 nodes, five branches — Throughput, Overtime, Stapler, Requisition, Head Start. Node cost in Seals; prerequisites by node id.
- Pacing targets (asserted by the simulator test): first department unlock within 15 minutes of play; first Audit available on day 2–3 for a check-in player (5 sessions/day, 3 minutes each, greedy buying); each subsequent department 2–4 hours of play apart on a fresh run; a run started with 20 Seals reaches the Audit threshold at least 3× faster than the first run.
- Save format: `SAVE_VERSION` becomes 3 with a migration adding `perks: []`; `save-v1.json` and `save-v2.json` fixtures must still load.
- Existing public store API stays (`stamp`, `hire`, `upgrade`, `setActiveDept`, `pause`, `resume`, `boot`, `save`, `stopLoop`, `dismissOffline`, `doubleOffline`, `rotateQueue`, `rotateMemo`); this plan adds `audit()`, `buyPerk(perkId)`, `dismissAudit()`, `lastAudit`.
- Commit after every task with a conventional-commit message ending in `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Push to `origin main` after each commit.

---

## File map

| Path | Responsibility |
|---|---|
| `src/data/departments/heaven.json`, `hell.json`, `reincarnation.json`, `limbo.json` | New department content |
| `src/data/perks.json` | Perk Ledger tree |
| `src/data/index.ts` | Load all departments + perks |
| `src/engine/content.ts` | + `memosLate` field, `PerkDef` schema, `Content.perks`, `findPerk` |
| `src/engine/state.ts`, `src/engine/migrations.ts`, `src/engine/fixtures/save-v3.json` | `perks: string[]`, v3 migration |
| `src/engine/perks.ts` | perk ownership, cost, prerequisites, effect sums |
| `src/engine/economy.ts` | perk multipliers in `globalMult`, `deptMult`, `staplerLevel` |
| `src/engine/offline.ts` | perk offline cap/rate |
| `src/engine/actions.ts` | `tickWithRates`; `buyPerk` |
| `src/engine/prestige.ts` | `sealsForRun`, `canAudit`, `fileAudit` |
| `src/store/game.ts` | `audit`, `buyPerk`, `lastAudit`, `dismissAudit`, single rate computation, year-aware memo pool |
| `src/ui/components/DeptChips.tsx` | Department switcher with lock progress |
| `src/ui/components/StaffRow.tsx` | equality-selected rate subscription |
| `src/ui/characters/Character.tsx` | 4 new archetypes with accessory variants |
| `src/ui/screens/LedgerScreen.tsx`, `src/ui/components/PerkTree.tsx` | Ledger tab |
| `src/ui/overlays/AuditCeremony.tsx` | Prestige ceremony |
| `src/sim/simulate.ts`, `src/sim/pacing.test.ts` | Balance simulator + pacing assertions |

---

### Task 1: Content schema extensions (perks, late memos), department stubs, save v3

**Files:**
- Modify: `src/engine/content.ts`, `src/engine/content.test.ts`, `src/engine/state.ts`, `src/engine/migrations.ts`, `src/engine/state.test.ts`, `src/data/index.ts`
- Create: `src/data/perks.json`, `src/data/departments/heaven.json`, `hell.json`, `reincarnation.json`, `limbo.json` (stubs, replaced in Task 2), `src/engine/fixtures/save-v3.json`

**Interfaces:**
- Consumes: existing zod schemas, `migrate`, `deserialize`.
- Produces:
  ```ts
  // content.ts additions
  type PerkEffect =
    | { type: 'globalMult'; value: number }             // × (1 + value)
    | { type: 'deptMult'; dept: string; value: number }  // × (1 + value) on that department
    | { type: 'offlineCapHours'; value: number }
    | { type: 'offlineRate'; value: number }
    | { type: 'click'; value: number }                   // + value stapler levels
    | { type: 'voucherMult'; value: number }             // stored for Plan 3
    | { type: 'equipSlots'; value: number }              // stored for Plan 3
    | { type: 'headStartDept'; dept: string }            // department unlocked at run start
    | { type: 'headStartStaff'; staff: string; count: number }; // staff granted at run start
  interface PerkDef { id: string; name: string; desc: string; branch: 'throughput' | 'overtime' | 'stapler' | 'requisition' | 'headstart'; cost: number; requires: string[]; effect: PerkEffect }
  type PerkBranch = PerkDef['branch']
  interface DepartmentDef { ...existing; memosLate?: string[] }   // shown from fiscal year 2
  interface Content { departments: DepartmentDef[]; perks: PerkDef[] }
  function loadContent(departments: unknown[], perks?: unknown[]): Content   // validates prerequisite ids, dept/staff ids referenced by perks
  function findPerk(content: Content, perkId: string): PerkDef
  // state.ts additions
  interface GameState { ...existing; perks: string[] }
  SAVE_VERSION = 3
  ```

- [ ] **Step 1: Write failing tests**

Append to `src/engine/content.test.ts` (extend the existing import to `import { loadContent, findStaff, findUpgrade, findPerk } from './content';`):
```ts
import perks from '../data/perks.json';

describe('perks content', () => {
  it('loads the perk tree with five branches and about 40 nodes', () => {
    const c = loadContent([intake], perks);
    expect(c.perks.length).toBeGreaterThanOrEqual(36);
    const branches = new Set(c.perks.map((p) => p.branch));
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
    const c = loadContent([intake], perks);
    expect(findPerk(c, 'throughput-1').branch).toBe('throughput');
    expect(() => findPerk(c, 'zzz')).toThrow(/unknown perk/i);
  });
  it('accepts an optional memosLate pool', () => {
    const c = loadContent([{ ...intake, memosLate: ['MEMO: year two.'] }]);
    expect(c.departments[0].memosLate).toEqual(['MEMO: year two.']);
  });
});
```
Note: the first test loads `perks` against `[intake]` only, but several perks reference `heaven`, `hell`, `reincarnation`, `limbo`. Change that test and the `findPerk` test to load against the full department set: `import { content } from '../data';` and assert on `content.perks` instead of calling `loadContent([intake], perks)`. Keep the `bad*` tests with `[intake]` (they fail before reaching cross-references).

Append to `src/engine/state.test.ts`:
```ts
import saveV2 from './fixtures/save-v2.json';
import saveV3 from './fixtures/save-v3.json';

describe('save v3', () => {
  it('initial state has no perks', () => {
    expect(createInitialState(now, content).perks).toEqual([]);
  });
  it('migrates v2 saves by adding an empty perk list', () => {
    const s = deserialize(JSON.stringify(saveV2), content);
    expect(s.saveVersion).toBe(3);
    expect(s.perks).toEqual([]);
  });
  it('loads the v3 fixture with perks', () => {
    const s = deserialize(JSON.stringify(saveV3), content);
    expect(s.perks).toEqual(['throughput-1']);
  });
  it('drops non-string perk entries', () => {
    const raw = { ...saveV3, perks: ['throughput-1', 7, null] };
    expect(deserialize(JSON.stringify(raw), content).perks).toEqual(['throughput-1']);
  });
});
```
(`content` and `now` already exist in that file after Plan 1's fix wave; match the file's names. If `saveV2` is already imported, do not import it twice.)

`src/engine/fixtures/save-v3.json`: copy `save-v2.json`, set `"saveVersion": 3`, add `"perks": ["throughput-1"]`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/content.test.ts src/engine/state.test.ts`
Expected: FAIL — `findPerk` not exported, perks.json missing, `perks` undefined on state.

- [ ] **Step 3: Create the four department stubs**

Each stub is valid against the schema and has two distinct queue/memo lines (Plan 1's content test requires ≥ 2 distinct). Task 2 replaces them.

`src/data/departments/heaven.json`:
```json
{ "id": "heaven", "name": "Heaven Admissions", "unlockSouls": 10000, "accent": "#3E9C93",
  "staff": [{ "id": "h-cherub", "name": "Cherub Pool", "role": "Temp Choir", "flavor": "Sings while stapling.", "baseCost": 8000, "baseRate": 40, "character": "angel:0" }],
  "upgrades": [], "queue": ["Heaven queue placeholder one", "Heaven queue placeholder two"], "memos": ["MEMO: Heaven placeholder one.", "MEMO: Heaven placeholder two."] }
```
`hell.json`: id `hell`, name `Hell Compliance`, unlockSouls `250000`, accent `#A6402B`, one staff `d-imp` (baseCost 150000, baseRate 1500, character `demon:0`), same stub shape.
`reincarnation.json`: id `reincarnation`, name `Reincarnation Desk`, unlockSouls `10000000`, accent `#A8823C`, one staff `r-accountant` (baseCost 6000000, baseRate 50000, character `clerk:0`).
`limbo.json`: id `limbo`, name `Limbo Records`, unlockSouls `500000000`, accent `#6B6478`, one staff `l-archivist` (baseCost 300000000, baseRate 2000000, character `archivist:0`).

- [ ] **Step 4: Create perks.json**

`src/data/perks.json` (40 nodes; `requires` chains within a branch with a few cross-branch gates):
```json
[
  { "id": "throughput-1", "name": "Stamped Memo Pads", "desc": "All output +10%", "branch": "throughput", "cost": 1, "requires": [], "effect": { "type": "globalMult", "value": 0.10 } },
  { "id": "throughput-2", "name": "Two-Sided Forms", "desc": "All output +15%", "branch": "throughput", "cost": 2, "requires": ["throughput-1"], "effect": { "type": "globalMult", "value": 0.15 } },
  { "id": "throughput-3", "name": "Pneumatic Tubes", "desc": "All output +20%", "branch": "throughput", "cost": 4, "requires": ["throughput-2"], "effect": { "type": "globalMult", "value": 0.20 } },
  { "id": "throughput-4", "name": "Intake Fast Lane", "desc": "Intake output +50%", "branch": "throughput", "cost": 3, "requires": ["throughput-1"], "effect": { "type": "deptMult", "dept": "intake", "value": 0.50 } },
  { "id": "throughput-5", "name": "Choir Overtime", "desc": "Heaven Admissions output +50%", "branch": "throughput", "cost": 5, "requires": ["throughput-4"], "effect": { "type": "deptMult", "dept": "heaven", "value": 0.50 } },
  { "id": "throughput-6", "name": "Brimstone Subsidy", "desc": "Hell Compliance output +50%", "branch": "throughput", "cost": 8, "requires": ["throughput-5"], "effect": { "type": "deptMult", "dept": "hell", "value": 0.50 } },
  { "id": "throughput-7", "name": "Karma Rebates", "desc": "Reincarnation Desk output +50%", "branch": "throughput", "cost": 12, "requires": ["throughput-6"], "effect": { "type": "deptMult", "dept": "reincarnation", "value": 0.50 } },
  { "id": "throughput-8", "name": "Index Cards, Eternal", "desc": "Limbo Records output +50%", "branch": "throughput", "cost": 18, "requires": ["throughput-7"], "effect": { "type": "deptMult", "dept": "limbo", "value": 0.50 } },
  { "id": "throughput-9", "name": "Quarterly Targets (Shortened Quarters)", "desc": "All output +30%", "branch": "throughput", "cost": 10, "requires": ["throughput-3"], "effect": { "type": "globalMult", "value": 0.30 } },
  { "id": "throughput-10", "name": "Departmental Synergy Memo", "desc": "All output +40%", "branch": "throughput", "cost": 20, "requires": ["throughput-9", "throughput-6"], "effect": { "type": "globalMult", "value": 0.40 } },
  { "id": "throughput-11", "name": "Eternity Is a KPI", "desc": "All output +60%", "branch": "throughput", "cost": 40, "requires": ["throughput-10"], "effect": { "type": "globalMult", "value": 0.60 } },
  { "id": "throughput-12", "name": "The Backlog Sees You", "desc": "All output +100%", "branch": "throughput", "cost": 80, "requires": ["throughput-11", "throughput-8"], "effect": { "type": "globalMult", "value": 1.00 } },

  { "id": "overtime-1", "name": "Night Shift, Permanent", "desc": "Offline cap +4 h", "branch": "overtime", "cost": 1, "requires": [], "effect": { "type": "offlineCapHours", "value": 4 } },
  { "id": "overtime-2", "name": "Graveyard Shift", "desc": "Offline cap +8 h", "branch": "overtime", "cost": 3, "requires": ["overtime-1"], "effect": { "type": "offlineCapHours", "value": 8 } },
  { "id": "overtime-3", "name": "Weekend Coverage", "desc": "Offline cap +12 h", "branch": "overtime", "cost": 8, "requires": ["overtime-2"], "effect": { "type": "offlineCapHours", "value": 12 } },
  { "id": "overtime-4", "name": "Unpaid, Unbothered", "desc": "Offline rate +10%", "branch": "overtime", "cost": 2, "requires": ["overtime-1"], "effect": { "type": "offlineRate", "value": 0.10 } },
  { "id": "overtime-5", "name": "Coffee Is a Sacrament", "desc": "Offline rate +15%", "branch": "overtime", "cost": 5, "requires": ["overtime-4"], "effect": { "type": "offlineRate", "value": 0.15 } },
  { "id": "overtime-6", "name": "Nobody Goes Home", "desc": "Offline rate +25%", "branch": "overtime", "cost": 12, "requires": ["overtime-5", "overtime-3"], "effect": { "type": "offlineRate", "value": 0.25 } },
  { "id": "overtime-7", "name": "The Office Never Closes", "desc": "Offline cap +24 h", "branch": "overtime", "cost": 30, "requires": ["overtime-6"], "effect": { "type": "offlineCapHours", "value": 24 } },

  { "id": "stapler-1", "name": "Heavier Stapler", "desc": "+2 souls per stamp", "branch": "stapler", "cost": 1, "requires": [], "effect": { "type": "click", "value": 2 } },
  { "id": "stapler-2", "name": "Two-Handed Stamping", "desc": "+5 souls per stamp", "branch": "stapler", "cost": 2, "requires": ["stapler-1"], "effect": { "type": "click", "value": 5 } },
  { "id": "stapler-3", "name": "Ambidextrous Clerk", "desc": "+15 souls per stamp", "branch": "stapler", "cost": 5, "requires": ["stapler-2"], "effect": { "type": "click", "value": 15 } },
  { "id": "stapler-4", "name": "Ceremonial Gavel", "desc": "+50 souls per stamp", "branch": "stapler", "cost": 10, "requires": ["stapler-3"], "effect": { "type": "click", "value": 50 } },
  { "id": "stapler-5", "name": "Divine Rubber Stamp", "desc": "+200 souls per stamp", "branch": "stapler", "cost": 25, "requires": ["stapler-4"], "effect": { "type": "click", "value": 200 } },

  { "id": "requisition-1", "name": "Expense Account", "desc": "Voucher income +10%", "branch": "requisition", "cost": 2, "requires": [], "effect": { "type": "voucherMult", "value": 0.10 } },
  { "id": "requisition-2", "name": "Petty Cash Drawer", "desc": "Voucher income +15%", "branch": "requisition", "cost": 5, "requires": ["requisition-1"], "effect": { "type": "voucherMult", "value": 0.15 } },
  { "id": "requisition-3", "name": "Second Lanyard", "desc": "+1 equip slot", "branch": "requisition", "cost": 6, "requires": ["requisition-1"], "effect": { "type": "equipSlots", "value": 1 } },
  { "id": "requisition-4", "name": "Third Lanyard", "desc": "+1 equip slot", "branch": "requisition", "cost": 12, "requires": ["requisition-3"], "effect": { "type": "equipSlots", "value": 1 } },
  { "id": "requisition-5", "name": "Discretionary Budget", "desc": "Voucher income +25%", "branch": "requisition", "cost": 15, "requires": ["requisition-2"], "effect": { "type": "voucherMult", "value": 0.25 } },
  { "id": "requisition-6", "name": "Fourth Lanyard", "desc": "+1 equip slot", "branch": "requisition", "cost": 25, "requires": ["requisition-4", "requisition-5"], "effect": { "type": "equipSlots", "value": 1 } },
  { "id": "requisition-7", "name": "Fifth Lanyard", "desc": "+1 equip slot", "branch": "requisition", "cost": 45, "requires": ["requisition-6"], "effect": { "type": "equipSlots", "value": 1 } },
  { "id": "requisition-8", "name": "Executive Washroom Key", "desc": "+1 equip slot", "branch": "requisition", "cost": 80, "requires": ["requisition-7"], "effect": { "type": "equipSlots", "value": 1 } },

  { "id": "headstart-1", "name": "Dave Never Left", "desc": "Start each run with 10 Dave", "branch": "headstart", "cost": 2, "requires": [], "effect": { "type": "headStartStaff", "staff": "dave", "count": 10 } },
  { "id": "headstart-2", "name": "Seraphine's Contract Renewed", "desc": "Start each run with 10 Seraphine", "branch": "headstart", "cost": 4, "requires": ["headstart-1"], "effect": { "type": "headStartStaff", "staff": "seraphine", "count": 10 } },
  { "id": "headstart-3", "name": "Heaven Pre-Approved", "desc": "Start each run with Heaven Admissions open", "branch": "headstart", "cost": 6, "requires": ["headstart-2"], "effect": { "type": "headStartDept", "dept": "heaven" } },
  { "id": "headstart-4", "name": "Gary's Union Card", "desc": "Start each run with 25 Gary", "branch": "headstart", "cost": 8, "requires": ["headstart-3"], "effect": { "type": "headStartStaff", "staff": "gary", "count": 25 } },
  { "id": "headstart-5", "name": "Hell Pre-Approved", "desc": "Start each run with Hell Compliance open", "branch": "headstart", "cost": 15, "requires": ["headstart-4"], "effect": { "type": "headStartDept", "dept": "hell" } },
  { "id": "headstart-6", "name": "The Auditor Stays Bribed", "desc": "Start each run with 25 Auditors", "branch": "headstart", "cost": 20, "requires": ["headstart-5"], "effect": { "type": "headStartStaff", "staff": "auditor", "count": 25 } },
  { "id": "headstart-7", "name": "Reincarnation Pre-Approved", "desc": "Start each run with Reincarnation Desk open", "branch": "headstart", "cost": 35, "requires": ["headstart-6"], "effect": { "type": "headStartDept", "dept": "reincarnation" } },
  { "id": "headstart-8", "name": "Limbo Pre-Approved", "desc": "Start each run with Limbo Records open", "branch": "headstart", "cost": 60, "requires": ["headstart-7"], "effect": { "type": "headStartDept", "dept": "limbo" } }
]
```

- [ ] **Step 5: Implement content.ts changes**

In `src/engine/content.ts`:
```ts
const perkEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('globalMult'), value: z.number().positive() }),
  z.object({ type: z.literal('deptMult'), dept: z.string().min(1), value: z.number().positive() }),
  z.object({ type: z.literal('offlineCapHours'), value: z.number().positive() }),
  z.object({ type: z.literal('offlineRate'), value: z.number().positive() }),
  z.object({ type: z.literal('click'), value: z.number().positive() }),
  z.object({ type: z.literal('voucherMult'), value: z.number().positive() }),
  z.object({ type: z.literal('equipSlots'), value: z.number().int().positive() }),
  z.object({ type: z.literal('headStartDept'), dept: z.string().min(1) }),
  z.object({ type: z.literal('headStartStaff'), staff: z.string().min(1), count: z.number().int().positive() }),
]);

const perkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  desc: z.string(),
  branch: z.enum(['throughput', 'overtime', 'stapler', 'requisition', 'headstart']),
  cost: z.number().int().positive(),
  requires: z.array(z.string().min(1)),
  effect: perkEffectSchema,
});

export type PerkEffect = z.infer<typeof perkEffectSchema>;
export type PerkDef = z.infer<typeof perkSchema>;
export type PerkBranch = PerkDef['branch'];
```
Add `memosLate: z.array(z.string()).optional()` to `departmentSchema`. Change `Content` to `{ departments: DepartmentDef[]; perks: PerkDef[] }`. Change `loadContent`:
```ts
export function loadContent(rawDepartments: unknown[], rawPerks: unknown[] = []): Content {
  const departments = rawDepartments.map((r) => departmentSchema.parse(r));
  assertUnique(departments.map((d) => d.id), 'department');
  assertUnique(departments.flatMap((d) => d.staff.map((s) => s.id)), 'staff');
  assertUnique(departments.flatMap((d) => d.upgrades.map((u) => u.id)), 'upgrade');
  const perks = rawPerks.map((r) => perkSchema.parse(r));
  assertUnique(perks.map((p) => p.id), 'perk');
  const perkIds = new Set(perks.map((p) => p.id));
  const deptIds = new Set(departments.map((d) => d.id));
  const staffIds = new Set(departments.flatMap((d) => d.staff.map((s) => s.id)));
  for (const p of perks) {
    for (const req of p.requires) if (!perkIds.has(req)) throw new Error(`Unknown perk prerequisite ${req} on ${p.id}`);
    const e = p.effect;
    if ((e.type === 'deptMult' || e.type === 'headStartDept') && !deptIds.has(e.dept)) throw new Error(`Unknown department ${e.dept} on perk ${p.id}`);
    if (e.type === 'headStartStaff' && !staffIds.has(e.staff)) throw new Error(`Unknown staff ${e.staff} on perk ${p.id}`);
  }
  return { departments, perks };
}

export function findPerk(content: Content, perkId: string): PerkDef {
  const perk = content.perks.find((p) => p.id === perkId);
  if (!perk) throw new Error(`Unknown perk: ${perkId}`);
  return perk;
}
```
Existing tests that call `loadContent([...])` keep working because `perks` defaults to `[]`.

`src/data/index.ts`:
```ts
import { loadContent } from '../engine/content';
import intake from './departments/intake.json';
import heaven from './departments/heaven.json';
import hell from './departments/hell.json';
import reincarnation from './departments/reincarnation.json';
import limbo from './departments/limbo.json';
import perks from './perks.json';

export const content = loadContent([intake, heaven, hell, reincarnation, limbo], perks);
```

- [ ] **Step 6: Implement state v3**

`src/engine/migrations.ts`: `SAVE_VERSION = 3`; append to `steps`:
```ts
  // 2 -> 3: Perk Ledger purchases.
  (raw) => ({ ...raw, perks: [] }),
```
`src/engine/state.ts`: add `perks: string[]` to `GameState` (after `vouchers`), `perks: []` in `createInitialState`, and in `deserialize`:
```ts
perks: Array.isArray(raw.perks) ? (raw.perks as unknown[]).filter((p): p is string => typeof p === 'string') : [],
```

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run src/engine` then `npm test`
Expected: PASS. Any Plan 1 test that builds a `Content` literal without `perks` gets `perks: []`. Plan 1 tests that assumed only one department (for example `deptsUnlocked` equal to `['intake']` after boot) still hold because only Intake has `unlockSouls: 0`.

- [ ] **Step 8: Commit**

```bash
git add src/engine src/data
git commit -m "feat(content): perk tree schema, late memos, department stubs, save v3 with perks"
git push origin main
```

---

### Task 2: Four department content files

**Files:**
- Modify: `src/data/departments/heaven.json`, `hell.json`, `reincarnation.json`, `limbo.json` (replace stubs), `src/engine/content.test.ts`

**Interfaces:**
- Produces: full content for four departments. Staff `character` ids: Heaven `angel:N`, Hell `demon:N`, Reincarnation `clerk:N`, Limbo `archivist:N` with N 0–4 (Task 6 renders them; until then unknown ids fall back to the soul silhouette).

Numbers (baseCost / baseRate) are tuned so the first staff of a department costs roughly the KC a player holds when the department unlocks and each staff tier is about ×7 cost, ×5 rate. Task 8's simulator asserts the pacing targets; if they fail, adjust these numbers (and only these) in Task 8.

- [ ] **Step 1: Write failing test**

Append to `src/engine/content.test.ts` (the `content` import exists from Task 1):
```ts
describe('shipped departments', () => {
  it('ships five departments in unlock order with the spec thresholds and accents', () => {
    expect(content.departments.map((d) => [d.id, d.unlockSouls, d.accent])).toEqual([
      ['intake', 0, '#1F3B33'],
      ['heaven', 10000, '#3E9C93'],
      ['hell', 250000, '#A6402B'],
      ['reincarnation', 10000000, '#A8823C'],
      ['limbo', 500000000, '#6B6478'],
    ]);
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/content.test.ts`
Expected: FAIL on the stubbed departments.

- [ ] **Step 3: Write heaven.json**

```json
{
  "id": "heaven", "name": "Heaven Admissions", "unlockSouls": 10000, "accent": "#3E9C93",
  "staff": [
    { "id": "h-cherub", "name": "Cherub Pool", "role": "Temp Choir", "flavor": "Sings while stapling. Off-key.", "baseCost": 8000, "baseRate": 40, "character": "angel:0" },
    { "id": "h-gatekeeper", "name": "Petra", "role": "Gatekeeper, Acting", "flavor": "Has the keys. Lost the list.", "baseCost": 60000, "baseRate": 200, "character": "angel:1" },
    { "id": "h-harpist", "name": "Melodia", "role": "Harpist, Hold Music", "flavor": "Your call is important to eternity.", "baseCost": 400000, "baseRate": 1000, "character": "angel:2" },
    { "id": "h-archangel", "name": "Archangel Bev", "role": "Regional Manager", "flavor": "Six wings, one clipboard.", "baseCost": 3000000, "baseRate": 6000, "character": "angel:3" },
    { "id": "h-seraph", "name": "The Seraph Board", "role": "Steering Committee", "flavor": "Burns with holy fire and quarterly goals.", "baseCost": 25000000, "baseRate": 40000, "character": "angel:4" }
  ],
  "upgrades": [
    { "id": "h-halo-polish", "name": "Halo Polish Budget", "desc": "Heaven output +25%", "baseCost": 40000, "costGrowth": 6, "maxLevel": 5, "effect": { "type": "deptMult", "value": 0.25 } },
    { "id": "h-cloud-storage", "name": "Cloud Storage (Literal)", "desc": "Offline cap +2 hours", "baseCost": 250000, "costGrowth": 8, "maxLevel": 2, "effect": { "type": "offlineCapHours", "value": 2 } },
    { "id": "h-pearly-turnstile", "name": "Pearly Turnstile", "desc": "Heaven output +100%", "baseCost": 2000000, "costGrowth": 10, "maxLevel": 3, "effect": { "type": "deptMult", "value": 1 } },
    { "id": "h-blessed-stapler", "name": "Blessed Stapler", "desc": "+2 souls per stamp", "baseCost": 120000, "costGrowth": 5, "maxLevel": 5, "effect": { "type": "click", "value": 2 } }
  ],
  "queue": [
    "Sister Agnes — requests Heaven, brought references from three popes",
    "Soul #20117 — asks if Heaven has Wi-Fi, 'for the grandchildren'",
    "Dmitri K. — claims 'technically never did anything', requests admission",
    "Beloved Grandpa Joe — arrives with a casserole, refuses to let it go cold",
    "Soul #44002 — wants to know if pets are allowed, has 14",
    "Lady Ashcombe — expects the good seats, will not accept 'general admission'",
    "Soul #61 — a saint, allegedly; paperwork lost in a fire, allegedly",
    "Marisol P. — requests a room facing the sunrise, any sunrise",
    "The Reverend — brought his own choir, they are also in the queue",
    "Soul #90210 — asks if the halo comes in other sizes",
    "Auntie Oyelaran — insists on inspecting the kitchens first",
    "Soul #55555 — filed for Heaven, Hell, and Reincarnation 'to keep options open'",
    "Pieter V. — asks whether the clouds are load-bearing",
    "Soul #12034 — requests a transfer from Hell, cites 'clerical error, obviously'",
    "Nana Costa — wants to know who is watering her plants",
    "Soul #77777 — very lucky in life, would like that to continue",
    "Brother Anselm — has taken a vow of silence, form is blank",
    "Soul #30001 — brought a plus-one"
  ],
  "memos": [
    "MEMO: Cloud Nine Staffing has raised its rates. Halos now billed separately.",
    "NOTICE: The choir has unionised. Hold music will be silent until further notice.",
    "MEMO: Heaven is at 98% capacity. Facilities is 'looking into more sky'.",
    "INCIDENT: A cherub stapled a soul to the gate. Both are fine. The gate is fine.",
    "MEMO: Pearly Gate turnstile jammed. Please use the side door until eternity.",
    "REMINDER: Wings are not to be used to reach the top shelf. That is what interns are for.",
    "MEMO: Archangel Bev would like everyone to know she is 'not angry, just disappointed'.",
    "NOTICE: Harp practice is restricted to the break room. The break room is now full of harps.",
    "MEMO: Mortal realm reports a rise in 'unexplained warm feelings'. Legal advises we deny involvement.",
    "INCIDENT: Someone admitted a golden retriever. Nobody is filing a complaint.",
    "MEMO: Halo polish is for halos. Stop using it on the stamp.",
    "REMINDER: The Seraph Board meets at the top of the hour. Every hour. Forever.",
    "NOTICE: Admissions is not responsible for lost luggage, mortal coils, or plus-ones.",
    "MEMO: The clouds are, in fact, load-bearing. Please stop asking.",
    "INCIDENT: Soul #55555 was admitted to three places at once. HR calls this 'initiative'.",
    "MEMO: New policy — every admission must be stamped twice. Legal was not consulted.",
    "REMINDER: Trumpet solos are for special occasions, not for the end of each shift."
  ],
  "memosLate": [
    "MEMO (FY2+): The audit went fine. The auditor is now also in Heaven. Unrelated.",
    "MEMO (FY2+): Second-year admissions are up. Mortal realm reports fewer people, 'somehow'.",
    "NOTICE (FY2+): Returning staff — your halos have been reissued with a new serial number."
  ]
}
```

- [ ] **Step 4: Write hell.json**

```json
{
  "id": "hell", "name": "Hell Compliance", "unlockSouls": 250000, "accent": "#A6402B",
  "staff": [
    { "id": "d-imp", "name": "Imp Pool", "role": "Torment QA", "flavor": "Files defects against every scream.", "baseCost": 150000, "baseRate": 1500, "character": "demon:0" },
    { "id": "d-steward", "name": "Malphas", "role": "Pitchfork Logistics", "flavor": "Tracks every fork. Loses every spoon.", "baseCost": 1000000, "baseRate": 8000, "character": "demon:1" },
    { "id": "d-hr", "name": "Lilith from HR", "role": "People & Culture", "flavor": "Culture is mandatory.", "baseCost": 8000000, "baseRate": 50000, "character": "demon:2" },
    { "id": "d-foreman", "name": "Foreman Grax", "role": "Furnace Operations", "flavor": "Union rep. Also on fire.", "baseCost": 60000000, "baseRate": 300000, "character": "demon:3" },
    { "id": "d-duke", "name": "Duke Vassago", "role": "VP, Eternal Torment", "flavor": "Very senior. Very tired.", "baseCost": 500000000, "baseRate": 2000000, "character": "demon:4" }
  ],
  "upgrades": [
    { "id": "d-brimstone", "name": "Bulk Brimstone Contract", "desc": "Hell output +25%", "baseCost": 800000, "costGrowth": 6, "maxLevel": 5, "effect": { "type": "deptMult", "value": 0.25 } },
    { "id": "d-shift-rota", "name": "Infernal Shift Rota", "desc": "Offline rate +15% of online", "baseCost": 5000000, "costGrowth": 7, "maxLevel": 2, "effect": { "type": "offlineRate", "value": 0.15 } },
    { "id": "d-lake", "name": "Lake of Fire, Deregulated", "desc": "Hell output +100%", "baseCost": 40000000, "costGrowth": 10, "maxLevel": 3, "effect": { "type": "deptMult", "value": 1 } },
    { "id": "d-branding-iron", "name": "Branding Iron Stamp", "desc": "+5 souls per stamp", "baseCost": 3000000, "costGrowth": 5, "maxLevel": 5, "effect": { "type": "click", "value": 5 } }
  ],
  "queue": [
    "Soul #66601 — disputes placement, 'it was one email'",
    "Reginald T. — landlord, requests an upgrade to a suite",
    "Soul #13013 — asks if the fire is the dry kind or the humid kind",
    "Consultant (name withheld) — has a deck on optimising torment throughput",
    "Soul #40404 — cannot be found in the system, insists he is here",
    "Baroness Krull — brought her own pitchfork, monogrammed",
    "Soul #77 (Hell branch) — was told to wait here in 1311, still waiting",
    "Chad — asks if the gym is open",
    "Soul #50050 — filed a complaint about the complaint form",
    "Ms. Vantablack — claims she is here to see a client",
    "Soul #31337 (again) — 'admin access, please, it's for a friend'",
    "Bartholomew Vance — golden retriever request denied, appealing",
    "Soul #99999 — requests the noise-cancelling circle",
    "Tax Preparer #4 — asks whether torment is deductible",
    "Soul #82000 — wants it noted that the queue in Heaven was shorter",
    "The Twins (again) — one form, two souls, one is not supposed to be here",
    "Soul #10010 — 'I'll take the Wi-Fi password now'"
  ],
  "memos": [
    "MEMO: The union has secured two breaks per eternity for imps. Management is furious.",
    "NOTICE: The Lake of Fire is closed for maintenance. Please use the Pond of Mild Discomfort.",
    "INCIDENT: A pitchfork was returned with a spoon attached. Logistics is 'investigating'.",
    "MEMO: Torment QA reminds staff that screams must be reproducible to be filed.",
    "REMINDER: Casual Friday applies. The horns stay.",
    "MEMO: Lilith from HR has scheduled a culture workshop. Attendance is compulsory and eternal.",
    "NOTICE: Mortal realm reports spike in 'inexplicable guilt'. We are not taking credit. Yet.",
    "MEMO: Brimstone prices are up 12%. Please torment efficiently.",
    "INCIDENT: Duke Vassago fell asleep during a torment. The soul filed a compliment.",
    "REMINDER: Souls are not to be stapled to other souls, even in Hell.",
    "MEMO: The furnace has passed its inspection. The inspector has not.",
    "NOTICE: The thermostat is not broken. It is a policy.",
    "MEMO: A consultant has proposed 'synergised suffering'. Legal is still screaming.",
    "INCIDENT: Foreman Grax caught fire again. He says it is fine. It is not fine.",
    "MEMO: Someone requested a transfer to Heaven citing 'clerical error'. It was not a clerical error.",
    "REMINDER: The exit sign is decorative.",
    "MEMO: Compliance reminds everyone that Hell is, technically, compliant."
  ],
  "memosLate": [
    "MEMO (FY2+): Post-audit headcount is up. The auditor recommended 'more fire'.",
    "NOTICE (FY2+): The Pond of Mild Discomfort has been upgraded to Moderate."
  ]
}
```

- [ ] **Step 5: Write reincarnation.json**

```json
{
  "id": "reincarnation", "name": "Reincarnation Desk", "unlockSouls": 10000000, "accent": "#A8823C",
  "staff": [
    { "id": "r-accountant", "name": "Karma Accountants", "role": "Ledger Pool", "flavor": "Every good deed, itemised.", "baseCost": 6000000, "baseRate": 50000, "character": "clerk:0" },
    { "id": "r-placement", "name": "Officer Pemberton", "role": "Placement, Canine", "flavor": "Golden retriever tier is oversubscribed.", "baseCost": 50000000, "baseRate": 300000, "character": "clerk:1" },
    { "id": "r-actuary", "name": "Nadia", "role": "Actuary, Next Lives", "flavor": "Knows your odds. Won't say.", "baseCost": 400000000, "baseRate": 2000000, "character": "clerk:2" },
    { "id": "r-wheel", "name": "Wheel Technician", "role": "Samsara Maintenance", "flavor": "It squeaks. It has always squeaked.", "baseCost": 3000000000, "baseRate": 12000000, "character": "clerk:3" },
    { "id": "r-bodhisattva", "name": "The Bodhisattva (Contract)", "role": "Senior Advisor", "flavor": "Could leave. Stays for the pension.", "baseCost": 25000000000, "baseRate": 80000000, "character": "clerk:4" }
  ],
  "upgrades": [
    { "id": "r-double-entry", "name": "Double-Entry Karma", "desc": "Reincarnation output +25%", "baseCost": 30000000, "costGrowth": 6, "maxLevel": 5, "effect": { "type": "deptMult", "value": 0.25 } },
    { "id": "r-express-wheel", "name": "Express Wheel", "desc": "Reincarnation output +100%", "baseCost": 1500000000, "costGrowth": 10, "maxLevel": 3, "effect": { "type": "deptMult", "value": 1 } },
    { "id": "r-overnight-lives", "name": "Overnight Lives", "desc": "Offline cap +4 hours", "baseCost": 200000000, "costGrowth": 8, "maxLevel": 2, "effect": { "type": "offlineCapHours", "value": 4 } },
    { "id": "r-karmic-stamp", "name": "Karmic Stamp", "desc": "+15 souls per stamp", "baseCost": 100000000, "costGrowth": 5, "maxLevel": 5, "effect": { "type": "click", "value": 15 } }
  ],
  "queue": [
    "Bartholomew Vance — golden retriever, good-boy tier, appeal upheld",
    "Soul #70070 — requests a life 'with fewer stairs'",
    "Ines R. — wants to be a tree, any tree, preferably somewhere quiet",
    "Soul #19191 — would like the same life again but 'with the lottery numbers'",
    "Captain Reyes — same crew, same ship, different iceberg",
    "Soul #24680 — asks to be reborn 'somewhere with good bread'",
    "Old Man Hutchins — refuses reincarnation until his grudge is resolved",
    "Soul #33333 — requests a life as a cat, has already started ignoring us",
    "Dr. Lindqvist — requests peer review of the reincarnation process",
    "Soul #45454 — wants to skip childhood",
    "Priya M. — 'the quiet part, again, please'",
    "Soul #56565 — asks if karma carries over like unused leave",
    "The Bodhisattva's nephew — expects a discount",
    "Soul #67676 — requests to be reborn as 'someone taller'",
    "Grandma Liu — wants to come back as her own grandson's neighbour, to keep an eye on him",
    "Soul #78787 — form says 'surprise me', then lists 40 conditions",
    "Marcus D. — done thinking, ready for a life 'with less thinking'"
  ],
  "memos": [
    "MEMO: Reincarnation backlog cleared. Mortal realm reports a baby boom and a shortage of names.",
    "NOTICE: Golden retriever tier is oversubscribed. Please consider spaniel.",
    "INCIDENT: A soul was reincarnated as a fax machine. Again. Investigating the wheel.",
    "MEMO: Karma Accountants remind everyone that 'it's the thought that counts' is not a line item.",
    "REMINDER: The Wheel squeaks. Do not oil the Wheel. The squeak is structural.",
    "MEMO: Nadia has computed everyone's odds. She has been asked to stop smiling.",
    "NOTICE: Next-life requests citing 'main character energy' will be placed as background extras.",
    "INCIDENT: Two souls swapped forms in the queue. Both are now each other. Both are fine with it.",
    "MEMO: Placement reminds staff that 'tree' is a valid outcome, 'that specific tree' is not.",
    "REMINDER: Karma does not carry over like unused leave. HR has been asked to stop saying it does.",
    "MEMO: Mortal realm reports more déjà vu. Marketing calls it 'brand recall'.",
    "NOTICE: The Express Wheel is not for staff use. Foreman Grax is now a hamster.",
    "MEMO: A soul requested a life 'with less thinking'. Placement has options.",
    "INCIDENT: Wheel Technician found a spoon in the Wheel. Logistics has been notified.",
    "MEMO: Double-Entry Karma is live. Every good deed now has an equal and opposite invoice.",
    "REMINDER: You cannot reincarnate as yourself. Legal has ruled twice.",
    "MEMO: The Bodhisattva has renewed his contract. He says it's for the pension. It is not for the pension."
  ],
  "memosLate": [
    "MEMO (FY2+): Post-audit, several staff have been reincarnated as their own replacements.",
    "NOTICE (FY2+): The Wheel has been audited. It still squeaks. The auditor now squeaks."
  ]
}
```

- [ ] **Step 6: Write limbo.json**

```json
{
  "id": "limbo", "name": "Limbo Records", "unlockSouls": 500000000, "accent": "#6B6478",
  "staff": [
    { "id": "l-archivist", "name": "Archivist Pool", "role": "Filing, Indefinite", "flavor": "Everything is filed. Nothing is found.", "baseCost": 300000000, "baseRate": 2000000, "character": "archivist:0" },
    { "id": "l-lost-found", "name": "Ms. Ferro", "role": "Lost & Found", "flavor": "Holds 14 halos and one sense of purpose.", "baseCost": 2500000000, "baseRate": 12000000, "character": "archivist:1" },
    { "id": "l-forgotten", "name": "The One Who Forgot", "role": "Resident Since Forever", "flavor": "Meant to leave. Got comfortable.", "baseCost": 20000000000, "baseRate": 80000000, "character": "archivist:2" },
    { "id": "l-registrar", "name": "Registrar Ó Broin", "role": "Master of Records", "flavor": "Knows where box 7 is. Won't tell.", "baseCost": 150000000000, "baseRate": 500000000, "character": "archivist:3" },
    { "id": "l-keeper", "name": "The Keeper of the Cabinet", "role": "Head of Department", "flavor": "The cabinet is bigger on the inside.", "baseCost": 1200000000000, "baseRate": 3000000000, "character": "archivist:4" }
  ],
  "upgrades": [
    { "id": "l-index", "name": "Index Cards, Alphabetised", "desc": "Limbo output +25%", "baseCost": 1500000000, "costGrowth": 6, "maxLevel": 5, "effect": { "type": "deptMult", "value": 0.25 } },
    { "id": "l-cabinet", "name": "Filing Cabinet, Infinite", "desc": "Limbo output +100%", "baseCost": 80000000000, "costGrowth": 10, "maxLevel": 3, "effect": { "type": "deptMult", "value": 1 } },
    { "id": "l-waiting-room", "name": "Eternal Waiting Room", "desc": "Offline cap +6 hours", "baseCost": 10000000000, "costGrowth": 8, "maxLevel": 2, "effect": { "type": "offlineCapHours", "value": 6 } },
    { "id": "l-dust-rate", "name": "Dust Settles Overnight", "desc": "Offline rate +10% of online", "baseCost": 5000000000, "costGrowth": 7, "maxLevel": 2, "effect": { "type": "offlineRate", "value": 0.10 } },
    { "id": "l-grey-stamp", "name": "Grey Stamp of Indeterminacy", "desc": "+50 souls per stamp", "baseCost": 4000000000, "costGrowth": 5, "maxLevel": 5, "effect": { "type": "click", "value": 50 } }
  ],
  "queue": [
    "Soul #88291 — form incomplete, missing box 7, has been told box 7 is here",
    "Marcus D. — thinking. Still thinking.",
    "Soul #00001 — the first soul ever filed, misplaced ever since",
    "Unnamed — no form, no name, no shoes; has found a chair",
    "Soul #12121 — waiting for a friend who is also waiting for a friend",
    "Trevor — has receipts, has now also lost receipts",
    "Soul #23232 — asked to 'hold', has been holding since the Bronze Age",
    "The Twins — one form, two souls, both now in separate boxes",
    "Soul #34343 — requests his own file, is told it is 'being located'",
    "Nana Costa — plants still unwatered, would like this escalated",
    "Soul #45454 (again) — skipped childhood, now waiting for adulthood",
    "Auntie Oyelaran — inspected the kitchens, is now inspecting Limbo",
    "Soul #56565 — karma still not carried over, has opened a ticket",
    "A librarian — has started reshelving. Nobody has stopped her.",
    "Soul #67676 — still not taller",
    "Dr. Lindqvist — peer review pending. Reviewers are also in Limbo.",
    "Soul #78787 — 'surprise me' request filed under S, then under U, then lost"
  ],
  "memos": [
    "MEMO: Box 7 has been located. It is inside box 7.",
    "NOTICE: Lost & Found now holds 14 halos, 2 pitchforks, one sense of purpose, and a spoon.",
    "INCIDENT: A librarian reshelved the entire department overnight. Nobody can find anything. Efficiency is up.",
    "MEMO: Limbo is not a waiting room. It is a records department that people wait in.",
    "REMINDER: Souls who 'just want to think for a bit' are to be given a chair and a century.",
    "MEMO: The Keeper reports the cabinet is 'still bigger on the inside'. Facilities disputes this.",
    "NOTICE: Mortal realm reports a rise in 'things being exactly where you left them'. We are not sorry.",
    "INCIDENT: Soul #00001 was found. Then filed. Then lost. Standard procedure.",
    "MEMO: Index cards must be alphabetised by the soul's third-favourite word.",
    "REMINDER: Dust is a filing medium. Do not disturb it.",
    "MEMO: Registrar Ó Broin knows where everything is and has been asked, politely, to share.",
    "NOTICE: The Eternal Waiting Room has a two-century queue for the waiting room.",
    "MEMO: The One Who Forgot has forgotten again. Please do not remind them; they seem happy.",
    "INCIDENT: A soul filed a ticket about a ticket about a form. The ticket has been filed.",
    "MEMO: The Grey Stamp is neither approved nor denied. It is filed.",
    "REMINDER: Nothing in Limbo is lost. It is merely unlocated for an unbounded period.",
    "MEMO: Someone has started a book club. It has been going for four hundred years. They are on chapter two."
  ],
  "memosLate": [
    "MEMO (FY2+): The audit report has been filed. It is now in Limbo. So is the auditor.",
    "NOTICE (FY2+): Post-audit, the cabinet is somehow even bigger on the inside."
  ]
}
```

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run src/engine/content.test.ts` then `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/data src/engine/content.test.ts
git commit -m "feat(content): Heaven, Hell, Reincarnation and Limbo departments"
git push origin main
```

---

### Task 3: Perk engine and multiplier integration

**Files:**
- Create: `src/engine/perks.ts`, `src/engine/perks.test.ts`
- Modify: `src/engine/economy.ts`, `src/engine/economy.test.ts`, `src/engine/offline.ts`, `src/engine/offline.test.ts`, `src/engine/actions.ts`

**Interfaces:**
- Consumes: `PerkDef`, `PerkEffect`, `findPerk` (Task 1), `GameState.perks`.
- Produces:
  ```ts
  // perks.ts
  function hasPerk(state: GameState, perkId: string): boolean
  type PerkBuyCheck = { ok: true } | { ok: false; reason: 'owned' | 'locked' | 'seals' }
  function canBuyPerk(state: GameState, content: Content, perkId: string): PerkBuyCheck
  function perkSum(state: GameState, content: Content, type: 'offlineCapHours' | 'offlineRate' | 'click' | 'voucherMult' | 'equipSlots'): number
  function perkGlobalMult(state: GameState, content: Content): Decimal      // Π (1 + value) over owned globalMult perks
  function perkDeptMult(state: GameState, content: Content, deptId: string): Decimal
  function headStart(state: GameState, content: Content): { depts: string[]; staff: Record<string, number> }
  // actions.ts
  function buyPerk(state: GameState, content: Content, perkId: string): GameState   // deducts seals, appends id; returns the same state object when not ok
  ```
  Integration: `globalMult` multiplies by `perkGlobalMult`; `deptMult(state, content, dept)` (new signature) multiplies by `perkDeptMult`; `staplerLevel` adds `perkSum('click')`; `offlineCapSeconds` adds `perkSum('offlineCapHours') × 3600`; `offlineRateFraction` adds `perkSum('offlineRate')` (still capped at 1).

- [ ] **Step 1: Write failing tests**

`src/engine/perks.test.ts`:
```ts
import { createInitialState } from './state';
import { content } from '../data';
import { hasPerk, canBuyPerk, perkSum, perkGlobalMult, perkDeptMult, headStart } from './perks';
import { buyPerk } from './actions';

const now = { wall: 0, mono: 0 };
const base = () => createInitialState(now, content);

describe('perk ownership and purchase rules', () => {
  it('root perk needs only seals', () => {
    const s = { ...base(), seals: 1 };
    expect(canBuyPerk(s, content, 'throughput-1')).toEqual({ ok: true });
    expect(canBuyPerk({ ...s, seals: 0 }, content, 'throughput-1')).toEqual({ ok: false, reason: 'seals' });
  });
  it('child perk is locked until prerequisites are owned', () => {
    const s = { ...base(), seals: 50 };
    expect(canBuyPerk(s, content, 'throughput-2')).toEqual({ ok: false, reason: 'locked' });
    expect(canBuyPerk({ ...s, perks: ['throughput-1'] }, content, 'throughput-2')).toEqual({ ok: true });
  });
  it('owned perks cannot be bought again', () => {
    const s = { ...base(), seals: 50, perks: ['throughput-1'] };
    expect(canBuyPerk(s, content, 'throughput-1')).toEqual({ ok: false, reason: 'owned' });
  });
  it('buyPerk deducts seals and records the perk; refuses otherwise', () => {
    const s0 = { ...base(), seals: 3 };
    const s1 = buyPerk(s0, content, 'throughput-1');
    expect(s1.seals).toBe(2);
    expect(hasPerk(s1, 'throughput-1')).toBe(true);
    expect(buyPerk(s1, content, 'throughput-3')).toBe(s1);
    expect(s0.perks).toEqual([]);
  });
});

describe('perk effects', () => {
  it('sums additive effects by type', () => {
    const s = { ...base(), perks: ['overtime-1', 'overtime-2', 'stapler-1', 'stapler-2'] };
    expect(perkSum(s, content, 'offlineCapHours')).toBe(12);
    expect(perkSum(s, content, 'click')).toBe(7);
    expect(perkSum(s, content, 'equipSlots')).toBe(0);
  });
  it('compounds global multipliers', () => {
    const s = { ...base(), perks: ['throughput-1', 'throughput-2'] };
    expect(perkGlobalMult(s, content).toNumber()).toBeCloseTo(1.1 * 1.15);
    expect(perkGlobalMult(base(), content).toNumber()).toBe(1);
  });
  it('applies department multipliers only to their department', () => {
    const s = { ...base(), perks: ['throughput-4'] };
    expect(perkDeptMult(s, content, 'intake').toNumber()).toBeCloseTo(1.5);
    expect(perkDeptMult(s, content, 'heaven').toNumber()).toBe(1);
  });
  it('collects head-start departments and staff', () => {
    const s = { ...base(), perks: ['headstart-1', 'headstart-2', 'headstart-3'] };
    expect(headStart(s, content)).toEqual({ depts: ['heaven'], staff: { dave: 10, seraphine: 10 } });
  });
});
```

Append to `src/engine/economy.test.ts`:
```ts
describe('perks in multipliers', () => {
  it('global multiplier includes throughput perks', () => {
    const s = { ...createInitialState(now, content), perks: ['throughput-1'] };
    expect(globalMult(s, content, 0).toNumber()).toBeCloseTo(1.1);
  });
  it('department multiplier includes department perks', () => {
    const s = { ...createInitialState(now, content), perks: ['throughput-4'] };
    expect(deptMult(s, content, content.departments[0]).toNumber()).toBeCloseTo(1.5);
  });
  it('stapler level includes click perks', () => {
    const s = { ...createInitialState(now, content), perks: ['stapler-1'] };
    expect(staplerLevel(s, content)).toBe(2);
  });
});
```
Update every existing `deptMult(s, intake)` call in that file to `deptMult(s, content, intake)`.

Append to `src/engine/offline.test.ts`:
```ts
it('perks extend the offline cap and rate', () => {
  const s = { ...createInitialState(now, content), perks: ['overtime-1', 'overtime-4'] };
  expect(offlineCapSeconds(s, content)).toBe(8 * 3600);
  expect(offlineRateFraction(s, content)).toBeCloseTo(0.6);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine`
Expected: FAIL — `./perks` missing, `deptMult` arity, `buyPerk` missing.

- [ ] **Step 3: Implement perks.ts**

```ts
import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content, PerkDef } from './content';
import { findPerk } from './content';

export function hasPerk(state: GameState, perkId: string): boolean {
  return state.perks.includes(perkId);
}

export type PerkBuyCheck = { ok: true } | { ok: false; reason: 'owned' | 'locked' | 'seals' };

export function canBuyPerk(state: GameState, content: Content, perkId: string): PerkBuyCheck {
  const perk = findPerk(content, perkId);
  if (hasPerk(state, perkId)) return { ok: false, reason: 'owned' };
  if (!perk.requires.every((r) => hasPerk(state, r))) return { ok: false, reason: 'locked' };
  if (state.seals < perk.cost) return { ok: false, reason: 'seals' };
  return { ok: true };
}

function owned(state: GameState, content: Content): PerkDef[] {
  return content.perks.filter((p) => state.perks.includes(p.id));
}

export type AdditivePerkType = 'offlineCapHours' | 'offlineRate' | 'click' | 'voucherMult' | 'equipSlots';

export function perkSum(state: GameState, content: Content, type: AdditivePerkType): number {
  let total = 0;
  for (const p of owned(state, content)) {
    if (p.effect.type === type) total += p.effect.value;
  }
  return total;
}

export function perkGlobalMult(state: GameState, content: Content): Decimal {
  let mult = new Decimal(1);
  for (const p of owned(state, content)) {
    if (p.effect.type === 'globalMult') mult = mult.mul(1 + p.effect.value);
  }
  return mult;
}

export function perkDeptMult(state: GameState, content: Content, deptId: string): Decimal {
  let mult = new Decimal(1);
  for (const p of owned(state, content)) {
    if (p.effect.type === 'deptMult' && p.effect.dept === deptId) mult = mult.mul(1 + p.effect.value);
  }
  return mult;
}

export function headStart(state: GameState, content: Content): { depts: string[]; staff: Record<string, number> } {
  const depts: string[] = [];
  const staff: Record<string, number> = {};
  for (const p of owned(state, content)) {
    if (p.effect.type === 'headStartDept') depts.push(p.effect.dept);
    if (p.effect.type === 'headStartStaff') staff[p.effect.staff] = (staff[p.effect.staff] ?? 0) + p.effect.count;
  }
  return { depts, staff };
}
```

- [ ] **Step 4: Integrate into economy.ts, offline.ts, actions.ts**

`src/engine/economy.ts`:
- `import { perkGlobalMult, perkDeptMult, perkSum } from './perks';`
- `staplerLevel`: after the loops, `return level + perkSum(state, content, 'click');`
- `deptMult(state: GameState, content: Content, dept: DepartmentDef)`: after the upgrade loop, `return mult.mul(perkDeptMult(state, content, dept.id));`
- `globalMult`: `return new Decimal(sealBonus).mul(boost).mul(perkGlobalMult(state, content));`
- `computeRates`: call `deptMult(state, content, dept)`.

`src/engine/offline.ts`:
- `import { perkSum } from './perks';`
- `offlineCapSeconds`: `hours += perkSum(state, content, 'offlineCapHours');` before `return`.
- `offlineRateFraction`: `rate += perkSum(state, content, 'offlineRate');` before the `Math.min`.

`src/engine/actions.ts`:
```ts
import { canBuyPerk } from './perks';
// extend the existing content import with findPerk

export function buyPerk(state: GameState, content: Content, perkId: string): GameState {
  if (!canBuyPerk(state, content, perkId).ok) return state;
  const perk = findPerk(content, perkId);
  return { ...state, seals: state.seals - perk.cost, perks: [...state.perks, perkId] };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine
git commit -m "feat(engine): Perk Ledger effects wired into multipliers, offline and click power"
git push origin main
```

---

### Task 4: Prestige engine (Fiscal Year Audit)

**Files:**
- Create: `src/engine/prestige.ts`, `src/engine/prestige.test.ts`
- Modify: `src/engine/state.ts` (export `startingDepartments`)

**Interfaces:**
- Consumes: `headStart` (Task 3), `startingDepartments(content)`.
- Produces:
  ```ts
  const AUDIT_THRESHOLD = 1_000_000;
  function sealsForRun(soulsRun: Decimal): number            // floor(sqrt(soulsRun / 1e6)); 0 below threshold
  function canAudit(state: GameState): boolean               // soulsRun ≥ AUDIT_THRESHOLD
  interface AuditResult { state: GameState; sealsGained: number; fiscalYear: number }
  function fileAudit(state: GameState, content: Content): AuditResult   // returns { state (same object), 0, year } when !canAudit
  ```
  Reset semantics: `kc = 0`, `soulsRun = 0`, `staff = headStart.staff`, `upgrades = {}`, `deptsUnlocked = startingDepartments ∪ headStart.depts` in content order, `activeDept = deptsUnlocked[0]`, `seals += gained`, `fiscalYear += 1`, `stats.audits += 1`. Everything else is kept (`soulsLifetime`, `vouchers`, `perks`, `boostUntilWall`, clocks, other stats).

- [ ] **Step 1: Write failing tests**

`src/engine/prestige.test.ts`:
```ts
import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import { sealsForRun, canAudit, fileAudit, AUDIT_THRESHOLD } from './prestige';

const now = { wall: 0, mono: 0 };

describe('sealsForRun', () => {
  it('is zero below the threshold and grows with the square root', () => {
    expect(sealsForRun(new Decimal(999_999))).toBe(0);
    expect(sealsForRun(new Decimal(AUDIT_THRESHOLD))).toBe(1);
    expect(sealsForRun(new Decimal(4_000_000))).toBe(2);
    expect(sealsForRun(new Decimal(1e8))).toBe(10);
    expect(sealsForRun(new Decimal('1e14'))).toBe(10_000);
  });
});

describe('fileAudit', () => {
  const rich = () => ({
    ...createInitialState(now, content),
    kc: new Decimal(123),
    soulsRun: new Decimal(9_000_000),
    soulsLifetime: new Decimal(9_500_000),
    staff: { dave: 50, 'h-cherub': 3 },
    upgrades: { 'faster-stapler': 2 },
    deptsUnlocked: ['intake', 'heaven'],
    activeDept: 'heaven',
    vouchers: 4,
    perks: ['throughput-1'],
    boostUntilWall: 5,
    stats: { clicks: 10, staffHired: 53, upgradesBought: 2, audits: 0 },
  });
  it('refuses below the threshold', () => {
    const s = { ...rich(), soulsRun: new Decimal(10) };
    const r = fileAudit(s, content);
    expect(r.state).toBe(s);
    expect(r.sealsGained).toBe(0);
  });
  it('resets the run, keeps the meta, grants seals', () => {
    const s = rich();
    const r = fileAudit(s, content);
    expect(r.sealsGained).toBe(3);
    expect(r.state.seals).toBe(3);
    expect(r.state.fiscalYear).toBe(2);
    expect(r.fiscalYear).toBe(2);
    expect(r.state.kc.toNumber()).toBe(0);
    expect(r.state.soulsRun.toNumber()).toBe(0);
    expect(r.state.soulsLifetime.toNumber()).toBe(9_500_000);
    expect(r.state.staff).toEqual({});
    expect(r.state.upgrades).toEqual({});
    expect(r.state.deptsUnlocked).toEqual(['intake']);
    expect(r.state.activeDept).toBe('intake');
    expect(r.state.vouchers).toBe(4);
    expect(r.state.perks).toEqual(['throughput-1']);
    expect(r.state.boostUntilWall).toBe(5);
    expect(r.state.stats.audits).toBe(1);
    expect(r.state.stats.clicks).toBe(10);
    expect(s.staff.dave).toBe(50); // no mutation
  });
  it('applies head-start perks after the reset', () => {
    const s = { ...rich(), perks: ['headstart-1', 'headstart-2', 'headstart-3'] };
    const r = fileAudit(s, content);
    expect(r.state.staff).toEqual({ dave: 10, seraphine: 10 });
    expect(r.state.deptsUnlocked).toEqual(['intake', 'heaven']);
    expect(r.state.activeDept).toBe('intake');
  });
  it('canAudit follows the threshold', () => {
    expect(canAudit({ ...rich(), soulsRun: new Decimal(AUDIT_THRESHOLD - 1) })).toBe(false);
    expect(canAudit(rich())).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/prestige.test.ts`
Expected: FAIL, cannot find module './prestige'.

- [ ] **Step 3: Implement**

In `src/engine/state.ts` change `function startingDepartments` to `export function startingDepartments`.

`src/engine/prestige.ts`:
```ts
import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import { startingDepartments } from './state';
import type { Content } from './content';
import { headStart } from './perks';

export const AUDIT_THRESHOLD = 1_000_000;

export function sealsForRun(soulsRun: Decimal): number {
  if (soulsRun.lt(AUDIT_THRESHOLD)) return 0;
  const n = soulsRun.div(AUDIT_THRESHOLD).sqrt().toNumber();
  return Number.isFinite(n) ? Math.floor(n) : Number.MAX_SAFE_INTEGER;
}

export function canAudit(state: GameState): boolean {
  return state.soulsRun.gte(AUDIT_THRESHOLD);
}

export interface AuditResult { state: GameState; sealsGained: number; fiscalYear: number }

export function fileAudit(state: GameState, content: Content): AuditResult {
  if (!canAudit(state)) return { state, sealsGained: 0, fiscalYear: state.fiscalYear };
  const sealsGained = sealsForRun(state.soulsRun);
  const start = headStart(state, content);
  const unlocked = new Set([...startingDepartments(content), ...start.depts]);
  const deptsUnlocked = content.departments.filter((d) => unlocked.has(d.id)).map((d) => d.id);
  const next: GameState = {
    ...state,
    kc: new Decimal(0),
    soulsRun: new Decimal(0),
    staff: { ...start.staff },
    upgrades: {},
    deptsUnlocked,
    activeDept: deptsUnlocked[0],
    seals: state.seals + sealsGained,
    fiscalYear: state.fiscalYear + 1,
    stats: { ...state.stats, audits: state.stats.audits + 1 },
  };
  return { state: next, sealsGained, fiscalYear: next.fiscalYear };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engine/prestige.test.ts` then `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine
git commit -m "feat(engine): Fiscal Year Audit prestige with seals and head-start perks"
git push origin main
```

---

### Task 5: Store — audit, perks, single rate pass, year-aware memos

**Files:**
- Modify: `src/engine/actions.ts`, `src/engine/actions.test.ts`, `src/store/game.ts`, `src/store/game.test.ts`

**Interfaces:**
- Consumes: `fileAudit` (Task 4), `buyPerk` (Task 3), `Rates`.
- Produces:
  ```ts
  // actions.ts
  interface TickResult { state: GameState; rates: Rates }
  function tickWithRates(state, content, dtSec, nowWall): TickResult   // computes rates once; tick() becomes a thin wrapper
  // store additions
  interface GameStore {
    ...existing;
    lastAudit: { sealsGained: number; fiscalYear: number } | null;   // drives the ceremony overlay
    audit(): void;
    dismissAudit(): void;
    buyPerk(perkId: string): void;
  }
  ```
  Memo pool: `boot`, `setActiveDept`, `rotateMemo`, `audit` pick from `dept.memos` when `fiscalYear === 1` and from `[...dept.memos, ...(dept.memosLate ?? [])]` when `fiscalYear ≥ 2`. The tick loop uses `tickWithRates` and stores its `rates` instead of recomputing.

- [ ] **Step 1: Write failing tests**

Append to `src/engine/actions.test.ts` (add `tickWithRates` to the actions import):
```ts
it('tickWithRates returns the rates used for the tick', () => {
  const s0 = { ...createInitialState(now, content), staff: { dave: 1 } };
  const r = tickWithRates(s0, content, 2, 0);
  expect(r.rates.soulsPerSec.toNumber()).toBeCloseTo(0.5);
  expect(r.state.soulsRun.toNumber()).toBeCloseTo(1);
});
```

Append to `src/store/game.test.ts` (reuse the file's `make()` helper; ensure `Decimal`, `createGameStore`, `memoryStorage`, `fakeClock`, `content` are imported):
```ts
describe('prestige and perks in the store', () => {
  it('audit resets the run and records the ceremony payload', async () => {
    const { store } = make();
    await store.getState().boot();
    store.setState({ state: { ...store.getState().state, soulsRun: new Decimal(4_000_000), staff: { dave: 5 } } });
    store.getState().audit();
    const s = store.getState();
    expect(s.state.seals).toBe(2);
    expect(s.state.staff).toEqual({});
    expect(s.lastAudit).toEqual({ sealsGained: 2, fiscalYear: 2 });
    expect(s.rates.soulsPerSec.toNumber()).toBe(0);
    s.dismissAudit();
    expect(store.getState().lastAudit).toBeNull();
    store.getState().stopLoop();
  });
  it('audit below threshold is a no-op', async () => {
    const { store } = make();
    await store.getState().boot();
    const before = store.getState().state;
    store.getState().audit();
    expect(store.getState().state).toBe(before);
    expect(store.getState().lastAudit).toBeNull();
    store.getState().stopLoop();
  });
  it('buyPerk spends seals and raises rates', async () => {
    const { store } = make();
    await store.getState().boot();
    store.setState({ state: { ...store.getState().state, seals: 5, staff: { dave: 1 } } });
    store.getState().buyPerk('throughput-1');
    expect(store.getState().state.seals).toBe(4);
    expect(store.getState().rates.soulsPerSec.toNumber()).toBeCloseTo(0.5 * 1.08 * 1.1); // 4 seals → ×1.08, perk ×1.1
    store.getState().stopLoop();
  });
  it('memo pool includes late memos from fiscal year 2', async () => {
    const dept = content.departments[0];
    const late = ['MEMO: year two only'];
    const twoYear = { ...content, departments: [{ ...dept, memosLate: late }, ...content.departments.slice(1)] };
    const s2 = createGameStore({ content: twoYear, storage: memoryStorage(), clock: fakeClock({ wall: 1, mono: 0 }), tickMs: 1_000_000, autosaveMs: 1_000_000 });
    await s2.getState().boot();
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) { s2.getState().rotateMemo(); seen.add(s2.getState().memoLine); }
    expect(seen.has(late[0])).toBe(false);
    s2.setState({ state: { ...s2.getState().state, fiscalYear: 2 } });
    for (let i = 0; i < 300; i++) { s2.getState().rotateMemo(); seen.add(s2.getState().memoLine); }
    expect(seen.has(late[0])).toBe(true);
    s2.getState().stopLoop();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/actions.test.ts src/store/game.test.ts`
Expected: FAIL — `tickWithRates`, `audit`, `buyPerk` missing.

- [ ] **Step 3: Implement actions.ts**

```ts
import type { Rates } from './economy';   // extend the existing economy import

export interface TickResult { state: GameState; rates: Rates }

export function tickWithRates(state: GameState, content: Content, dtSec: number, nowWall: number): TickResult {
  const rates = computeRates(state, content, nowWall);
  if (!(dtSec > 0) || rates.soulsPerSec.eq(0)) return { state: unlockDepartments(state, content), rates };
  const next = addSouls(state, rates.soulsPerSec.mul(dtSec), rates.kcPerSec.mul(dtSec));
  return { state: unlockDepartments(next, content), rates };
}

export function tick(state: GameState, content: Content, dtSec: number, nowWall: number): GameState {
  if (!(dtSec > 0)) return state;
  return tickWithRates(state, content, dtSec, nowWall).state;
}
```
The existing `tick` tests keep passing: with `dt ≤ 0` the identical state object is returned.

- [ ] **Step 4: Implement store changes**

In `src/store/game.ts`:
- Imports: `tickWithRates`, `buyPerk as buyPerkAction` from `../engine/actions`; `fileAudit` from `../engine/prestige`; `type DepartmentDef` from `../engine/content`.
- Add to `GameStore`: `lastAudit: { sealsGained: number; fiscalYear: number } | null; audit(): void; dismissAudit(): void; buyPerk(perkId: string): void;`
- Initial `lastAudit: null`.
- Helper (module scope):
  ```ts
  function memoPool(dept: DepartmentDef, fiscalYear: number): string[] {
    return fiscalYear >= 2 && dept.memosLate?.length ? [...dept.memos, ...dept.memosLate] : dept.memos;
  }
  ```
  Use `memoPool(dept, state.fiscalYear)` wherever `dept.memos` was passed to `pick` (`boot`, `setActiveDept`, `rotateMemo`).
- Tick loop body:
  ```ts
  const r = tickWithRates(get().state, content, dt, clock.wall());
  set({ state: r.state, rates: r.rates });
  ```
- Actions:
  ```ts
  audit() {
    const r = fileAudit(get().state, content);
    if (r.sealsGained === 0) return;
    const dept = findDepartment(content, r.state.activeDept);
    set({
      state: r.state,
      rates: computeRates(r.state, content, clock.wall()),
      lastAudit: { sealsGained: r.sealsGained, fiscalYear: r.fiscalYear },
      queueLine: pick(dept.queue, ''),
      memoLine: pick(memoPool(dept, r.state.fiscalYear), ''),
    });
    void get().save();
  },
  dismissAudit() { set({ lastAudit: null }); },
  buyPerk(perkId) { apply(buyPerkAction(get().state, content, perkId)); },
  ```

- [ ] **Step 5: Run to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine src/store
git commit -m "feat(store): audit, perk purchase, single-pass tick rates, year-aware memos"
git push origin main
```

---

### Task 6: Department chips, archetype characters, StaffRow subscription

**Files:**
- Create: `src/ui/components/DeptChips.tsx`, `src/ui/components/DeptChips.test.tsx`
- Modify: `src/ui/screens/OfficeScreen.tsx`, `src/ui/components/StaffRow.tsx`, `src/ui/characters/Character.tsx`, `src/ui/characters/Character.test.tsx`, `src/ui/theme.css`

**Interfaces:**
- Consumes: `useGame().state.deptsUnlocked`, `activeDept`, `soulsRun`, `setActiveDept`; `content.departments`.
- Produces: `<DeptChips />` — one chip per department in content order; unlocked chips are buttons with `aria-pressed` on the active one; locked chips are disabled buttons labelled `"<name> (locked)"` showing `formatNumber(unlockSouls)` and a progress bar `soulsRun / unlockSouls`. `Character` accepts ids `angel:N`, `demon:N`, `clerk:N`, `archivist:N` (N 0–4): four archetype bodies with an accessory by N (0 none, 1 glasses, 2 tie, 3 clipboard, 4 hat); `data-character` is the archetype, `data-variant` the number, accessory groups carry `data-accessory`.

- [ ] **Step 1: Write failing tests**

`src/ui/components/DeptChips.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { DeptChips } from './DeptChips';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(soulsRun: number, unlocked: string[]) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }, content), soulsRun: new Decimal(soulsRun), deptsUnlocked: unlocked, activeDept: unlocked[0] };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true });
}

describe('DeptChips', () => {
  it('renders every department, marks the active one, disables locked ones', () => {
    seed(5000, ['intake']);
    render(<DeptChips />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.getByRole('button', { name: /^intake$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /heaven admissions \(locked\)/i })).toBeDisabled();
  });
  it('switches the active department', () => {
    seed(20000, ['intake', 'heaven']);
    render(<DeptChips />);
    fireEvent.click(screen.getByRole('button', { name: /^heaven admissions$/i }));
    expect(useGame.getState().state.activeDept).toBe('heaven');
  });
  it('shows unlock progress for a locked department', () => {
    seed(5000, ['intake']);
    render(<DeptChips />);
    const chip = screen.getByRole('button', { name: /heaven admissions \(locked\)/i });
    expect(chip.querySelector('.bar-fill')).toHaveStyle({ width: '50%' });
  });
});
```

Append to `src/ui/characters/Character.test.tsx`:
```tsx
it('renders archetype variants with accessories', () => {
  for (const arch of ['angel', 'demon', 'clerk', 'archivist']) {
    const { container, unmount } = render(<Character id={`${arch}:3`} mood="ok" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('data-character')).toBe(arch);
    expect(svg.getAttribute('data-variant')).toBe('3');
    expect(svg.querySelector('[data-accessory="clipboard"]')).not.toBeNull();
    unmount();
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/components/DeptChips.test.tsx src/ui/characters/Character.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement DeptChips and wire it in**

`src/ui/components/DeptChips.tsx`:
```tsx
import type { CSSProperties } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { formatNumber } from '../../engine/format';

export function DeptChips() {
  const unlocked = useGame((s) => s.state.deptsUnlocked);
  const active = useGame((s) => s.state.activeDept);
  const soulsRun = useGame((s) => s.state.soulsRun);
  const setActiveDept = useGame((s) => s.setActiveDept);
  return (
    <div className="dept-chips" role="group" aria-label="Departments">
      {content.departments.map((d) => {
        const style = { '--accent': d.accent } as CSSProperties;
        if (unlocked.includes(d.id)) {
          return (
            <button key={d.id} className={'chip' + (active === d.id ? ' active' : '')} style={style} aria-pressed={active === d.id} onClick={() => setActiveDept(d.id)}>
              {d.name}
            </button>
          );
        }
        const progress = Math.min(1, soulsRun.div(d.unlockSouls).toNumber());
        return (
          <button key={d.id} className="chip locked" style={style} disabled aria-label={`${d.name} (locked)`}>
            <span>{d.name}</span>
            <span className="mono sub">{formatNumber(d.unlockSouls)} souls</span>
            <span className="bar"><span className="bar-fill" style={{ width: progress * 100 + '%' }} /></span>
          </button>
        );
      })}
    </div>
  );
}
```
(`toNumber()` on the quotient may return `Infinity` for enormous `soulsRun`; `Math.min(1, …)` clamps it.)

In `src/ui/screens/OfficeScreen.tsx` insert `<DeptChips />` between `<CurrencyBar />` and the `<h2 className="dept-title">` (import it).

Append to `src/ui/theme.css`:
```css
.dept-chips { display: flex; gap: 6px; overflow-x: auto; padding: 2px 0 8px; scrollbar-width: none; }
.dept-chips::-webkit-scrollbar { display: none; }
.chip { flex: 0 0 auto; display: flex; flex-direction: column; gap: 2px; min-width: 112px; padding: 6px 10px; border: 1.5px solid var(--line); border-radius: 14px; background: var(--surface); font-size: 12px; font-weight: 600; color: var(--ink-muted); text-align: left; }
.chip.active { border-color: var(--accent); color: var(--accent); }
.chip.locked { opacity: 0.7; }
.chip .bar { display: block; width: 100%; }
```

- [ ] **Step 4: StaffRow equality-selected rate**

In `src/ui/components/StaffRow.tsx` add `const ZERO = new Decimal(0);` at module scope and replace the rate selector with:
```tsx
const rate = useGame((s) => s.rates.byStaff[staff.id] ?? ZERO, (a, b) => a.eq(b));
```
(zustand v4's bound hook accepts an equality function as the second argument.)

- [ ] **Step 5: Archetype characters**

In `src/ui/characters/Character.tsx`, above `REGISTRY`:
```tsx
type Accessory = 'none' | 'glasses' | 'tie' | 'clipboard' | 'hat';
const ACCESSORIES: Accessory[] = ['none', 'glasses', 'tie', 'clipboard', 'hat'];

function AccessoryLayer({ kind, cx, cy }: { kind: Accessory; cx: number; cy: number }) {
  switch (kind) {
    case 'glasses':
      return <g data-accessory="glasses" stroke={OUTLINE} strokeWidth={SW} fill="none"><circle cx={cx - 5} cy={cy} r={4} /><circle cx={cx + 5} cy={cy} r={4} /><path d={`M ${cx - 1} ${cy} h 2`} /></g>;
    case 'tie':
      return <path data-accessory="tie" d={`M ${cx} ${cy + 14} l -3 6 l 3 8 l 3 -8 z`} fill="var(--brass)" stroke={OUTLINE} strokeWidth={SW} />;
    case 'clipboard':
      return <g data-accessory="clipboard"><rect x={cx + 10} y={cy + 14} width={10} height={13} rx={1.5} fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} /><path d={`M ${cx + 13} ${cy + 18} h 4 M ${cx + 13} ${cy + 22} h 4`} stroke={OUTLINE} strokeWidth={1.5} /></g>;
    case 'hat':
      return <g data-accessory="hat"><rect x={cx - 12} y={cy - 16} width={24} height={4} rx={1} fill={OUTLINE} /><rect x={cx - 8} y={cy - 26} width={16} height={11} rx={1.5} fill={OUTLINE} /></g>;
    default:
      return null;
  }
}

function Angel({ mood, accessory }: { mood: Mood; accessory: Accessory }) {
  return (
    <>
      <ellipse cx="32" cy="8" rx="9" ry="2.5" fill="none" stroke="var(--brass)" strokeWidth={SW} />
      <path d="M12 36 C4 32 4 22 12 22 L12 36 Z M52 36 C60 32 60 22 52 22 L52 36 Z" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M19 54 L19 34 C19 27 45 27 45 34 L45 54 Z" fill="var(--teal)" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="22" r="10" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <Face mood={mood} cx={32} cy={21} />
      <AccessoryLayer kind={accessory} cx={32} cy={21} />
    </>
  );
}

function Demon({ mood, accessory }: { mood: Mood; accessory: Accessory }) {
  return (
    <>
      <path d="M22 15 L17 5 L27 12 Z M42 15 L47 5 L37 12 Z" fill="var(--red)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M17 54 L17 36 C17 28 47 28 47 36 L47 54 Z" fill="var(--red)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M47 44 C56 40 58 48 52 52" fill="none" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="23" r="11" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <Face mood={mood} cx={32} cy={22} />
      <AccessoryLayer kind={accessory} cx={32} cy={22} />
    </>
  );
}

function Clerk({ mood, accessory }: { mood: Mood; accessory: Accessory }) {
  return (
    <>
      <path d="M18 54 L18 36 C18 28 46 28 46 36 L46 54 Z" fill="var(--brass)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M26 30 L32 40 L38 30" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="21" r="11" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M21 18 C24 10 40 10 43 18" fill={OUTLINE} />
      <Face mood={mood} cx={32} cy={21} />
      <AccessoryLayer kind={accessory} cx={32} cy={21} />
    </>
  );
}

function Archivist({ mood, accessory }: { mood: Mood; accessory: Accessory }) {
  return (
    <>
      <path d="M18 54 L18 34 C18 26 46 26 46 34 L46 54 Z" fill="var(--violet)" stroke={OUTLINE} strokeWidth={SW} />
      <rect x="10" y="40" width="10" height="12" rx="1" fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M12 44 h 6 M12 48 h 6" stroke={OUTLINE} strokeWidth={1.5} />
      <circle cx="32" cy="21" r="11" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M22 16 C26 8 38 8 42 16 L40 12 L36 15 L32 11 L28 15 L24 12 Z" fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <Face mood={mood} cx={32} cy={21} />
      <AccessoryLayer kind={accessory} cx={32} cy={21} />
    </>
  );
}

const ARCHETYPES: Record<string, (p: { mood: Mood; accessory: Accessory }) => ReactElement> = {
  angel: Angel, demon: Demon, clerk: Clerk, archivist: Archivist,
};
```
Replace `Character`:
```tsx
export function Character({ id, mood, size = 56 }: { id: string; mood: Mood; size?: number }) {
  const [arch, variantStr] = id.split(':');
  const Arch = ARCHETYPES[arch];
  if (Arch) {
    const variant = Math.min(ACCESSORIES.length - 1, Math.max(0, Number(variantStr ?? 0) || 0));
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} data-character={arch} data-variant={variant} data-mood={mood} aria-hidden="true">
        <Arch mood={mood} accessory={ACCESSORIES[variant]} />
      </svg>
    );
  }
  const Body = REGISTRY[id] ?? Soul;
  const resolved = REGISTRY[id] ? id : 'soul';
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} data-character={resolved} data-mood={mood} aria-hidden="true">
      <Body mood={mood} />
    </svg>
  );
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Visual check**

Run `npm run dev` at a 412 px viewport: chips scroll horizontally, the locked chip shows progress, switching chips changes accent, staff and queue; each archetype renders (seed a save with all departments unlocked through the console if needed). Stop the server.

- [ ] **Step 8: Commit**

```bash
git add src/ui
git commit -m "feat(ui): department chips with unlock progress, archetype characters, cheaper staff rows"
git push origin main
```

---

### Task 7: Ledger screen, Perk Tree, Audit ceremony

**Files:**
- Create: `src/ui/screens/LedgerScreen.tsx`, `src/ui/components/PerkTree.tsx`, `src/ui/overlays/AuditCeremony.tsx`, `src/ui/screens/LedgerScreen.test.tsx`, `src/ui/overlays/AuditCeremony.test.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/theme.css`

**Interfaces:**
- Consumes: `useGame().state.seals`, `soulsRun`, `perks`, `fiscalYear`, `audit()`, `buyPerk()`, `lastAudit`, `dismissAudit()`; `sealsForRun`, `AUDIT_THRESHOLD`; `canBuyPerk`; `content.perks`.
- Produces:
  - `<LedgerScreen />`: header card with `Karma Seals` and `Fiscal Year N`; an Audit card with `Audit now for +N Seals` and a button `aria-label="File Annual Audit"` (disabled below threshold, with text `Need 1.00M souls this run (… so far)`); two-step confirm: first click sets `confirming`, the button reads `Confirm audit (resets the run)` and a `Cancel` button appears; second click calls `audit()`. Then `<PerkTree />`, then a locked `Cosmic Restructuring` card reading `Unlocks at 100 Seals`.
  - `<PerkTree />`: branch sections in order Throughput, Overtime, Stapler, Requisition, Head Start; each perk a button `aria-label="<perk name>"` with name, desc, cost and a class `owned | available | locked | unaffordable`; `disabled` unless `available`; click → `buyPerk(id)`; locked perks list prerequisite names.
  - `<AuditCeremony />`: nothing unless `lastAudit`; overlay `role="dialog"` `aria-label="Fiscal Year Audit"`, SVG stamp "APPROVED" with a `slam` animation, `+N Karma Seals`, `Fiscal Year N begins`, button `Back to the office` → `dismissAudit()`.
  - App: Ledger tab renders `<LedgerScreen />`; `<AuditCeremony />` mounted after `<BacklogReport />`.

- [ ] **Step 1: Write failing tests**

`src/ui/screens/LedgerScreen.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { LedgerScreen } from './LedgerScreen';
import { useGame } from '../../store/game';
import { createInitialState, type GameState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(patch: Partial<GameState>) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }, content), ...patch };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, lastAudit: null });
}

describe('LedgerScreen', () => {
  it('disables the audit below the threshold', () => {
    seed({ soulsRun: new Decimal(10) });
    render(<LedgerScreen />);
    expect(screen.getByRole('button', { name: /file annual audit/i })).toBeDisabled();
    expect(screen.getByText(/need 1\.00M souls/i)).toBeInTheDocument();
  });
  it('shows the seal preview and requires confirmation', () => {
    seed({ soulsRun: new Decimal(9_000_000), staff: { dave: 3 } });
    render(<LedgerScreen />);
    expect(screen.getByText(/\+3 seals/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /file annual audit/i }));
    expect(useGame.getState().state.seals).toBe(0);
    expect(screen.getByText(/confirm audit/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /file annual audit/i }));
    expect(useGame.getState().state.seals).toBe(3);
    expect(useGame.getState().state.staff).toEqual({});
    expect(useGame.getState().lastAudit).toEqual({ sealsGained: 3, fiscalYear: 2 });
  });
  it('renders the perk tree and buys an available perk', () => {
    seed({ seals: 2 });
    render(<LedgerScreen />);
    const root = screen.getByRole('button', { name: /stamped memo pads/i });
    expect(root).toBeEnabled();
    expect(screen.getByRole('button', { name: /two-sided forms/i })).toBeDisabled();
    fireEvent.click(root);
    expect(useGame.getState().state.perks).toEqual(['throughput-1']);
    expect(useGame.getState().state.seals).toBe(1);
    expect(screen.getByRole('button', { name: /stamped memo pads/i })).toHaveClass('owned');
    expect(screen.getByRole('button', { name: /two-sided forms/i })).toHaveClass('unaffordable');
  });
  it('shows the cosmic placeholder', () => {
    seed({});
    render(<LedgerScreen />);
    expect(screen.getByText(/unlocks at 100 seals/i)).toBeInTheDocument();
  });
});
```

`src/ui/overlays/AuditCeremony.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { AuditCeremony } from './AuditCeremony';
import { useGame } from '../../store/game';

describe('AuditCeremony', () => {
  it('renders nothing without a recent audit', () => {
    useGame.setState({ lastAudit: null });
    expect(render(<AuditCeremony />).container).toBeEmptyDOMElement();
  });
  it('shows seals and year, dismisses', () => {
    useGame.setState({ lastAudit: { sealsGained: 4, fiscalYear: 3 } });
    render(<AuditCeremony />);
    expect(screen.getByRole('dialog', { name: /fiscal year audit/i })).toBeInTheDocument();
    expect(screen.getByText(/\+4 karma seals/i)).toBeInTheDocument();
    expect(screen.getByText(/fiscal year 3 begins/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back to the office/i }));
    expect(useGame.getState().lastAudit).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/screens/LedgerScreen.test.tsx src/ui/overlays/AuditCeremony.test.tsx`
Expected: FAIL, modules missing.

- [ ] **Step 3: Implement PerkTree**

`src/ui/components/PerkTree.tsx`:
```tsx
import { useGame } from '../../store/game';
import { content } from '../../data';
import { canBuyPerk } from '../../engine/perks';
import type { PerkBranch, PerkDef } from '../../engine/content';

const BRANCHES: Array<{ id: PerkBranch; title: string; blurb: string }> = [
  { id: 'throughput', title: 'Throughput', blurb: 'More souls per second, department by department.' },
  { id: 'overtime', title: 'Overtime', blurb: 'Longer, richer offline shifts.' },
  { id: 'stapler', title: 'Stapler', blurb: 'Heavier stamps.' },
  { id: 'requisition', title: 'Requisition', blurb: 'Vouchers and lanyards for the Personnel lottery.' },
  { id: 'headstart', title: 'Head Start', blurb: 'Skip the first morning of every fiscal year.' },
];

function perkName(id: string): string {
  return content.perks.find((p) => p.id === id)?.name ?? id;
}

function PerkNode({ perk }: { perk: PerkDef }) {
  const seals = useGame((s) => s.state.seals);
  const perks = useGame((s) => s.state.perks);
  const state = useGame((s) => s.state);
  const buy = useGame((s) => s.buyPerk);
  void seals; void perks; // subscribed so the node re-renders on purchase
  const check = canBuyPerk(state, content, perk.id);
  const status = check.ok ? 'available' : check.reason === 'owned' ? 'owned' : check.reason === 'locked' ? 'locked' : 'unaffordable';
  return (
    <button className={`card perk ${status}`} disabled={!check.ok} onClick={() => buy(perk.id)} aria-label={perk.name}>
      <div className="perk-head">
        <span className="staff-name">{perk.name}</span>
        <span className="mono seal-cost">{status === 'owned' ? 'OWNED' : `${perk.cost} ◆`}</span>
      </div>
      <div className="sub">{perk.desc}</div>
      {status === 'locked' && <div className="sub">Requires {perk.requires.map(perkName).join(', ')}</div>}
    </button>
  );
}

export function PerkTree() {
  return (
    <div className="perk-tree">
      {BRANCHES.map((b) => (
        <section key={b.id} className="perk-branch">
          <div className="section-head"><h3>{b.title}</h3><span className="sub">{b.blurb}</span></div>
          {content.perks.filter((p) => p.branch === b.id).map((p) => <PerkNode key={p.id} perk={p} />)}
        </section>
      ))}
    </div>
  );
}
```
Simplify: drop the `seals`/`perks` selectors and the `void` line — subscribing to `state` already re-renders on every change. Keep only `const state = useGame((s) => s.state);`. (The extra selectors above are illustrative of what changes; do not ship them.)

- [ ] **Step 4: Implement LedgerScreen**

`src/ui/screens/LedgerScreen.tsx`:
```tsx
import { useState } from 'react';
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { sealsForRun, AUDIT_THRESHOLD } from '../../engine/prestige';
import { PerkTree } from '../components/PerkTree';

export function LedgerScreen() {
  const seals = useGame((s) => s.state.seals);
  const year = useGame((s) => s.state.fiscalYear);
  const soulsRun = useGame((s) => s.state.soulsRun);
  const audit = useGame((s) => s.audit);
  const [confirming, setConfirming] = useState(false);
  const ready = soulsRun.gte(AUDIT_THRESHOLD);
  const preview = sealsForRun(soulsRun);
  const onAudit = () => {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    audit();
  };
  return (
    <section className="screen ledger">
      <header className="currency-bar card">
        <div><div className="label">Karma Seals</div><div className="mono value brass">{seals} ◆</div></div>
        <div><div className="label">Fiscal Year</div><div className="mono value">{year}</div></div>
      </header>
      <div className="card audit-card">
        <h3>Fiscal Year Audit</h3>
        <p className="sub">Close the books. Staff, upgrades and departments reset; Seals, perks and vouchers stay.</p>
        {ready
          ? <div className="mono">Audit now for <strong>+{preview} Seals</strong></div>
          : <div className="mono sub">Need {formatNumber(AUDIT_THRESHOLD)} souls this run ({formatNumber(soulsRun)} so far)</div>}
        <div className="modal-actions">
          <button className={'btn ' + (confirming ? 'btn-primary' : '')} disabled={!ready} onClick={onAudit} aria-label="File Annual Audit">
            {confirming ? 'Confirm audit (resets the run)' : 'File Annual Audit'}
          </button>
          {confirming && <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>}
        </div>
      </div>
      <div className="section-head"><h3>Perk Ledger</h3><span className="sub">Spend Seals. Permanent.</span></div>
      <PerkTree />
      <div className="card cosmic-card">
        <h3>Cosmic Restructuring</h3>
        <p className="sub">Unlocks at 100 Seals. The Auditor has been asking questions.</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Implement AuditCeremony, styles, App wiring**

`src/ui/overlays/AuditCeremony.tsx`:
```tsx
import { useGame } from '../../store/game';

export function AuditCeremony() {
  const last = useGame((s) => s.lastAudit);
  const dismiss = useGame((s) => s.dismissAudit);
  if (!last) return null;
  return (
    <div className="modal-backdrop ceremony">
      <div className="modal card" role="dialog" aria-modal="true" aria-label="Fiscal Year Audit">
        <svg viewBox="0 0 200 110" width="200" height="110" className="slam" aria-hidden="true">
          <rect x="6" y="18" width="188" height="74" rx="8" fill="none" stroke="var(--red)" strokeWidth="5" transform="rotate(-6 100 55)" />
          <text x="100" y="66" textAnchor="middle" fill="var(--red)" fontFamily="var(--font-display)" fontSize="34" transform="rotate(-6 100 55)">APPROVED</text>
        </svg>
        <h2 className="modal-title">Books closed.</h2>
        <div className="mono value brass">+{last.sealsGained} Karma Seals</div>
        <p className="sub">Fiscal Year {last.fiscalYear} begins. The backlog is fresh. The memos are not.</p>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={dismiss}>Back to the office</button>
        </div>
      </div>
    </div>
  );
}
```
Append to `src/ui/theme.css`:
```css
.ceremony .modal { text-align: center; }
.slam { display: block; margin: 0 auto 8px; animation: slam 420ms cubic-bezier(.2,1.4,.4,1) both; }
@keyframes slam { 0% { transform: scale(2.4) rotate(-10deg); opacity: 0; } 60% { transform: scale(0.96); opacity: 1; } 100% { transform: scale(1); } }
.perk-branch { margin-bottom: 14px; }
.perk { display: block; width: 100%; text-align: left; margin-bottom: 8px; }
.perk-head { display: flex; justify-content: space-between; gap: 8px; }
.seal-cost { color: var(--brass); }
.perk.owned { border-color: var(--green); }
.perk.owned .seal-cost { color: var(--green); }
.perk.available { border-color: var(--brass); }
.perk.locked, .perk.unaffordable { opacity: 0.6; }
.audit-card h3, .cosmic-card h3 { margin-bottom: 4px; }
.cosmic-card { margin-top: 12px; opacity: 0.75; }
```
In `src/ui/App.tsx`: import `LedgerScreen` and `AuditCeremony`; replace the Ledger placeholder with `<LedgerScreen />`; render `<AuditCeremony />` after `<BacklogReport />`.

- [ ] **Step 6: Run to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Visual check**

Run `npm run dev`: seed a run ≥ 1M souls (write the save with the `Storage.prototype.setItem` no-op trick used in Plan 1's check, then reload), open Ledger, file the audit through confirm, see the ceremony, dismiss, confirm the Office resets to Intake and year-2 memos appear in the ticker. Buy a perk; watch the rate change. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add src/ui
git commit -m "feat(ui): Ledger tab with audit confirmation, perk tree and audit ceremony"
git push origin main
```

---

### Task 8: Balance simulator and pacing assertions

**Files:**
- Create: `src/sim/simulate.ts`, `src/sim/run.ts`, `src/sim/pacing.test.ts`
- Modify: `package.json` (`"sim": "tsx src/sim/run.ts"`, devDependency `tsx`), and — only if a pacing assertion fails — `baseCost`/`baseRate` numbers in `src/data/departments/*.json`

**Interfaces:**
- Produces:
  ```ts
  interface SimOptions { sessionsPerDay: number; sessionSec: number; clicksPerSec: number; days: number; startSeals?: number; startPerks?: string[] }
  interface DaySnapshot { day: number; soulsRun: string; kc: string; deptsUnlocked: string[]; seals: number }
  interface SimResult { days: DaySnapshot[]; firstUnlockSec: Record<string, number>; firstAuditReadyDay: number | null; firstAuditReadySec: number | null; secondsPlayed: number }
  function simulate(opts: SimOptions, content: Content): SimResult
  ```
  Model: each session is `sessionSec` one-second ticks; each second the player clicks `clicksPerSec` times, then greedily buys the cheapest affordable purchase among unlocked staff (×1) and upgrades until nothing is affordable; between sessions the gap `(86400 − sessionsPerDay × sessionSec) / sessionsPerDay` seconds is credited via `applyOffline`. The player never audits. `firstUnlockSec[dept]` records cumulative played seconds at unlock; `firstAuditReadyDay`/`Sec` when `canAudit` first holds. `src/sim/run.ts` prints the day table for a check-in player (5 × 180 s, 3 clicks/s, 14 days) and an active player (2 × 1800 s, 5 clicks/s, 14 days).

- [ ] **Step 1: Write failing test**

`src/sim/pacing.test.ts`:
```ts
import { simulate } from './simulate';
import { content } from '../data';

const checkIn = { sessionsPerDay: 5, sessionSec: 180, clicksPerSec: 3, days: 14 };

describe('pacing targets (spec §4)', () => {
  const r = simulate(checkIn, content);
  it('unlocks the first department within 15 minutes of play', () => {
    expect(r.firstUnlockSec.heaven).toBeLessThanOrEqual(15 * 60);
  });
  it('makes the first audit available on day 2-3', () => {
    expect(r.firstAuditReadyDay).not.toBeNull();
    expect(r.firstAuditReadyDay!).toBeGreaterThanOrEqual(2);
    expect(r.firstAuditReadyDay!).toBeLessThanOrEqual(3);
  });
  it('spaces later departments 2-4 hours of play apart', () => {
    const order = ['heaven', 'hell', 'reincarnation', 'limbo'];
    for (let i = 1; i < order.length; i++) {
      const a = r.firstUnlockSec[order[i - 1]];
      const b = r.firstUnlockSec[order[i]];
      if (b === undefined) continue; // limbo may not be reached in 14 days on a fresh run
      expect(b - a, `${order[i - 1]} -> ${order[i]}`).toBeGreaterThanOrEqual(2 * 3600);
      expect(b - a, `${order[i - 1]} -> ${order[i]}`).toBeLessThanOrEqual(4 * 3600);
    }
  });
  it('a 20-seal run reaches the audit threshold at least 3x faster', () => {
    const fresh = simulate({ ...checkIn, days: 10 }, content);
    const seeded = simulate({ ...checkIn, days: 10, startSeals: 20, startPerks: ['throughput-1', 'throughput-2', 'headstart-1'] }, content);
    expect(fresh.firstAuditReadySec).not.toBeNull();
    expect(seeded.firstAuditReadySec).not.toBeNull();
    expect(seeded.firstAuditReadySec! * 3).toBeLessThanOrEqual(fresh.firstAuditReadySec!);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/sim/pacing.test.ts`
Expected: FAIL, module missing.

- [ ] **Step 3: Implement simulate.ts and run.ts**

`src/sim/simulate.ts`:
```ts
import Decimal from 'break_infinity.js';
import type { Content } from '../engine/content';
import { createInitialState, type GameState } from '../engine/state';
import { tick, click, buyStaff, buyUpgrade } from '../engine/actions';
import { staffUnitCost, upgradeCost, upgradeLevel } from '../engine/economy';
import { applyOffline } from '../engine/offline';
import { canAudit } from '../engine/prestige';

export interface SimOptions { sessionsPerDay: number; sessionSec: number; clicksPerSec: number; days: number; startSeals?: number; startPerks?: string[] }
export interface DaySnapshot { day: number; soulsRun: string; kc: string; deptsUnlocked: string[]; seals: number }
export interface SimResult { days: DaySnapshot[]; firstUnlockSec: Record<string, number>; firstAuditReadyDay: number | null; firstAuditReadySec: number | null; secondsPlayed: number }

function buyGreedy(state: GameState, content: Content): GameState {
  for (;;) {
    let best: { kind: 'staff' | 'upgrade'; id: string } | null = null;
    let bestCost: Decimal | null = null;
    for (const d of content.departments) {
      if (!state.deptsUnlocked.includes(d.id)) continue;
      for (const s of d.staff) {
        const c = staffUnitCost(s, state.staff[s.id] ?? 0);
        if (c.lte(state.kc) && (!bestCost || c.lt(bestCost))) { bestCost = c; best = { kind: 'staff', id: s.id }; }
      }
      for (const u of d.upgrades) {
        const lvl = upgradeLevel(state, u.id);
        if (lvl >= u.maxLevel) continue;
        const c = upgradeCost(u, lvl);
        if (c.lte(state.kc) && (!bestCost || c.lt(bestCost))) { bestCost = c; best = { kind: 'upgrade', id: u.id }; }
      }
    }
    if (!best) return state;
    state = best.kind === 'staff' ? buyStaff(state, content, best.id, 1) : buyUpgrade(state, content, best.id);
  }
}

export function simulate(opts: SimOptions, content: Content): SimResult {
  let state: GameState = { ...createInitialState({ wall: 0, mono: 0 }, content), seals: opts.startSeals ?? 0, perks: [...(opts.startPerks ?? [])] };
  const firstUnlockSec: Record<string, number> = {};
  let firstAuditReadyDay: number | null = null;
  let firstAuditReadySec: number | null = null;
  let played = 0;
  const days: DaySnapshot[] = [];
  const gapSec = (86_400 - opts.sessionsPerDay * opts.sessionSec) / opts.sessionsPerDay;
  const note = (day: number) => {
    for (const id of state.deptsUnlocked) if (!(id in firstUnlockSec) && id !== 'intake') firstUnlockSec[id] = played;
    if (firstAuditReadyDay === null && canAudit(state)) { firstAuditReadyDay = day; firstAuditReadySec = played; }
  };
  for (let day = 1; day <= opts.days; day++) {
    for (let s = 0; s < opts.sessionsPerDay; s++) {
      for (let t = 0; t < opts.sessionSec; t++) {
        for (let c = 0; c < opts.clicksPerSec; c++) state = click(state, content, 0);
        state = tick(state, content, 1, 0);
        state = buyGreedy(state, content);
        played += 1;
        note(day);
      }
      state = applyOffline(state, content, gapSec, 0).state;
      state = buyGreedy(state, content);
      note(day);
    }
    days.push({ day, soulsRun: state.soulsRun.toString(), kc: state.kc.toString(), deptsUnlocked: [...state.deptsUnlocked], seals: state.seals });
  }
  return { days, firstUnlockSec, firstAuditReadyDay, firstAuditReadySec, secondsPlayed: played };
}
```

`src/sim/run.ts`:
```ts
import { simulate, type SimResult } from './simulate';
import { content } from '../data';

function table(label: string, r: SimResult) {
  console.log(`\n== ${label} ==`);
  console.log('day  soulsRun         kc               depts');
  for (const d of r.days) {
    console.log(`${String(d.day).padStart(3)}  ${d.soulsRun.padEnd(16)} ${d.kc.padEnd(16)} ${d.deptsUnlocked.join(',')}`);
  }
  console.log('first unlock (played sec):', r.firstUnlockSec);
  console.log('audit ready: day', r.firstAuditReadyDay, 'at played sec', r.firstAuditReadySec);
}

table('check-in player (5 x 3 min, 3 clicks/s)', simulate({ sessionsPerDay: 5, sessionSec: 180, clicksPerSec: 3, days: 14 }, content));
table('active player (2 x 30 min, 5 clicks/s)', simulate({ sessionsPerDay: 2, sessionSec: 1800, clicksPerSec: 5, days: 14 }, content));
```
Add to `package.json`: script `"sim": "tsx src/sim/run.ts"`; devDependency `"tsx": "^4.19.2"`; run `npm install`. `tsconfig.json` `include: ["src"]` already covers `src/sim`. If `tsx` cannot resolve the `.json` imports in `src/data/index.ts`, add `"resolveJsonModule"` is already on — it is; if it still fails, run with `npx tsx --tsconfig tsconfig.json src/sim/run.ts`.

- [ ] **Step 4: Run the sim and the test; tune if needed**

Run: `npm run sim` then `npx vitest run src/sim/pacing.test.ts`
Expected: the table prints. The pacing test may FAIL. If so, tune **only** `baseCost`/`baseRate` in `src/data/departments/*.json` until all four assertions pass, keeping the monotonic content test green. Typical levers: raise Intake late-staff rates or lower Heaven/Hell first-staff costs to reach the audit by day 2–3; scale a whole department's costs together to move its unlock spacing. Record the final day table in the commit body.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS. The sim test simulates 3 runs × ≤ 14 days × 900 played seconds (≈ 38 000 ticks total) plus offline credits; if it exceeds 20 s on your machine, reduce `days` to 10 in `checkIn` (keep the assertions).

- [ ] **Step 6: Commit**

```bash
git add src/sim src/data package.json package-lock.json
git commit -m "feat(sim): balance simulator with pacing assertions; tune department numbers"
git push origin main
```

---

## Self-review

**Spec coverage (Plan 2 scope):**
- §5 departments: five departments, thresholds, accents, 4–6 staff, 3–6 upgrades, 15+ queue/memos, chips with lock progress — Tasks 1, 2, 6.
- §6 prestige: threshold 1M, `floor(sqrt(souls/1e6))`, reset/keep lists, +2%/seal (existing), Perk Ledger 40 nodes in five branches with costs and prerequisites, Head Start, audit ceremony, year-specific memos — Tasks 1, 3, 4, 5, 7.
- §4 pacing targets — Task 8.
- §11 architecture: engine purity, content as data — Tasks 1–5.
- §12 save versioning: v3 migration + fixtures — Task 1.
- §13 simulator — Task 8. Plan 1 final-review deferrals: single rate pass (Task 5), StaffRow equality selector (Task 6).
- Cosmic Restructuring: placeholder card in Task 7; save fields for `cosmicClauses` / `branchesUnlocked` are added in Plan 4 alongside its other save changes.

**Placeholder scan:** none. (Task 7 Step 3 shows illustrative extra selectors and then instructs to ship only the `state` selector.)

**Type consistency:** `deptMult(state, content, dept)` in Task 3 tests, `computeRates`, and no UI callers; engine `buyPerk` (Task 3) vs store `buyPerk` importing it as `buyPerkAction` (Task 5); `fileAudit` → `{ state, sealsGained, fiscalYear }` consumed by the store (Task 5) and surfaced as `lastAudit` (Task 7 tests); `startingDepartments` exported in Task 4 and used by `fileAudit`; `tickWithRates` → `{ state, rates }` used by the store loop; `Character` ids `angel|demon|clerk|archivist:N` match Task 2 content; `PerkBranch` exported in Task 1 and used in Task 7; `SimResult.firstAuditReadySec` defined in Task 8 and asserted in its test.

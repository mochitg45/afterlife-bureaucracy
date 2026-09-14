# Afterlife Bureaucracy — Plan 1: Foundation and Core Loop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable Intake office on web and Android: stamp souls, hire the four Intake staff, buy upgrades, earn capped offline income, with the game engine fully unit-tested and the save format versioned.

**Architecture:** Pure-function engine in `src/engine` (no React, no platform imports) operating on a `GameState` whose big numbers are `Decimal` from break_infinity.js. Content lives in JSON under `src/data`, validated by zod. A zustand store owns state, runs a 10 Hz tick, and autosaves through a `Storage` interface with localStorage and Capacitor Preferences implementations. React UI in `src/ui` reads the store.

**Tech Stack:** Vite 6, React 18, TypeScript 5, zustand 4, break_infinity.js, zod, vitest 2 + jsdom + Testing Library, Capacitor 7 (`@capacitor/core`, `@capacitor/android`, `@capacitor/preferences`, `@capacitor/app`), fontsource packages for Special Elite, IBM Plex Sans, IBM Plex Mono.

**Spec:** `docs/superpowers/specs/2026-09-14-afterlife-bureaucracy-design.md`

## Global Constraints

- Android target SDK 36 (`compileSdkVersion = 36`, `targetSdkVersion = 36` in `android/variables.gradle`).
- Engine code in `src/engine` must not import React, zustand, or anything from `@capacitor/*`.
- All soul and KC quantities are `Decimal` (break_infinity.js). Counts (staff owned, upgrade levels, seals, vouchers) are plain numbers.
- Staff cost: `baseCost × 1.15^owned`. Milestones ×2 at 10, 25, 50, 100, 200, 300, 400, 500, then every 100.
- Click power: `(1 + staplerLevel) + 0.01 × totalPassivePerSecond × clickPerk` (clickPerk is 1 in this plan).
- KC from clicks = souls from clicks; KC from passive = 0.4 × souls from passive.
- Offline: base cap 4 h, base rate 50% of online; return after ≥ 60 s shows the Backlog Report.
- Global multiplier includes Seal bonus `(1 + 0.02 × seals)` and boost `×2` while Overtime Boost is active. Seals stay 0 in this plan but the formula is implemented.
- Save format carries `saveVersion`; every load runs `migrate()`.
- Palette tokens (light): paper `#EDE7D4`, surface `#F7F2E4`, ink `#2A2620`, ledger green `#1F3B33`, stamp red `#A6402B`, soul teal `#3E9C93`, brass `#A8823C`.
- Fonts bundled locally via fontsource; never fetched from Google Fonts at runtime.
- Portrait only.
- Commit after every task with a conventional-commit message ending in `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Push to `origin main` after each commit.

---

## File map

| Path | Responsibility |
|---|---|
| `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `index.html`, `.gitignore` | Project scaffold |
| `src/main.tsx`, `src/ui/App.tsx` | React entry, tab shell |
| `src/engine/format.ts` | Number formatting (K/M/B… aa/ab…) |
| `src/engine/content.ts` | zod schemas + `Content` type + `loadContent()` |
| `src/data/departments/intake.json` | Intake department content |
| `src/engine/state.ts` | `GameState`, `createInitialState()`, `serialize()`, `deserialize()` |
| `src/engine/migrations.ts` | `migrate(raw)` chain |
| `src/engine/economy.ts` | cost, bulk cost, max affordable, milestone, rates, global multiplier |
| `src/engine/actions.ts` | `tick`, `click`, `buyStaff`, `buyUpgrade` |
| `src/engine/offline.ts` | `offlineCapSeconds`, `offlineRateFraction`, `applyOffline` |
| `src/engine/time.ts` | `Clock` interface (wall + monotonic) with real and fake implementations |
| `src/platform/storage.ts` | `Storage` interface, `localStorageStorage`, `capacitorStorage`, `pickStorage()` |
| `src/store/game.ts` | zustand store, tick loop, autosave, offline on resume |
| `src/ui/theme.css` | palette tokens, fonts, base styles, dark theme |
| `src/ui/components/*` | `CurrencyBar`, `StampButton`, `QueueCard`, `StaffRow`, `UpgradeRow`, `MemoTicker`, `TabBar`, `Modal` |
| `src/ui/characters/*` | SVG characters with mood prop |
| `src/ui/screens/OfficeScreen.tsx` | Office tab |
| `src/ui/screens/PlaceholderScreen.tsx` | Other four tabs (filled by later plans) |
| `src/ui/overlays/BacklogReport.tsx` | Offline earnings modal |
| `capacitor.config.ts`, `android/` | Android shell |

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `src/main.tsx`, `src/ui/App.tsx`, `src/test-setup.ts`, `src/vite-env.d.ts`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test` all working.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "afterlife-bureaucracy",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "cap:sync": "npm run build && cap sync android",
    "cap:open": "cap open android"
  },
  "dependencies": {
    "@capacitor/android": "^7.6.9",
    "@capacitor/app": "^7.1.2",
    "@capacitor/core": "^7.6.9",
    "@capacitor/preferences": "^7.0.4",
    "break_infinity.js": "^2.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zod": "^3.23.8",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@capacitor/cli": "^7.6.9",
    "@fontsource/ibm-plex-mono": "^5.1.0",
    "@fontsource/ibm-plex-sans": "^5.1.0",
    "@fontsource/special-elite": "^5.1.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^6.0.5",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create config files**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { port: 5175 } });
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'], passWithNoTests: true },
});
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020", "lib": ["ES2020", "DOM", "DOM.Iterable"], "module": "ESNext",
    "moduleResolution": "bundler", "jsx": "react-jsx", "strict": true, "noEmit": true,
    "skipLibCheck": true, "resolveJsonModule": true, "isolatedModules": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
    <title>Afterlife Bureaucracy Inc.</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`.gitignore`:
```
node_modules
dist
android/app/build
android/build
android/.gradle
android/local.properties
android/app/src/main/assets/public
android/app/src/main/assets/capacitor.config.json
android/app/src/main/assets/capacitor.plugins.json
*.keystore
```

`src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

- [ ] **Step 3: Create minimal entry and App**

`src/main.tsx`:
```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
```

`src/ui/App.tsx`:
```tsx
export function App() {
  return <h1>Afterlife Bureaucracy Inc.</h1>;
}
```

- [ ] **Step 4: Install and verify**

Run: `npm install && npm run build && npm test`
Expected: build succeeds; vitest reports no test files and exits 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript project"
git push origin main
```

---

### Task 2: Number formatting

**Files:**
- Create: `src/engine/format.ts`, `src/engine/format.test.ts`

**Interfaces:**
- Produces: `formatNumber(value: Decimal | number): string`

Rules from spec: plain integers with thousands separators below 1,000,000; from 1e6 use suffix with 3 significant digits (`1.23M`, `12.3M`, `123M`); suffix list by power-of-1000 index: `['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']`; beyond `Dc` (index 11) use two-letter suffixes `aa`, `ab`, … `az`, `ba`, … where index 12 = `aa`.

- [ ] **Step 1: Write failing tests**

`src/engine/format.test.ts`:
```ts
import Decimal from 'break_infinity.js';
import { formatNumber } from './format';

describe('formatNumber', () => {
  it('shows plain integers below one million', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(999999)).toBe('999,999');
    expect(formatNumber(12.7)).toBe('12');
  });
  it('uses suffixes with 3 significant digits from one million', () => {
    expect(formatNumber(1_000_000)).toBe('1.00M');
    expect(formatNumber(1_234_567)).toBe('1.23M');
    expect(formatNumber(12_345_678)).toBe('12.3M');
    expect(formatNumber(123_456_789)).toBe('123M');
    expect(formatNumber(new Decimal('2.5e9'))).toBe('2.50B');
    expect(formatNumber(new Decimal('1e12'))).toBe('1.00T');
    expect(formatNumber(new Decimal('1e33'))).toBe('1.00Dc');
  });
  it('switches to letter suffixes after Dc', () => {
    expect(formatNumber(new Decimal('1e36'))).toBe('1.00aa');
    expect(formatNumber(new Decimal('1e39'))).toBe('1.00ab');
    expect(formatNumber(new Decimal('1e111'))).toBe('1.00ba');
  });
  it('accepts Decimal below one million', () => {
    expect(formatNumber(new Decimal(4200))).toBe('4,200');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/format.test.ts`
Expected: FAIL, cannot find module './format'.

- [ ] **Step 3: Implement**

`src/engine/format.ts`:
```ts
import Decimal from 'break_infinity.js';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

function letterSuffix(index: number): string {
  // index 12 -> 'aa', 13 -> 'ab', ..., 37 -> 'az', 38 -> 'ba'
  const n = index - 12;
  const first = String.fromCharCode(97 + Math.floor(n / 26));
  const second = String.fromCharCode(97 + (n % 26));
  return first + second;
}

export function formatNumber(value: Decimal | number): string {
  const d = value instanceof Decimal ? value : new Decimal(value);
  if (d.lt(1_000_000)) {
    return Math.floor(d.toNumber()).toLocaleString('en-US');
  }
  const exponent = Math.floor(d.log10());
  const index = Math.floor(exponent / 3);
  const mantissa = d.div(Decimal.pow(10, index * 3)).toNumber();
  const suffix = index < SUFFIXES.length ? SUFFIXES[index] : letterSuffix(index);
  const digits = mantissa >= 100 ? 0 : mantissa >= 10 ? 1 : 2;
  return mantissa.toFixed(digits) + suffix;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engine/format.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/format.ts src/engine/format.test.ts
git commit -m "feat(engine): number formatting with idle suffixes"
git push origin main
```

---

### Task 3: Content schema and Intake department data

**Files:**
- Create: `src/engine/content.ts`, `src/engine/content.test.ts`, `src/data/departments/intake.json`, `src/data/index.ts`

**Interfaces:**
- Produces:
  ```ts
  type UpgradeEffect =
    | { type: 'click'; value: number }        // +value to staplerLevel per level
    | { type: 'deptMult'; value: number }     // department multiplier × (1+value) per level
    | { type: 'offlineCapHours'; value: number } // +value hours per level
    | { type: 'offlineRate'; value: number };  // +value fraction per level (0.5 base)
  interface StaffDef { id: string; name: string; role: string; flavor: string; baseCost: number; baseRate: number; character: string }
  interface UpgradeDef { id: string; name: string; desc: string; baseCost: number; costGrowth: number; maxLevel: number; effect: UpgradeEffect }
  interface DepartmentDef { id: string; name: string; unlockSouls: number; accent: string; staff: StaffDef[]; upgrades: UpgradeDef[]; queue: string[]; memos: string[] }
  interface Content { departments: DepartmentDef[] }
  function loadContent(raw: unknown[]): Content
  function findDepartment(content: Content, deptId: string): DepartmentDef
  function findStaff(content: Content, staffId: string): { dept: DepartmentDef; staff: StaffDef }
  function findUpgrade(content: Content, upgradeId: string): { dept: DepartmentDef; upgrade: UpgradeDef }
  ```
- `src/data/index.ts` exports `content: Content` built from the JSON files.

- [ ] **Step 1: Write failing tests**

`src/engine/content.test.ts`:
```ts
import { loadContent, findStaff, findUpgrade } from './content';
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
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/content.test.ts`
Expected: FAIL, cannot find module './content' (and the JSON).

- [ ] **Step 3: Create intake.json**

`src/data/departments/intake.json`:
```json
{
  "id": "intake",
  "name": "Intake",
  "unlockSouls": 0,
  "accent": "#1F3B33",
  "staff": [
    { "id": "dave", "name": "Dave", "role": "Reaper, Overtime", "flavor": "Processing stragglers past clock-out.", "baseCost": 15, "baseRate": 0.5, "character": "dave" },
    { "id": "seraphine", "name": "Seraphine", "role": "Angel, Temp", "flavor": "On loan from Cloud Nine Staffing.", "baseCost": 100, "baseRate": 2, "character": "seraphine" },
    { "id": "gary", "name": "Gary", "role": "Demon Intern", "flavor": "Unionized. Takes his breaks.", "baseCost": 1100, "baseRate": 8, "character": "gary" },
    { "id": "auditor", "name": "The Auditor (Bribed)", "role": "Looks the other way", "flavor": "For a fee. Always for a fee.", "baseCost": 12000, "baseRate": 47, "character": "auditor" }
  ],
  "upgrades": [
    { "id": "faster-stapler", "name": "Faster Stapler", "desc": "+1 soul per stamp", "baseCost": 50, "costGrowth": 4, "maxLevel": 10, "effect": { "type": "click", "value": 1 } },
    { "id": "ergonomic-chairs", "name": "Ergonomic Chairs, Dept.-wide", "desc": "Intake output +25%", "baseCost": 500, "costGrowth": 6, "maxLevel": 5, "effect": { "type": "deptMult", "value": 0.25 } },
    { "id": "night-shift", "name": "Night Shift Rota", "desc": "Offline cap +4 hours", "baseCost": 2500, "costGrowth": 8, "maxLevel": 3, "effect": { "type": "offlineCapHours", "value": 4 } },
    { "id": "outsourced-purgatory", "name": "Outsourced Call Center (Purgatory)", "desc": "Intake output +100%", "baseCost": 25000, "costGrowth": 10, "maxLevel": 3, "effect": { "type": "deptMult", "value": 1 } },
    { "id": "overtime-pay", "name": "Overtime Pay (Unpaid)", "desc": "Offline earnings +25% of online rate", "baseCost": 8000, "costGrowth": 5, "maxLevel": 2, "effect": { "type": "offlineRate", "value": 0.25 } }
  ],
  "queue": [
    "Karen H. — requests skip-the-line to Heaven, cites 'main character energy'",
    "Bartholomew Vance — wants reincarnation as a golden retriever, good-boy tier",
    "Mrs. Okafor — requests refund on last life, 'defective knees'",
    "Soul #88291 — form incomplete, missing box 7",
    "Trevor — insists he 'wasn't done', has receipts",
    "Anonymous — submitted form in crayon, mostly legible",
    "Dr. Lindqvist — disputes cause of death, cites peer review",
    "Soul #10442 — wants to speak to whoever is in charge of gravity",
    "Priya M. — requests Heaven but 'the quiet part'",
    "Big Tony — asks if Hell has a loyalty program",
    "Soul #77 — has been in queue since 1300s, very patient",
    "The Twins — one form, two souls, please advise",
    "Captain Reyes — requests reincarnation with 'same crew'",
    "Soul #55019 — attached 400 pages of supporting documents",
    "Grandma Liu — brought snacks for the staff, still needs stamping",
    "Unnamed — arrived without a form, without a name, without shoes",
    "Marcus D. — wants Limbo 'just to think for a bit'",
    "Soul #31337 — claims to be a glitch, requests admin access"
  ],
  "memos": [
    "MEMO: Reincarnation backlog down 12%. Mortal realm reporting spike in déjà vu.",
    "INCIDENT: Soul #4471 filed as both 'cat' and 'CEO.' Investigating.",
    "AUDIT FLAG: Someone stamped themselves into Heaven. HR has been notified.",
    "MEMO: Break room fridge is not a portal. Stop putting souls in it.",
    "REMINDER: Casual Friday does not apply to reapers. The scythe stays.",
    "MEMO: Union rep Gary reminds management that interns are entitled to two breaks per eternity.",
    "NOTICE: Cloud Nine Staffing invoices are now 40 days overdue. Seraphine remains chipper.",
    "MEMO: Stamp ink is a controlled substance. Sign the ledger.",
    "INCIDENT: Queue number 88291 has been called 6,000 times. No response.",
    "MEMO: Heaven is at 97% capacity. Please stamp slower. Or faster. Legal is unsure.",
    "REMINDER: Souls are not to be stapled together, even if they ask nicely.",
    "MEMO: The Auditor was seen accepting a fruit basket. This is fine.",
    "NOTICE: Overtime is mandatory and voluntary. Please see Dave for details.",
    "MEMO: Mortal realm reports 3% rise in people 'feeling watched'. Unrelated.",
    "INCIDENT: A soul reincarnated as a fax machine. Filing under 'lateral move'.",
    "MEMO: Quarterly targets have been raised. Quarters have been shortened.",
    "REMINDER: If a soul asks what happens next, the answer is 'processing'.",
    "MEMO: Lost & Found now holds 14 halos, 2 pitchforks, one entire sense of purpose."
  ]
}
```

- [ ] **Step 4: Implement content.ts and data index**

`src/engine/content.ts`:
```ts
import { z } from 'zod';

const upgradeEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), value: z.number().positive() }),
  z.object({ type: z.literal('deptMult'), value: z.number().positive() }),
  z.object({ type: z.literal('offlineCapHours'), value: z.number().positive() }),
  z.object({ type: z.literal('offlineRate'), value: z.number().positive() }),
]);

const staffSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string(),
  flavor: z.string(),
  baseCost: z.number().positive(),
  baseRate: z.number().positive(),
  character: z.string().min(1),
});

const upgradeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  desc: z.string(),
  baseCost: z.number().positive(),
  costGrowth: z.number().min(1),
  maxLevel: z.number().int().positive(),
  effect: upgradeEffectSchema,
});

const departmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  unlockSouls: z.number().nonnegative(),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  staff: z.array(staffSchema).min(1),
  upgrades: z.array(upgradeSchema),
  queue: z.array(z.string()).min(1),
  memos: z.array(z.string()).min(1),
});

export type UpgradeEffect = z.infer<typeof upgradeEffectSchema>;
export type StaffDef = z.infer<typeof staffSchema>;
export type UpgradeDef = z.infer<typeof upgradeSchema>;
export type DepartmentDef = z.infer<typeof departmentSchema>;
export interface Content { departments: DepartmentDef[] }

function assertUnique(ids: string[], label: string) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

export function loadContent(raw: unknown[]): Content {
  const departments = raw.map((r) => departmentSchema.parse(r));
  assertUnique(departments.map((d) => d.id), 'department');
  assertUnique(departments.flatMap((d) => d.staff.map((s) => s.id)), 'staff');
  assertUnique(departments.flatMap((d) => d.upgrades.map((u) => u.id)), 'upgrade');
  return { departments };
}

export function findDepartment(content: Content, deptId: string): DepartmentDef {
  const dept = content.departments.find((d) => d.id === deptId);
  if (!dept) throw new Error(`Unknown department: ${deptId}`);
  return dept;
}

export function findStaff(content: Content, staffId: string): { dept: DepartmentDef; staff: StaffDef } {
  for (const dept of content.departments) {
    const staff = dept.staff.find((s) => s.id === staffId);
    if (staff) return { dept, staff };
  }
  throw new Error(`Unknown staff: ${staffId}`);
}

export function findUpgrade(content: Content, upgradeId: string): { dept: DepartmentDef; upgrade: UpgradeDef } {
  for (const dept of content.departments) {
    const upgrade = dept.upgrades.find((u) => u.id === upgradeId);
    if (upgrade) return { dept, upgrade };
  }
  throw new Error(`Unknown upgrade: ${upgradeId}`);
}
```

`src/data/index.ts`:
```ts
import { loadContent } from '../engine/content';
import intake from './departments/intake.json';

export const content = loadContent([intake]);
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/engine/content.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/content.ts src/engine/content.test.ts src/data
git commit -m "feat(content): zod content schema and Intake department data"
git push origin main
```

---

### Task 4: Game state, serialization, migrations

**Files:**
- Create: `src/engine/state.ts`, `src/engine/migrations.ts`, `src/engine/state.test.ts`, `src/engine/fixtures/save-v1.json`

**Interfaces:**
- Produces:
  ```ts
  const SAVE_VERSION = 1;
  interface GameState {
    saveVersion: number;
    kc: Decimal;
    soulsRun: Decimal;
    soulsLifetime: Decimal;
    seals: number;
    vouchers: number;
    staff: Record<string, number>;      // staffId -> owned
    upgrades: Record<string, number>;   // upgradeId -> level
    deptsUnlocked: string[];
    activeDept: string;
    fiscalYear: number;
    boostUntil: number;                 // monotonic ms; 0 when no boost
    lastSeenWallClock: number;          // ms epoch
    uptimeAtSave: number;               // monotonic ms
    stats: { clicks: number; staffHired: number; upgradesBought: number; audits: number };
  }
  interface Now { wall: number; mono: number }
  function createInitialState(now: Now): GameState
  function serialize(state: GameState): string
  function deserialize(json: string): GameState   // runs migrate()
  ```
- `migrations.ts`: `SAVE_VERSION`, `migrate(raw: Record<string, unknown>): Record<string, unknown>` returning a raw object at `SAVE_VERSION`.

- [ ] **Step 1: Write failing tests**

`src/engine/state.test.ts`:
```ts
import Decimal from 'break_infinity.js';
import { createInitialState, serialize, deserialize, SAVE_VERSION } from './state';
import saveV1 from './fixtures/save-v1.json';

const now = { wall: 1_700_000_000_000, mono: 5_000 };

describe('state', () => {
  it('creates an initial state with intake unlocked', () => {
    const s = createInitialState(now);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.kc.eq(0)).toBe(true);
    expect(s.deptsUnlocked).toEqual(['intake']);
    expect(s.activeDept).toBe('intake');
    expect(s.lastSeenWallClock).toBe(now.wall);
    expect(s.uptimeAtSave).toBe(now.mono);
  });
  it('round-trips Decimal fields through serialize/deserialize', () => {
    const s = createInitialState(now);
    s.kc = new Decimal('1.5e40');
    s.soulsRun = new Decimal(123);
    s.staff.dave = 7;
    const back = deserialize(serialize(s));
    expect(back.kc.eq(new Decimal('1.5e40'))).toBe(true);
    expect(back.soulsRun.eq(123)).toBe(true);
    expect(back.staff.dave).toBe(7);
  });
  it('loads the v1 fixture', () => {
    const s = deserialize(JSON.stringify(saveV1));
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.kc.eq(new Decimal('2500'))).toBe(true);
  });
  it('rejects a save from the future', () => {
    const s = createInitialState(now);
    const raw = JSON.parse(serialize(s));
    raw.saveVersion = SAVE_VERSION + 1;
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/newer/i);
  });
  it('fills missing fields from a partial old save', () => {
    const raw = { saveVersion: 1, kc: '10', soulsRun: '10', soulsLifetime: '10' };
    const s = deserialize(JSON.stringify(raw));
    expect(s.staff).toEqual({});
    expect(s.deptsUnlocked).toEqual(['intake']);
    expect(s.stats.clicks).toBe(0);
  });
});
```

`src/engine/fixtures/save-v1.json`:
```json
{
  "saveVersion": 1,
  "kc": "2500",
  "soulsRun": "9000",
  "soulsLifetime": "9000",
  "seals": 0,
  "vouchers": 0,
  "staff": { "dave": 12, "seraphine": 3 },
  "upgrades": { "faster-stapler": 2 },
  "deptsUnlocked": ["intake"],
  "activeDept": "intake",
  "fiscalYear": 1,
  "boostUntil": 0,
  "lastSeenWallClock": 1700000000000,
  "uptimeAtSave": 90000,
  "stats": { "clicks": 240, "staffHired": 15, "upgradesBought": 2, "audits": 0 }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/state.test.ts`
Expected: FAIL, cannot find module './state'.

- [ ] **Step 3: Implement migrations.ts**

`src/engine/migrations.ts`:
```ts
export const SAVE_VERSION = 1;

type Raw = Record<string, unknown>;

// steps[v] upgrades a save from version v to v+1. Version 0 never shipped,
// so the array starts empty; the first real entry will be steps[1].
const steps: Array<(raw: Raw) => Raw> = [];

export function migrate(raw: Raw): Raw {
  const version = typeof raw.saveVersion === 'number' ? raw.saveVersion : 1;
  if (version > SAVE_VERSION) {
    throw new Error(`Save version ${version} is newer than supported ${SAVE_VERSION}`);
  }
  let out: Raw = { ...raw, saveVersion: version };
  for (let v = version; v < SAVE_VERSION; v++) {
    out = steps[v](out);
    out.saveVersion = v + 1;
  }
  return out;
}
```

- [ ] **Step 4: Implement state.ts**

`src/engine/state.ts`:
```ts
import Decimal from 'break_infinity.js';
import { migrate, SAVE_VERSION } from './migrations';

export { SAVE_VERSION };

export interface Stats { clicks: number; staffHired: number; upgradesBought: number; audits: number }

export interface GameState {
  saveVersion: number;
  kc: Decimal;
  soulsRun: Decimal;
  soulsLifetime: Decimal;
  seals: number;
  vouchers: number;
  staff: Record<string, number>;
  upgrades: Record<string, number>;
  deptsUnlocked: string[];
  activeDept: string;
  fiscalYear: number;
  boostUntil: number;
  lastSeenWallClock: number;
  uptimeAtSave: number;
  stats: Stats;
}

export interface Now { wall: number; mono: number }

export function createInitialState(now: Now): GameState {
  return {
    saveVersion: SAVE_VERSION,
    kc: new Decimal(0),
    soulsRun: new Decimal(0),
    soulsLifetime: new Decimal(0),
    seals: 0,
    vouchers: 0,
    staff: {},
    upgrades: {},
    deptsUnlocked: ['intake'],
    activeDept: 'intake',
    fiscalYear: 1,
    boostUntil: 0,
    lastSeenWallClock: now.wall,
    uptimeAtSave: now.mono,
    stats: { clicks: 0, staffHired: 0, upgradesBought: 0, audits: 0 },
  };
}

const DECIMAL_FIELDS = ['kc', 'soulsRun', 'soulsLifetime'] as const;

export function serialize(state: GameState): string {
  const raw: Record<string, unknown> = { ...state };
  for (const f of DECIMAL_FIELDS) raw[f] = state[f].toString();
  return JSON.stringify(raw);
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function deserialize(json: string): GameState {
  const raw = migrate(JSON.parse(json) as Record<string, unknown>);
  const base = createInitialState({ wall: 0, mono: 0 });
  const rawStats = (raw.stats ?? {}) as Record<string, unknown>;
  return {
    ...base,
    saveVersion: SAVE_VERSION,
    kc: new Decimal(String(raw.kc ?? '0')),
    soulsRun: new Decimal(String(raw.soulsRun ?? '0')),
    soulsLifetime: new Decimal(String(raw.soulsLifetime ?? '0')),
    seals: num(raw.seals, 0),
    vouchers: num(raw.vouchers, 0),
    staff: { ...((raw.staff as Record<string, number>) ?? {}) },
    upgrades: { ...((raw.upgrades as Record<string, number>) ?? {}) },
    deptsUnlocked: Array.isArray(raw.deptsUnlocked) && raw.deptsUnlocked.length ? [...(raw.deptsUnlocked as string[])] : ['intake'],
    activeDept: typeof raw.activeDept === 'string' ? raw.activeDept : 'intake',
    fiscalYear: num(raw.fiscalYear, 1),
    boostUntil: num(raw.boostUntil, 0),
    lastSeenWallClock: num(raw.lastSeenWallClock, 0),
    uptimeAtSave: num(raw.uptimeAtSave, 0),
    stats: {
      clicks: num(rawStats.clicks, 0),
      staffHired: num(rawStats.staffHired, 0),
      upgradesBought: num(rawStats.upgradesBought, 0),
      audits: num(rawStats.audits, 0),
    },
  };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/engine/state.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/state.ts src/engine/migrations.ts src/engine/state.test.ts src/engine/fixtures
git commit -m "feat(engine): GameState with versioned serialization and migrations"
git push origin main
```

---

### Task 5: Economy math

**Files:**
- Create: `src/engine/economy.ts`, `src/engine/economy.test.ts`

**Interfaces:**
- Consumes: `GameState` (Task 4), `Content`, `StaffDef`, `UpgradeDef`, `DepartmentDef` (Task 3).
- Produces:
  ```ts
  const COST_GROWTH = 1.15;
  function staffUnitCost(def: StaffDef, owned: number): Decimal            // baseCost × 1.15^owned
  function staffBulkCost(def: StaffDef, owned: number, count: number): Decimal
  function maxAffordable(def: StaffDef, owned: number, kc: Decimal): number
  function milestoneMult(owned: number): Decimal                          // 2^(milestones passed)
  function nextMilestone(owned: number): number
  function prevMilestone(owned: number): number                           // 0 before the first
  function upgradeCost(def: UpgradeDef, level: number): Decimal            // baseCost × costGrowth^level
  function upgradeLevel(state: GameState, upgradeId: string): number
  function staplerLevel(state: GameState, content: Content): number        // sum of click effects
  function deptMult(state: GameState, dept: DepartmentDef): Decimal        // Π (1 + value)^level over deptMult upgrades
  function globalMult(state: GameState, nowMono: number): Decimal          // (1 + 0.02 seals) × (boost ? 2 : 1)
  interface Rates { soulsPerSec: Decimal; kcPerSec: Decimal; clickPower: Decimal; byStaff: Record<string, Decimal> }
  function computeRates(state: GameState, content: Content, nowMono: number): Rates
  ```

- [ ] **Step 1: Write failing tests**

`src/engine/economy.test.ts`:
```ts
import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import { findStaff, findUpgrade } from './content';
import {
  staffUnitCost, staffBulkCost, maxAffordable, milestoneMult, nextMilestone, prevMilestone,
  upgradeCost, staplerLevel, deptMult, globalMult, computeRates,
} from './economy';

const now = { wall: 0, mono: 0 };
const dave = findStaff(content, 'dave').staff;

describe('staff cost', () => {
  it('grows by 1.15 per unit owned', () => {
    expect(staffUnitCost(dave, 0).toNumber()).toBeCloseTo(15);
    expect(staffUnitCost(dave, 1).toNumber()).toBeCloseTo(17.25);
    expect(staffUnitCost(dave, 10).toNumber()).toBeCloseTo(15 * 1.15 ** 10);
  });
  it('bulk cost equals the sum of unit costs', () => {
    const sum = [0, 1, 2, 3, 4].reduce((acc, i) => acc + staffUnitCost(dave, i).toNumber(), 0);
    expect(staffBulkCost(dave, 0, 5).toNumber()).toBeCloseTo(sum, 6);
  });
  it('maxAffordable matches bulk cost', () => {
    const kc = new Decimal(200);
    const n = maxAffordable(dave, 0, kc);
    expect(staffBulkCost(dave, 0, n).lte(kc)).toBe(true);
    expect(staffBulkCost(dave, 0, n + 1).gt(kc)).toBe(true);
    expect(maxAffordable(dave, 0, new Decimal(0))).toBe(0);
  });
});

describe('milestones', () => {
  it('doubles at 10, 25, 50, 100, 200 ... then every 100', () => {
    expect(milestoneMult(9).toNumber()).toBe(1);
    expect(milestoneMult(10).toNumber()).toBe(2);
    expect(milestoneMult(25).toNumber()).toBe(4);
    expect(milestoneMult(50).toNumber()).toBe(8);
    expect(milestoneMult(100).toNumber()).toBe(16);
    expect(milestoneMult(500).toNumber()).toBe(256);
    expect(milestoneMult(600).toNumber()).toBe(512);
    expect(milestoneMult(1000).toNumber()).toBe(2 ** 13);
  });
  it('reports next and previous milestones', () => {
    expect(nextMilestone(0)).toBe(10);
    expect(nextMilestone(10)).toBe(25);
    expect(nextMilestone(500)).toBe(600);
    expect(nextMilestone(650)).toBe(700);
    expect(prevMilestone(0)).toBe(0);
    expect(prevMilestone(10)).toBe(10);
    expect(prevMilestone(30)).toBe(25);
    expect(prevMilestone(650)).toBe(600);
  });
});

describe('upgrades and multipliers', () => {
  it('upgrade cost grows by costGrowth per level', () => {
    const u = findUpgrade(content, 'faster-stapler').upgrade;
    expect(upgradeCost(u, 0).toNumber()).toBe(50);
    expect(upgradeCost(u, 2).toNumber()).toBe(50 * 16);
  });
  it('stapler level sums click upgrades', () => {
    const s = createInitialState(now);
    expect(staplerLevel(s, content)).toBe(0);
    s.upgrades['faster-stapler'] = 3;
    expect(staplerLevel(s, content)).toBe(3);
  });
  it('department multiplier compounds deptMult upgrades', () => {
    const s = createInitialState(now);
    const intake = content.departments[0];
    expect(deptMult(s, intake).toNumber()).toBe(1);
    s.upgrades['ergonomic-chairs'] = 2;
    s.upgrades['outsourced-purgatory'] = 1;
    expect(deptMult(s, intake).toNumber()).toBeCloseTo(1.25 * 1.25 * 2);
  });
  it('global multiplier uses seals and boost', () => {
    const s = createInitialState(now);
    expect(globalMult(s, 0).toNumber()).toBe(1);
    s.seals = 10;
    expect(globalMult(s, 0).toNumber()).toBeCloseTo(1.2);
    s.boostUntil = 10_000;
    expect(globalMult(s, 5_000).toNumber()).toBeCloseTo(2.4);
    expect(globalMult(s, 10_000).toNumber()).toBeCloseTo(1.2);
  });
});

describe('computeRates', () => {
  it('is zero with no staff and click power 1', () => {
    const r = computeRates(createInitialState(now), content, 0);
    expect(r.soulsPerSec.toNumber()).toBe(0);
    expect(r.kcPerSec.toNumber()).toBe(0);
    expect(r.clickPower.toNumber()).toBe(1);
  });
  it('sums staff output with milestones, dept and global multipliers', () => {
    const s = createInitialState(now);
    s.staff.dave = 10;      // 0.5 × 10 × 2 (milestone) = 10
    s.staff.seraphine = 1;  // 2
    s.upgrades['ergonomic-chairs'] = 1; // ×1.25
    s.seals = 50;           // ×2
    const r = computeRates(s, content, 0);
    expect(r.soulsPerSec.toNumber()).toBeCloseTo(12 * 1.25 * 2);
    expect(r.kcPerSec.toNumber()).toBeCloseTo(12 * 1.25 * 2 * 0.4);
    expect(r.byStaff.dave.toNumber()).toBeCloseTo(10 * 1.25 * 2);
  });
  it('click power adds stapler level and 1% of passive', () => {
    const s = createInitialState(now);
    s.staff.dave = 200; // 0.5 × 200 × 32 = 3200/s
    s.upgrades['faster-stapler'] = 4;
    const r = computeRates(s, content, 0);
    expect(r.clickPower.toNumber()).toBeCloseTo(5 + 32);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/economy.test.ts`
Expected: FAIL, cannot find module './economy'.

- [ ] **Step 3: Implement**

`src/engine/economy.ts`:
```ts
import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content, DepartmentDef, StaffDef, UpgradeDef } from './content';

export const COST_GROWTH = 1.15;
const PASSIVE_KC_FRACTION = 0.4;
const CLICK_PASSIVE_FRACTION = 0.01;
const FIXED_MILESTONES = [10, 25, 50, 100, 200, 300, 400, 500];

export function staffUnitCost(def: StaffDef, owned: number): Decimal {
  return new Decimal(def.baseCost).mul(Decimal.pow(COST_GROWTH, owned));
}

export function staffBulkCost(def: StaffDef, owned: number, count: number): Decimal {
  if (count <= 0) return new Decimal(0);
  // geometric series: unit × (r^count − 1) / (r − 1)
  const first = staffUnitCost(def, owned);
  return first.mul(Decimal.pow(COST_GROWTH, count).sub(1)).div(COST_GROWTH - 1);
}

export function maxAffordable(def: StaffDef, owned: number, kc: Decimal): number {
  const first = staffUnitCost(def, owned);
  if (kc.lt(first)) return 0;
  // n = floor(log_r(kc × (r−1) / first + 1))
  const inner = kc.mul(COST_GROWTH - 1).div(first).add(1);
  let n = Math.floor(inner.log10() / Math.log10(COST_GROWTH));
  // guard against floating error on the boundary
  while (n > 0 && staffBulkCost(def, owned, n).gt(kc)) n--;
  while (staffBulkCost(def, owned, n + 1).lte(kc)) n++;
  return n;
}

function milestonesPassed(owned: number): number {
  let count = FIXED_MILESTONES.filter((m) => owned >= m).length;
  if (owned >= 600) count += Math.floor((owned - 500) / 100);
  return count;
}

export function milestoneMult(owned: number): Decimal {
  return Decimal.pow(2, milestonesPassed(owned));
}

export function nextMilestone(owned: number): number {
  for (const m of FIXED_MILESTONES) if (owned < m) return m;
  return (Math.floor(owned / 100) + 1) * 100;
}

export function prevMilestone(owned: number): number {
  if (owned >= 500) return Math.floor(owned / 100) * 100;
  let prev = 0;
  for (const m of FIXED_MILESTONES) if (owned >= m) prev = m;
  return prev;
}

export function upgradeCost(def: UpgradeDef, level: number): Decimal {
  return new Decimal(def.baseCost).mul(Decimal.pow(def.costGrowth, level));
}

export function upgradeLevel(state: GameState, upgradeId: string): number {
  return state.upgrades[upgradeId] ?? 0;
}

export function staplerLevel(state: GameState, content: Content): number {
  let level = 0;
  for (const dept of content.departments) {
    for (const u of dept.upgrades) {
      if (u.effect.type === 'click') level += u.effect.value * upgradeLevel(state, u.id);
    }
  }
  return level;
}

export function deptMult(state: GameState, dept: DepartmentDef): Decimal {
  let mult = new Decimal(1);
  for (const u of dept.upgrades) {
    if (u.effect.type === 'deptMult') {
      mult = mult.mul(Decimal.pow(1 + u.effect.value, upgradeLevel(state, u.id)));
    }
  }
  return mult;
}

export function globalMult(state: GameState, nowMono: number): Decimal {
  const sealBonus = 1 + 0.02 * state.seals;
  const boost = state.boostUntil > nowMono ? 2 : 1;
  return new Decimal(sealBonus).mul(boost);
}

export interface Rates {
  soulsPerSec: Decimal;
  kcPerSec: Decimal;
  clickPower: Decimal;
  byStaff: Record<string, Decimal>;
}

export function computeRates(state: GameState, content: Content, nowMono: number): Rates {
  const g = globalMult(state, nowMono);
  let souls = new Decimal(0);
  const byStaff: Record<string, Decimal> = {};
  for (const dept of content.departments) {
    const dm = deptMult(state, dept);
    for (const s of dept.staff) {
      const owned = state.staff[s.id] ?? 0;
      if (owned === 0) { byStaff[s.id] = new Decimal(0); continue; }
      const out = new Decimal(s.baseRate).mul(owned).mul(milestoneMult(owned)).mul(dm).mul(g);
      byStaff[s.id] = out;
      souls = souls.add(out);
    }
  }
  const clickPower = new Decimal(1 + staplerLevel(state, content)).add(souls.mul(CLICK_PASSIVE_FRACTION));
  return { soulsPerSec: souls, kcPerSec: souls.mul(PASSIVE_KC_FRACTION), clickPower, byStaff };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engine/economy.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/economy.ts src/engine/economy.test.ts
git commit -m "feat(engine): staff cost curves, milestones, multipliers and rates"
git push origin main
```

---

### Task 6: Engine actions (tick, click, buy)

**Files:**
- Create: `src/engine/actions.ts`, `src/engine/actions.test.ts`

**Interfaces:**
- Consumes: `computeRates`, `staffBulkCost`, `maxAffordable`, `upgradeCost`, `upgradeLevel` (Task 5); `findStaff`, `findUpgrade` (Task 3).
- Produces (all pure, return a new state, never mutate):
  ```ts
  type BuyMode = 1 | 10 | 'max';
  function tick(state: GameState, content: Content, dtSec: number, nowMono: number): GameState
  function click(state: GameState, content: Content, nowMono: number): GameState
  function buyStaff(state: GameState, content: Content, staffId: string, mode: BuyMode): GameState
  function buyUpgrade(state: GameState, content: Content, upgradeId: string): GameState
  function unlockDepartments(state: GameState, content: Content): GameState   // adds any dept whose unlockSouls ≤ soulsRun
  function addSouls(state: GameState, souls: Decimal, kc: Decimal): GameState  // shared helper
  ```

- [ ] **Step 1: Write failing tests**

`src/engine/actions.test.ts`:
```ts
import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import { loadContent, findStaff } from './content';
import intake from '../data/departments/intake.json';
import { tick, click, buyStaff, buyUpgrade, unlockDepartments } from './actions';
import { staffBulkCost } from './economy';

const now = { wall: 0, mono: 0 };

describe('click', () => {
  it('adds click power to souls and kc 1:1 and counts the click', () => {
    const s0 = createInitialState(now);
    const s1 = click(s0, content, 0);
    expect(s1.soulsRun.toNumber()).toBe(1);
    expect(s1.soulsLifetime.toNumber()).toBe(1);
    expect(s1.kc.toNumber()).toBe(1);
    expect(s1.stats.clicks).toBe(1);
    expect(s0.kc.toNumber()).toBe(0); // no mutation
  });
});

describe('tick', () => {
  it('adds passive income scaled by dt with kc at 0.4', () => {
    const s0 = { ...createInitialState(now), staff: { dave: 1 } }; // 0.5 souls/s
    const s1 = tick(s0, content, 2, 0);
    expect(s1.soulsRun.toNumber()).toBeCloseTo(1);
    expect(s1.kc.toNumber()).toBeCloseTo(0.4);
  });
  it('does nothing for non-positive dt', () => {
    const s0 = { ...createInitialState(now), staff: { dave: 1 } };
    expect(tick(s0, content, 0, 0).soulsRun.toNumber()).toBe(0);
    expect(tick(s0, content, -5, 0).soulsRun.toNumber()).toBe(0);
  });
});

describe('buyStaff', () => {
  const dave = findStaff(content, 'dave').staff;
  it('buys one when affordable and charges the unit cost', () => {
    const s0 = { ...createInitialState(now), kc: new Decimal(20) };
    const s1 = buyStaff(s0, content, 'dave', 1);
    expect(s1.staff.dave).toBe(1);
    expect(s1.kc.toNumber()).toBeCloseTo(5);
    expect(s1.stats.staffHired).toBe(1);
  });
  it('refuses when unaffordable', () => {
    const s0 = { ...createInitialState(now), kc: new Decimal(10) };
    const s1 = buyStaff(s0, content, 'dave', 1);
    expect(s1).toBe(s0);
  });
  it('buys 10 only if all 10 are affordable', () => {
    const cost10 = staffBulkCost(dave, 0, 10);
    const s0 = { ...createInitialState(now), kc: cost10 };
    expect(buyStaff(s0, content, 'dave', 10).staff.dave).toBe(10);
    const short = { ...s0, kc: cost10.sub(1) };
    expect(buyStaff(short, content, 'dave', 10)).toBe(short);
  });
  it('max buys as many as affordable', () => {
    const s0 = { ...createInitialState(now), kc: new Decimal(1000) };
    const s1 = buyStaff(s0, content, 'dave', 'max');
    expect(s1.staff.dave).toBeGreaterThan(10);
    expect(s1.kc.gte(0)).toBe(true);
    expect(staffBulkCost(dave, s1.staff.dave, 1).gt(s1.kc)).toBe(true);
  });
});

describe('buyUpgrade', () => {
  it('buys a level and charges the level cost', () => {
    const s0 = { ...createInitialState(now), kc: new Decimal(50) };
    const s1 = buyUpgrade(s0, content, 'faster-stapler');
    expect(s1.upgrades['faster-stapler']).toBe(1);
    expect(s1.kc.toNumber()).toBe(0);
    expect(s1.stats.upgradesBought).toBe(1);
  });
  it('refuses at max level', () => {
    const s0 = { ...createInitialState(now), kc: new Decimal('1e30'), upgrades: { 'faster-stapler': 10 } };
    expect(buyUpgrade(s0, content, 'faster-stapler')).toBe(s0);
  });
});

describe('unlockDepartments', () => {
  const two = loadContent([intake, { ...intake, id: 'heaven', name: 'Heaven Admissions', unlockSouls: 10000,
    staff: intake.staff.map((s) => ({ ...s, id: 'h-' + s.id })),
    upgrades: intake.upgrades.map((u) => ({ ...u, id: 'h-' + u.id })) }]);
  it('unlocks when souls this run reach the threshold', () => {
    const s0 = { ...createInitialState(now), soulsRun: new Decimal(9999) };
    expect(unlockDepartments(s0, two).deptsUnlocked).toEqual(['intake']);
    const s1 = unlockDepartments({ ...s0, soulsRun: new Decimal(10000) }, two);
    expect(s1.deptsUnlocked).toEqual(['intake', 'heaven']);
  });
  it('tick unlocks departments too', () => {
    const s0 = { ...createInitialState(now), staff: { dave: 1 }, soulsRun: new Decimal(9999.9) };
    expect(tick(s0, two, 1, 0).deptsUnlocked).toContain('heaven');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/actions.test.ts`
Expected: FAIL, cannot find module './actions'.

- [ ] **Step 3: Implement**

`src/engine/actions.ts`:
```ts
import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content } from './content';
import { findStaff, findUpgrade } from './content';
import { computeRates, staffBulkCost, maxAffordable, upgradeCost, upgradeLevel } from './economy';

export type BuyMode = 1 | 10 | 'max';

export function addSouls(state: GameState, souls: Decimal, kc: Decimal): GameState {
  return {
    ...state,
    soulsRun: state.soulsRun.add(souls),
    soulsLifetime: state.soulsLifetime.add(souls),
    kc: state.kc.add(kc),
  };
}

export function unlockDepartments(state: GameState, content: Content): GameState {
  const missing = content.departments
    .filter((d) => !state.deptsUnlocked.includes(d.id) && state.soulsRun.gte(d.unlockSouls))
    .map((d) => d.id);
  if (missing.length === 0) return state;
  return { ...state, deptsUnlocked: [...state.deptsUnlocked, ...missing] };
}

export function tick(state: GameState, content: Content, dtSec: number, nowMono: number): GameState {
  if (!(dtSec > 0)) return state;
  const rates = computeRates(state, content, nowMono);
  if (rates.soulsPerSec.eq(0)) return unlockDepartments(state, content);
  const next = addSouls(state, rates.soulsPerSec.mul(dtSec), rates.kcPerSec.mul(dtSec));
  return unlockDepartments(next, content);
}

export function click(state: GameState, content: Content, nowMono: number): GameState {
  const { clickPower } = computeRates(state, content, nowMono);
  const next = addSouls(state, clickPower, clickPower);
  return unlockDepartments({ ...next, stats: { ...next.stats, clicks: next.stats.clicks + 1 } }, content);
}

export function buyStaff(state: GameState, content: Content, staffId: string, mode: BuyMode): GameState {
  const { staff } = findStaff(content, staffId);
  const owned = state.staff[staffId] ?? 0;
  const count = mode === 'max' ? maxAffordable(staff, owned, state.kc) : mode;
  if (count <= 0) return state;
  const cost = staffBulkCost(staff, owned, count);
  if (cost.gt(state.kc)) return state;
  return {
    ...state,
    kc: state.kc.sub(cost),
    staff: { ...state.staff, [staffId]: owned + count },
    stats: { ...state.stats, staffHired: state.stats.staffHired + count },
  };
}

export function buyUpgrade(state: GameState, content: Content, upgradeId: string): GameState {
  const { upgrade } = findUpgrade(content, upgradeId);
  const level = upgradeLevel(state, upgradeId);
  if (level >= upgrade.maxLevel) return state;
  const cost = upgradeCost(upgrade, level);
  if (cost.gt(state.kc)) return state;
  return {
    ...state,
    kc: state.kc.sub(cost),
    upgrades: { ...state.upgrades, [upgradeId]: level + 1 },
    stats: { ...state.stats, upgradesBought: state.stats.upgradesBought + 1 },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engine/actions.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/actions.ts src/engine/actions.test.ts
git commit -m "feat(engine): tick, click, buyStaff, buyUpgrade, department unlock"
git push origin main
```

---

### Task 7: Offline earnings and clock

**Files:**
- Create: `src/engine/time.ts`, `src/engine/offline.ts`, `src/engine/offline.test.ts`

**Interfaces:**
- Consumes: `computeRates`, `upgradeLevel` (Task 5), `addSouls` (Task 6).
- Produces:
  ```ts
  // time.ts
  interface Clock { wall(): number; mono(): number }   // both ms
  const realClock: Clock                               // Date.now / performance.now
  function fakeClock(start?: { wall: number; mono: number }): Clock & { advance(ms: number): void; setWall(ms: number): void }
  // offline.ts
  const BASE_OFFLINE_CAP_HOURS = 4;
  const BASE_OFFLINE_RATE = 0.5;
  const MIN_OFFLINE_SECONDS = 60;
  function offlineCapSeconds(state: GameState, content: Content): number
  function offlineRateFraction(state: GameState, content: Content): number   // min(1, 0.5 + upgrades)
  interface OfflineResult { state: GameState; elapsedSec: number; creditedSec: number; souls: Decimal; kc: Decimal; capped: boolean }
  function applyOffline(state: GameState, content: Content, elapsedSec: number, nowMono: number): OfflineResult
  ```
  `applyOffline` credits `soulsPerSec × min(elapsed, cap) × rateFraction` and KC at 0.4 of that. Elapsed below `MIN_OFFLINE_SECONDS` credits nothing (`creditedSec` 0). Negative elapsed (clock moved backwards) credits nothing.

- [ ] **Step 1: Write failing tests**

`src/engine/offline.test.ts`:
```ts
import { createInitialState } from './state';
import { content } from '../data';
import { offlineCapSeconds, offlineRateFraction, applyOffline, MIN_OFFLINE_SECONDS } from './offline';
import { fakeClock } from './time';

const now = { wall: 0, mono: 0 };

describe('offline caps', () => {
  it('base cap is 4 hours and grows with night-shift upgrades', () => {
    const s = createInitialState(now);
    expect(offlineCapSeconds(s, content)).toBe(4 * 3600);
    s.upgrades['night-shift'] = 2;
    expect(offlineCapSeconds(s, content)).toBe(12 * 3600);
  });
  it('base rate is 50%, capped at 100%', () => {
    const s = createInitialState(now);
    expect(offlineRateFraction(s, content)).toBe(0.5);
    s.upgrades['overtime-pay'] = 2;
    expect(offlineRateFraction(s, content)).toBe(1);
  });
});

describe('applyOffline', () => {
  const base = () => ({ ...createInitialState(now), staff: { dave: 1 } }); // 0.5 souls/s
  it('credits half rate for elapsed time under the cap', () => {
    const r = applyOffline(base(), content, 600, 0);
    expect(r.creditedSec).toBe(600);
    expect(r.capped).toBe(false);
    expect(r.souls.toNumber()).toBeCloseTo(0.5 * 600 * 0.5);
    expect(r.kc.toNumber()).toBeCloseTo(0.5 * 600 * 0.5 * 0.4);
    expect(r.state.soulsRun.toNumber()).toBeCloseTo(150);
  });
  it('caps at the offline cap', () => {
    const r = applyOffline(base(), content, 10 * 3600, 0);
    expect(r.creditedSec).toBe(4 * 3600);
    expect(r.capped).toBe(true);
  });
  it('credits nothing under the minimum or for negative elapsed', () => {
    expect(applyOffline(base(), content, MIN_OFFLINE_SECONDS - 1, 0).creditedSec).toBe(0);
    expect(applyOffline(base(), content, -100, 0).creditedSec).toBe(0);
    expect(applyOffline(base(), content, -100, 0).souls.toNumber()).toBe(0);
  });
});

describe('fakeClock', () => {
  it('advances both clocks and allows wall-only changes', () => {
    const c = fakeClock({ wall: 1000, mono: 0 });
    c.advance(500);
    expect(c.wall()).toBe(1500);
    expect(c.mono()).toBe(500);
    c.setWall(100);
    expect(c.wall()).toBe(100);
    expect(c.mono()).toBe(500);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/offline.test.ts`
Expected: FAIL, cannot find module './offline'.

- [ ] **Step 3: Implement time.ts**

`src/engine/time.ts`:
```ts
export interface Clock { wall(): number; mono(): number }

export const realClock: Clock = {
  wall: () => Date.now(),
  mono: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
};

export function fakeClock(start = { wall: 0, mono: 0 }) {
  let wall = start.wall;
  let mono = start.mono;
  return {
    wall: () => wall,
    mono: () => mono,
    advance(ms: number) { wall += ms; mono += ms; },
    setWall(ms: number) { wall = ms; },
  };
}
```

- [ ] **Step 4: Implement offline.ts**

`src/engine/offline.ts`:
```ts
import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content } from './content';
import { computeRates, upgradeLevel } from './economy';
import { addSouls } from './actions';

export const BASE_OFFLINE_CAP_HOURS = 4;
export const BASE_OFFLINE_RATE = 0.5;
export const MIN_OFFLINE_SECONDS = 60;
const PASSIVE_KC_FRACTION = 0.4;

export function offlineCapSeconds(state: GameState, content: Content): number {
  let hours = BASE_OFFLINE_CAP_HOURS;
  for (const dept of content.departments) {
    for (const u of dept.upgrades) {
      if (u.effect.type === 'offlineCapHours') hours += u.effect.value * upgradeLevel(state, u.id);
    }
  }
  return hours * 3600;
}

export function offlineRateFraction(state: GameState, content: Content): number {
  let rate = BASE_OFFLINE_RATE;
  for (const dept of content.departments) {
    for (const u of dept.upgrades) {
      if (u.effect.type === 'offlineRate') rate += u.effect.value * upgradeLevel(state, u.id);
    }
  }
  return Math.min(1, rate);
}

export interface OfflineResult {
  state: GameState;
  elapsedSec: number;
  creditedSec: number;
  souls: Decimal;
  kc: Decimal;
  capped: boolean;
}

export function applyOffline(state: GameState, content: Content, elapsedSec: number, nowMono: number): OfflineResult {
  const zero = new Decimal(0);
  if (!(elapsedSec >= MIN_OFFLINE_SECONDS)) {
    return { state, elapsedSec, creditedSec: 0, souls: zero, kc: zero, capped: false };
  }
  const cap = offlineCapSeconds(state, content);
  const creditedSec = Math.min(elapsedSec, cap);
  const rates = computeRates(state, content, nowMono);
  const souls = rates.soulsPerSec.mul(creditedSec).mul(offlineRateFraction(state, content));
  const kc = souls.mul(PASSIVE_KC_FRACTION);
  return { state: addSouls(state, souls, kc), elapsedSec, creditedSec, souls, kc, capped: elapsedSec > cap };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/engine/offline.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/time.ts src/engine/offline.ts src/engine/offline.test.ts
git commit -m "feat(engine): offline earnings with cap and rate upgrades, clock abstraction"
git push origin main
```

---

### Task 8: Storage adapters and game store

**Files:**
- Create: `src/platform/storage.ts`, `src/store/game.ts`, `src/store/game.test.ts`
- Modify: `vitest.config.ts` (inline Capacitor deps if needed)

**Interfaces:**
- Consumes: everything from Tasks 3–7.
- Produces:
  ```ts
  // platform/storage.ts
  interface Storage { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> }
  const localStorageStorage: Storage
  const capacitorStorage: Storage
  function memoryStorage(): Storage                       // for tests
  function pickStorage(): Storage                         // Capacitor Preferences when native, else localStorage
  const SAVE_KEY = 'afterlife.save.v1';
  // store/game.ts
  interface PendingOffline { elapsedSec: number; creditedSec: number; souls: Decimal; kc: Decimal; capped: boolean }
  interface GameStore {
    state: GameState;
    rates: Rates;
    ready: boolean;
    pendingOffline: PendingOffline | null;
    queueLine: string;
    memoLine: string;
    boot(): Promise<void>;                 // load save or create, apply offline, start loop
    stamp(): void;
    hire(staffId: string, mode: BuyMode): void;
    upgrade(upgradeId: string): void;
    setActiveDept(deptId: string): void;
    dismissOffline(): void;
    doubleOffline(): void;                 // credits the pending amount a second time (ad reward hook)
    save(): Promise<void>;
    stopLoop(): void;
    rotateQueue(): void;
    rotateMemo(): void;
  }
  interface StoreDeps { content: Content; storage: Storage; clock: Clock; tickMs?: number; autosaveMs?: number }
  function createGameStore(deps: StoreDeps): UseBoundStore<StoreApi<GameStore>>
  const useGame: ReturnType<typeof createGameStore>   // default instance: real content, pickStorage(), realClock
  ```
  The loop uses `setInterval(tickMs)` (default 100) and computes `dt` from `clock.mono()` deltas, so a slow device still credits correct time. `boot()` compares `clock.wall()` with `state.lastSeenWallClock`; if the difference ≥ 60 s it applies offline and sets `pendingOffline`. Autosave every `autosaveMs` (default 10 000) writes `serialize(state)` with `lastSeenWallClock = clock.wall()` and `uptimeAtSave = clock.mono()`.

- [ ] **Step 1: Write failing tests**

`src/store/game.test.ts`:
```ts
import { createGameStore } from './game';
import { memoryStorage, SAVE_KEY } from '../platform/storage';
import { fakeClock } from '../engine/time';
import { content } from '../data';
import { createInitialState, serialize } from '../engine/state';

function make(opts: { saved?: string } = {}) {
  const storage = memoryStorage();
  if (opts.saved) void storage.set(SAVE_KEY, opts.saved);
  const clock = fakeClock({ wall: 1_000_000, mono: 0 });
  const store = createGameStore({ content, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000_000 });
  return { store, storage, clock };
}

describe('game store', () => {
  it('boots a fresh game when no save exists', async () => {
    const { store } = make();
    await store.getState().boot();
    expect(store.getState().ready).toBe(true);
    expect(store.getState().state.kc.toNumber()).toBe(0);
    expect(store.getState().pendingOffline).toBeNull();
    expect(store.getState().queueLine.length).toBeGreaterThan(0);
    store.getState().stopLoop();
  });

  it('stamp adds souls and updates rates snapshot', async () => {
    const { store } = make();
    await store.getState().boot();
    store.getState().stamp();
    expect(store.getState().state.soulsRun.toNumber()).toBe(1);
    expect(store.getState().rates.clickPower.toNumber()).toBe(1);
    store.getState().stopLoop();
  });

  it('hire and upgrade go through the engine', async () => {
    const { store } = make();
    await store.getState().boot();
    for (let i = 0; i < 20; i++) store.getState().stamp();
    store.getState().hire('dave', 1);
    expect(store.getState().state.staff.dave).toBe(1);
    expect(store.getState().rates.soulsPerSec.toNumber()).toBeCloseTo(0.5);
    store.getState().stopLoop();
  });

  it('applies offline earnings on boot when away long enough', async () => {
    const s = createInitialState({ wall: 1_000_000 - 3600_000, mono: 0 });
    s.staff = { dave: 1 };
    const { store } = make({ saved: serialize(s) });
    await store.getState().boot();
    const p = store.getState().pendingOffline!;
    expect(p).not.toBeNull();
    expect(p.creditedSec).toBe(3600);
    expect(p.souls.toNumber()).toBeCloseTo(0.5 * 3600 * 0.5);
    expect(store.getState().state.soulsRun.toNumber()).toBeCloseTo(900);
    store.getState().doubleOffline();
    expect(store.getState().state.soulsRun.toNumber()).toBeCloseTo(1800);
    expect(store.getState().pendingOffline).toBeNull();
    store.getState().stopLoop();
  });

  it('does not apply offline for short absences', async () => {
    const s = createInitialState({ wall: 1_000_000 - 30_000, mono: 0 });
    s.staff = { dave: 1 };
    const { store } = make({ saved: serialize(s) });
    await store.getState().boot();
    expect(store.getState().pendingOffline).toBeNull();
    store.getState().stopLoop();
  });

  it('save writes current clocks', async () => {
    const { store, storage, clock } = make();
    await store.getState().boot();
    clock.advance(5000);
    await store.getState().save();
    const raw = JSON.parse((await storage.get(SAVE_KEY))!);
    expect(raw.lastSeenWallClock).toBe(1_005_000);
    expect(raw.uptimeAtSave).toBe(5000);
    store.getState().stopLoop();
  });

  it('tick loop credits elapsed monotonic time', async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const clock = fakeClock({ wall: 1_000_000, mono: 0 });
    const store = createGameStore({ content, storage, clock, tickMs: 100, autosaveMs: 1_000_000 });
    await store.getState().boot();
    for (let i = 0; i < 20; i++) store.getState().stamp();
    store.getState().hire('dave', 1);
    clock.advance(100);
    vi.advanceTimersByTime(100);
    expect(store.getState().state.soulsRun.toNumber()).toBeCloseTo(20 + 0.05, 3);
    store.getState().stopLoop();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/store/game.test.ts`
Expected: FAIL, cannot find module './game'.

- [ ] **Step 3: Implement storage.ts**

`src/platform/storage.ts`:
```ts
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export const SAVE_KEY = 'afterlife.save.v1';

export interface Storage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export const localStorageStorage: Storage = {
  async get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  async set(key, value) { try { localStorage.setItem(key, value); } catch { /* quota or private mode */ } },
};

export const capacitorStorage: Storage = {
  async get(key) { return (await Preferences.get({ key })).value; },
  async set(key, value) { await Preferences.set({ key, value }); },
};

export function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    async get(key) { return map.get(key) ?? null; },
    async set(key, value) { map.set(key, value); },
  };
}

export function pickStorage(): Storage {
  return Capacitor.isNativePlatform() ? capacitorStorage : localStorageStorage;
}
```

- [ ] **Step 4: Implement store/game.ts**

`src/store/game.ts`:
```ts
import Decimal from 'break_infinity.js';
import { create } from 'zustand';
import type { Content } from '../engine/content';
import { findDepartment } from '../engine/content';
import { createInitialState, deserialize, serialize, type GameState } from '../engine/state';
import { computeRates, type Rates } from '../engine/economy';
import { tick, click, buyStaff, buyUpgrade, type BuyMode } from '../engine/actions';
import { applyOffline, MIN_OFFLINE_SECONDS } from '../engine/offline';
import { realClock, type Clock } from '../engine/time';
import { pickStorage, SAVE_KEY, type Storage } from '../platform/storage';
import { content as defaultContent } from '../data';

export interface PendingOffline {
  elapsedSec: number;
  creditedSec: number;
  souls: Decimal;
  kc: Decimal;
  capped: boolean;
}

export interface GameStore {
  state: GameState;
  rates: Rates;
  ready: boolean;
  pendingOffline: PendingOffline | null;
  queueLine: string;
  memoLine: string;
  boot(): Promise<void>;
  stamp(): void;
  hire(staffId: string, mode: BuyMode): void;
  upgrade(upgradeId: string): void;
  setActiveDept(deptId: string): void;
  dismissOffline(): void;
  doubleOffline(): void;
  save(): Promise<void>;
  stopLoop(): void;
  rotateQueue(): void;
  rotateMemo(): void;
}

export interface StoreDeps {
  content: Content;
  storage: Storage;
  clock: Clock;
  tickMs?: number;
  autosaveMs?: number;
}

function pick(lines: string[], avoid: string): string {
  if (lines.length === 1) return lines[0];
  let line = avoid;
  while (line === avoid) line = lines[Math.floor(Math.random() * lines.length)];
  return line;
}

export function createGameStore(deps: StoreDeps) {
  const { content, storage, clock } = deps;
  const tickMs = deps.tickMs ?? 100;
  const autosaveMs = deps.autosaveMs ?? 10_000;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let saveTimer: ReturnType<typeof setInterval> | null = null;
  let lastMono = 0;

  return create<GameStore>((set, get) => {
    const apply = (next: GameState) => {
      set({ state: next, rates: computeRates(next, content, clock.mono()) });
    };
    const withClocks = (s: GameState): GameState => ({ ...s, lastSeenWallClock: clock.wall(), uptimeAtSave: clock.mono() });

    return {
      state: createInitialState({ wall: clock.wall(), mono: clock.mono() }),
      rates: computeRates(createInitialState({ wall: 0, mono: 0 }), content, 0),
      ready: false,
      pendingOffline: null,
      queueLine: '',
      memoLine: '',

      async boot() {
        const saved = await storage.get(SAVE_KEY);
        let state: GameState;
        let pendingOffline: PendingOffline | null = null;
        if (saved) {
          try {
            state = deserialize(saved);
          } catch {
            state = createInitialState({ wall: clock.wall(), mono: clock.mono() });
          }
          const elapsedSec = (clock.wall() - state.lastSeenWallClock) / 1000;
          if (elapsedSec >= MIN_OFFLINE_SECONDS) {
            const r = applyOffline(state, content, elapsedSec, clock.mono());
            state = r.state;
            if (r.creditedSec > 0) {
              pendingOffline = { elapsedSec: r.elapsedSec, creditedSec: r.creditedSec, souls: r.souls, kc: r.kc, capped: r.capped };
            }
          }
        } else {
          state = createInitialState({ wall: clock.wall(), mono: clock.mono() });
        }
        const dept = findDepartment(content, state.activeDept);
        set({
          state,
          rates: computeRates(state, content, clock.mono()),
          ready: true,
          pendingOffline,
          queueLine: pick(dept.queue, ''),
          memoLine: pick(dept.memos, ''),
        });
        lastMono = clock.mono();
        get().stopLoop();
        tickTimer = setInterval(() => {
          const now = clock.mono();
          const dt = (now - lastMono) / 1000;
          lastMono = now;
          apply(tick(get().state, content, dt, now));
        }, tickMs);
        saveTimer = setInterval(() => { void get().save(); }, autosaveMs);
      },

      stamp() { apply(click(get().state, content, clock.mono())); },
      hire(staffId, mode) { apply(buyStaff(get().state, content, staffId, mode)); },
      upgrade(upgradeId) { apply(buyUpgrade(get().state, content, upgradeId)); },
      setActiveDept(deptId) {
        const s = get().state;
        if (!s.deptsUnlocked.includes(deptId)) return;
        const dept = findDepartment(content, deptId);
        set({ state: { ...s, activeDept: deptId }, queueLine: pick(dept.queue, ''), memoLine: pick(dept.memos, '') });
      },
      dismissOffline() { set({ pendingOffline: null }); },
      doubleOffline() {
        const p = get().pendingOffline;
        if (!p) return;
        const s = get().state;
        apply({ ...s, soulsRun: s.soulsRun.add(p.souls), soulsLifetime: s.soulsLifetime.add(p.souls), kc: s.kc.add(p.kc) });
        set({ pendingOffline: null });
      },
      async save() {
        const s = withClocks(get().state);
        set({ state: s });
        await storage.set(SAVE_KEY, serialize(s));
      },
      stopLoop() {
        if (tickTimer) clearInterval(tickTimer);
        if (saveTimer) clearInterval(saveTimer);
        tickTimer = null;
        saveTimer = null;
      },
      rotateQueue() {
        const dept = findDepartment(content, get().state.activeDept);
        set({ queueLine: pick(dept.queue, get().queueLine) });
      },
      rotateMemo() {
        const dept = findDepartment(content, get().state.activeDept);
        set({ memoLine: pick(dept.memos, get().memoLine) });
      },
    };
  });
}

export const useGame = createGameStore({ content: defaultContent, storage: pickStorage(), clock: realClock });
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/store/game.test.ts`
Expected: PASS (7 tests). If the Capacitor import fails under jsdom, add to `vitest.config.ts` under `test`: `server: { deps: { inline: ['@capacitor/core', '@capacitor/preferences'] } }`.

- [ ] **Step 6: Commit**

```bash
git add src/platform/storage.ts src/store/game.ts src/store/game.test.ts vitest.config.ts
git commit -m "feat(store): zustand game store with tick loop, autosave and offline on boot"
git push origin main
```

---

### Task 9: Theme, fonts and app shell with tab bar

**Files:**
- Create: `src/ui/theme.css`, `src/ui/components/TabBar.tsx`, `src/ui/screens/PlaceholderScreen.tsx`, `src/ui/App.test.tsx`
- Modify: `src/main.tsx`, `src/ui/App.tsx`, `vitest.config.ts` (`css: false` if fontsource imports break jsdom)

**Interfaces:**
- Produces: `TabId = 'office' | 'personnel' | 'ledger' | 'tasks' | 'store'`; `<TabBar active onChange />`; `<App />` renders the active screen and calls `useGame().boot()` once. CSS custom properties: `--paper --surface --surface-2 --ink --ink-muted --line --green --red --teal --brass --violet --font-display --font-body --font-mono --tabbar-h`.

- [ ] **Step 1: Write failing test**

`src/ui/App.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from './App';

describe('App shell', () => {
  it('renders five tabs and switches screens', async () => {
    render(<App />);
    expect(await screen.findByRole('tab', { name: /office/i })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    fireEvent.click(screen.getByRole('tab', { name: /ledger/i }));
    expect(await screen.findByRole('heading', { name: /^ledger$/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/App.test.tsx`
Expected: FAIL, no tab roles found.

- [ ] **Step 3: Create theme.css**

`src/ui/theme.css`:
```css
@import '@fontsource/special-elite/400.css';
@import '@fontsource/ibm-plex-sans/400.css';
@import '@fontsource/ibm-plex-sans/600.css';
@import '@fontsource/ibm-plex-mono/500.css';

:root {
  --paper: #EDE7D4;
  --surface: #F7F2E4;
  --surface-2: #E4DCC6;
  --ink: #2A2620;
  --ink-muted: #6E675C;
  --line: #C9BFA6;
  --green: #1F3B33;
  --red: #A6402B;
  --teal: #3E9C93;
  --brass: #A8823C;
  --violet: #6B6478;
  --font-display: 'Special Elite', 'Courier New', monospace;
  --font-body: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --radius: 10px;
  --shadow: 0 1px 0 rgba(42, 38, 32, 0.12), 0 2px 6px rgba(42, 38, 32, 0.08);
  --tabbar-h: 64px;
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --paper: #1B1915;
    --surface: #26221D;
    --surface-2: #322D26;
    --ink: #EDE7D4;
    --ink-muted: #A8A091;
    --line: #4A4238;
    --green: #4E8C7A;
    --red: #D9634A;
    --teal: #5FC4BA;
    --brass: #D4A950;
    --violet: #9A92AC;
    color-scheme: dark;
  }
}

* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 15px;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
  user-select: none;
}
h1, h2, h3 { font-family: var(--font-display); font-weight: 400; margin: 0; letter-spacing: 0.02em; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
button { font: inherit; color: inherit; border: 0; background: none; padding: 0; cursor: pointer; }
button:disabled { opacity: 0.45; cursor: default; }

.app { height: 100%; display: flex; flex-direction: column; }
.screen { flex: 1; overflow-y: auto; padding: 12px 16px calc(var(--tabbar-h) + 40px); }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 12px; }
.btn { border: 1.5px solid var(--ink); border-radius: 8px; padding: 8px 12px; font-weight: 600; background: var(--surface); }
.btn-primary { background: var(--red); border-color: var(--red); color: #fff; }
.btn-ghost { border-color: var(--line); color: var(--ink-muted); }

.tabbar {
  position: fixed; left: 0; right: 0; bottom: 0; height: var(--tabbar-h);
  display: grid; grid-template-columns: repeat(5, 1fr);
  background: var(--surface); border-top: 1px solid var(--line);
  padding-bottom: env(safe-area-inset-bottom);
}
.tabbar button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 11px; color: var(--ink-muted); }
.tabbar button[aria-selected='true'] { color: var(--green); font-weight: 600; }
.tabbar svg { width: 22px; height: 22px; }
```

- [ ] **Step 4: Create TabBar, PlaceholderScreen, App**

`src/ui/components/TabBar.tsx`:
```tsx
import type { ReactElement } from 'react';

export type TabId = 'office' | 'personnel' | 'ledger' | 'tasks' | 'store';

const TABS: Array<{ id: TabId; label: string; icon: ReactElement }> = [
  { id: 'office', label: 'Office', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V4h8v3" /></svg> },
  { id: 'personnel', label: 'Personnel', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg> },
  { id: 'ledger', label: 'Ledger', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3h14v18H5z" /><path d="M9 8h6M9 12h6M9 16h4" /></svg> },
  { id: 'tasks', label: 'Tasks', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6l2 2 4-4M4 12l2 2 4-4M4 18l2 2 4-4M13 6h7M13 12h7M13 18h7" /></svg> },
  { id: 'store', label: 'Store', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l1-5h16l1 5M3 9h18v11H3z" /><path d="M9 20v-6h6v6" /></svg> },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <nav className="tabbar" role="tablist" aria-label="Main">
      {TABS.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} aria-label={t.label} onClick={() => onChange(t.id)}>
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

`src/ui/screens/PlaceholderScreen.tsx`:
```tsx
export function PlaceholderScreen({ title, note }: { title: string; note: string }) {
  return (
    <section className="screen">
      <h2>{title}</h2>
      <p style={{ color: 'var(--ink-muted)' }}>{note}</p>
    </section>
  );
}
```

`src/ui/App.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useGame } from '../store/game';
import { TabBar, type TabId } from './components/TabBar';
import { PlaceholderScreen } from './screens/PlaceholderScreen';

export function App() {
  const [tab, setTab] = useState<TabId>('office');
  const boot = useGame((s) => s.boot);
  const ready = useGame((s) => s.ready);
  useEffect(() => { void boot(); }, [boot]);

  return (
    <div className="app">
      {!ready && <section className="screen"><h2>Opening the office…</h2></section>}
      {ready && tab === 'office' && <PlaceholderScreen title="Office" note="Intake desk coming in the next task." />}
      {ready && tab === 'personnel' && <PlaceholderScreen title="Personnel" note="Requisition Lottery opens in a later update." />}
      {ready && tab === 'ledger' && <PlaceholderScreen title="Ledger" note="Fiscal Year Audits open in a later update." />}
      {ready && tab === 'tasks' && <PlaceholderScreen title="Tasks" note="Daily tasks and achievements open in a later update." />}
      {ready && tab === 'store' && <PlaceholderScreen title="Store" note="Requisition Vouchers store opens in a later update." />}
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
```

`src/main.tsx` (add the CSS import as the first line):
```tsx
import './ui/theme.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/ui/App.test.tsx`
Expected: PASS. If fontsource CSS imports break jsdom, add `css: false` under `test` in `vitest.config.ts`.

- [ ] **Step 6: Visual check in browser**

Run: `npm run dev` and open the printed URL. Expect the parchment background, five tabs, tab switching. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/ui src/main.tsx vitest.config.ts
git commit -m "feat(ui): theme tokens, bundled fonts, tab bar shell"
git push origin main
```

---

### Task 10: SVG characters with moods

**Files:**
- Create: `src/ui/characters/Character.tsx`, `src/ui/characters/Character.test.tsx`

**Interfaces:**
- Produces: `type Mood = 'ok' | 'cooked'`; `<Character id mood size />` renders an inline SVG, 64×64 viewBox, with `data-character` and `data-mood` attributes. Known ids: `dave`, `seraphine`, `gary`, `auditor`. Unknown ids render a generic soul silhouette with `data-character="soul"`. Colours: reapers ledger green, angels soul teal, demons stamp red, auditor brass, souls parchment.

Style rules: bold `var(--ink)` outline 2.5, one or two flat fills, dot eyes, single-line mouth. Mood `cooked`: eyes become `x` marks and the mouth droops. The face group carries `data-face="ok" | "cooked"`.

- [ ] **Step 1: Write failing test**

`src/ui/characters/Character.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { Character } from './Character';

describe('Character', () => {
  it('renders each known character with a mood attribute', () => {
    for (const id of ['dave', 'seraphine', 'gary', 'auditor'] as const) {
      const { container, unmount } = render(<Character id={id} mood="ok" />);
      const svg = container.querySelector('svg')!;
      expect(svg).toBeInTheDocument();
      expect(svg.getAttribute('data-mood')).toBe('ok');
      expect(svg.getAttribute('data-character')).toBe(id);
      unmount();
    }
  });
  it('changes face group when cooked', () => {
    const ok = render(<Character id="dave" mood="ok" />).container.querySelector('[data-face]')!.getAttribute('data-face');
    const cooked = render(<Character id="dave" mood="cooked" />).container.querySelector('[data-face]')!.getAttribute('data-face');
    expect(ok).toBe('ok');
    expect(cooked).toBe('cooked');
  });
  it('falls back to a soul silhouette for unknown ids', () => {
    const { container } = render(<Character id="whoever" mood="ok" />);
    expect(container.querySelector('svg')!.getAttribute('data-character')).toBe('soul');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/characters/Character.test.tsx`
Expected: FAIL, cannot find module './Character'.

- [ ] **Step 3: Implement**

`src/ui/characters/Character.tsx`:
```tsx
import type { ReactElement } from 'react';

export type Mood = 'ok' | 'cooked';

const OUTLINE = 'var(--ink)';
const SW = 2.5;

function Face({ mood, cx, cy }: { mood: Mood; cx: number; cy: number }) {
  if (mood === 'ok') {
    return (
      <g data-face="ok" stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" fill={OUTLINE}>
        <circle cx={cx - 5} cy={cy} r={1.6} />
        <circle cx={cx + 5} cy={cy} r={1.6} />
        <path d={`M ${cx - 4} ${cy + 7} Q ${cx} ${cy + 10} ${cx + 4} ${cy + 7}`} fill="none" />
      </g>
    );
  }
  return (
    <g data-face="cooked" stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" fill="none">
      <path d={`M ${cx - 7} ${cy - 2} l 4 4 M ${cx - 3} ${cy - 2} l -4 4`} />
      <path d={`M ${cx + 3} ${cy - 2} l 4 4 M ${cx + 7} ${cy - 2} l -4 4`} />
      <path d={`M ${cx - 4} ${cy + 9} Q ${cx} ${cy + 6} ${cx + 4} ${cy + 9}`} />
    </g>
  );
}

function Dave({ mood }: { mood: Mood }) {
  // Reaper in a hood, holding a scythe like a mop.
  return (
    <>
      <path d="M32 6 C18 6 14 20 14 30 L14 50 L50 50 L50 30 C50 20 46 6 32 6 Z" fill="var(--green)" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="27" r="11" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M50 12 L54 8 M50 12 L50 52" stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" />
      <path d="M50 12 C58 10 60 18 54 20" fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} />
      <rect x="24" y="44" width="16" height="6" rx="1" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <Face mood={mood} cx={32} cy={26} />
    </>
  );
}

function Seraphine({ mood }: { mood: Mood }) {
  // Angel temp with a lanyard and a slightly tilted halo.
  return (
    <>
      <ellipse cx="32" cy="9" rx="10" ry="3" fill="none" stroke="var(--brass)" strokeWidth={SW} transform={mood === 'cooked' ? 'rotate(-12 32 9)' : undefined} />
      <path d="M14 34 C6 30 6 20 14 20 L14 34 Z M50 34 C58 30 58 20 50 20 L50 34 Z" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M20 52 L20 34 C20 26 44 26 44 34 L44 52 Z" fill="var(--teal)" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="22" r="10" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M28 34 L32 44 L36 34" fill="none" stroke={OUTLINE} strokeWidth={SW} />
      <rect x="29" y="42" width="6" height="7" rx="1" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <Face mood={mood} cx={32} cy={21} />
    </>
  );
}

function Gary({ mood }: { mood: Mood }) {
  // Demon intern: horns, tie, coffee cup.
  return (
    <>
      <path d="M22 16 L18 6 L27 13 Z M42 16 L46 6 L37 13 Z" fill="var(--red)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M18 52 L18 36 C18 28 46 28 46 36 L46 52 Z" fill="var(--red)" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="23" r="11" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M32 34 L29 40 L32 46 L35 40 Z" fill="var(--brass)" stroke={OUTLINE} strokeWidth={SW} />
      <rect x="46" y="38" width="8" height="9" rx="1.5" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M54 40 C58 40 58 45 54 45" fill="none" stroke={OUTLINE} strokeWidth={SW} />
      <Face mood={mood} cx={32} cy={22} />
    </>
  );
}

function Auditor({ mood }: { mood: Mood }) {
  // Suit, dark glasses, briefcase with a suspicious bulge.
  return (
    <>
      <path d="M16 52 L16 36 C16 28 48 28 48 36 L48 52 Z" fill="var(--brass)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M26 30 L32 40 L38 30" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <circle cx="32" cy="20" r="11" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} />
      <rect x="23" y="17" width="8" height="5" rx="1" fill={OUTLINE} />
      <rect x="33" y="17" width="8" height="5" rx="1" fill={OUTLINE} />
      <rect x="44" y="40" width="14" height="10" rx="2" fill="var(--surface-2)" stroke={OUTLINE} strokeWidth={SW} />
      <path d="M48 40 L48 37 L54 37 L54 40" fill="none" stroke={OUTLINE} strokeWidth={SW} />
      <g stroke={OUTLINE} strokeWidth={SW} strokeLinecap="round" fill="none" data-face={mood}>
        {mood === 'ok'
          ? <path d="M29 28 L35 28" />
          : <path d="M28 29 Q32 26 36 29" />}
      </g>
    </>
  );
}

function Soul({ mood }: { mood: Mood }) {
  return (
    <>
      <path d="M32 8 C18 8 16 24 16 34 L16 54 L22 50 L28 54 L34 50 L40 54 L46 50 L48 54 L48 34 C48 24 46 8 32 8 Z" fill="var(--surface)" stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
      <Face mood={mood} cx={32} cy={26} />
    </>
  );
}

const REGISTRY: Record<string, (p: { mood: Mood }) => ReactElement> = {
  dave: Dave, seraphine: Seraphine, gary: Gary, auditor: Auditor,
};

export function Character({ id, mood, size = 56 }: { id: string; mood: Mood; size?: number }) {
  const Body = REGISTRY[id] ?? Soul;
  const resolved = REGISTRY[id] ? id : 'soul';
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} data-character={resolved} data-mood={mood} aria-hidden="true">
      <Body mood={mood} />
    </svg>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/ui/characters/Character.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/characters
git commit -m "feat(ui): ink-stamp SVG characters with ok/cooked moods"
git push origin main
```

---

### Task 11: Office screen

**Files:**
- Create: `src/ui/hooks/useLerpNumber.ts`, `src/ui/components/CurrencyBar.tsx`, `src/ui/components/StampButton.tsx`, `src/ui/components/QueueCard.tsx`, `src/ui/components/StaffRow.tsx`, `src/ui/components/UpgradeRow.tsx`, `src/ui/components/MemoTicker.tsx`, `src/ui/screens/OfficeScreen.tsx`, `src/ui/screens/OfficeScreen.test.tsx`
- Modify: `src/ui/App.tsx` (replace the office placeholder), `src/ui/theme.css` (append component styles), `src/test-setup.ts` (requestAnimationFrame polyfill)

**Interfaces:**
- Consumes: `useGame` (Task 8), `formatNumber` (Task 2), `Character` (Task 10), `staffBulkCost`, `maxAffordable`, `nextMilestone`, `prevMilestone`, `upgradeCost` (Task 5), `findDepartment` (Task 3), `BuyMode` (Task 6).
- Produces: `<OfficeScreen />`.

- [ ] **Step 1: Write failing test**

`src/ui/screens/OfficeScreen.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { OfficeScreen } from './OfficeScreen';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(kc: number) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }), kc: new Decimal(kc) };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, queueLine: content.departments[0].queue[0], memoLine: content.departments[0].memos[0] });
}

describe('OfficeScreen', () => {
  it('stamps a soul', () => {
    seed(0);
    render(<OfficeScreen />);
    fireEvent.pointerDown(screen.getByRole('button', { name: /stamp soul/i }));
    expect(useGame.getState().state.soulsRun.toNumber()).toBe(1);
  });
  it('hires Dave when affordable and disables when not', () => {
    seed(20);
    render(<OfficeScreen />);
    const hire = screen.getByRole('button', { name: /hire dave/i });
    expect(hire).toBeEnabled();
    fireEvent.click(hire);
    expect(useGame.getState().state.staff.dave).toBe(1);
    expect(screen.getByRole('button', { name: /hire dave/i })).toBeDisabled();
  });
  it('switches buy mode', () => {
    seed(100000);
    render(<OfficeScreen />);
    fireEvent.click(screen.getByRole('button', { name: '×10' }));
    fireEvent.click(screen.getByRole('button', { name: /hire dave/i }));
    expect(useGame.getState().state.staff.dave).toBe(10);
  });
  it('buys an upgrade', () => {
    seed(50);
    render(<OfficeScreen />);
    fireEvent.click(screen.getByRole('button', { name: /faster stapler/i }));
    expect(useGame.getState().state.upgrades['faster-stapler']).toBe(1);
  });
  it('shows queue line and memo', () => {
    seed(0);
    render(<OfficeScreen />);
    expect(screen.getByText(content.departments[0].queue[0])).toBeInTheDocument();
    expect(screen.getByText(content.departments[0].memos[0])).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/screens/OfficeScreen.test.tsx`
Expected: FAIL, cannot find module './OfficeScreen'.

- [ ] **Step 3: Implement the lerp hook and components**

`src/ui/hooks/useLerpNumber.ts`:
```ts
import Decimal from 'break_infinity.js';
import { useEffect, useRef, useState } from 'react';

// Eases the displayed value toward the true value each frame so counters roll instead of jump.
export function useLerpNumber(target: Decimal, speed = 0.25): Decimal {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const cur = shownRef.current;
      const tgt = targetRef.current;
      const diff = tgt.sub(cur);
      const next = diff.abs().lt(1) || tgt.lt(cur) ? tgt : cur.add(diff.mul(speed));
      if (!next.eq(cur)) { shownRef.current = next; setShown(next); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed]);
  return shown;
}
```

`src/ui/components/CurrencyBar.tsx`:
```tsx
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { useLerpNumber } from '../hooks/useLerpNumber';

export function CurrencyBar() {
  const kc = useGame((s) => s.state.kc);
  const souls = useGame((s) => s.state.soulsLifetime);
  const rate = useGame((s) => s.rates.soulsPerSec);
  const year = useGame((s) => s.state.fiscalYear);
  const kcShown = useLerpNumber(kc);
  const soulsShown = useLerpNumber(souls);
  return (
    <header className="currency-bar card">
      <div>
        <div className="label">Karma Credits</div>
        <div className="mono value brass">{formatNumber(kcShown)}</div>
      </div>
      <div>
        <div className="label">Souls Processed</div>
        <div className="mono value">{formatNumber(soulsShown)}</div>
        <div className="mono sub">{formatNumber(rate)}/s · FY {year}</div>
      </div>
    </header>
  );
}
```

`src/ui/components/StampButton.tsx`:
```tsx
import { useState } from 'react';
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';

interface Float { id: number; x: number; text: string }

export function StampButton() {
  const stamp = useGame((s) => s.stamp);
  const rotateQueue = useGame((s) => s.rotateQueue);
  const clickPower = useGame((s) => s.rates.clickPower);
  const [floats, setFloats] = useState<Float[]>([]);
  const [pressed, setPressed] = useState(false);

  const onStamp = () => {
    stamp();
    rotateQueue();
    setPressed(true);
    setTimeout(() => setPressed(false), 90);
    const f = { id: Date.now() + Math.random(), x: 30 + Math.random() * 40, text: '+' + formatNumber(clickPower) };
    setFloats((cur) => [...cur.slice(-6), f]);
    setTimeout(() => setFloats((cur) => cur.filter((x) => x.id !== f.id)), 700);
  };

  return (
    <div className="stamp-wrap">
      {floats.map((f) => <span key={f.id} className="float mono" style={{ left: f.x + '%' }}>{f.text}</span>)}
      <button className={'stamp' + (pressed ? ' pressed' : '')} onPointerDown={onStamp} aria-label="Stamp soul">
        <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
          <circle cx="60" cy="60" r="54" fill="var(--red)" stroke="var(--ink)" strokeWidth="4" />
          <circle cx="60" cy="60" r="42" fill="none" stroke="var(--surface)" strokeWidth="3" strokeDasharray="6 5" />
          <text x="60" y="56" textAnchor="middle" fill="var(--surface)" fontFamily="var(--font-display)" fontSize="18">PROCESSED</text>
          <text x="60" y="76" textAnchor="middle" fill="var(--surface)" fontFamily="var(--font-mono)" fontSize="12">FORM 7-B</text>
        </svg>
      </button>
      <div className="mono sub">+{formatNumber(clickPower)} per stamp</div>
    </div>
  );
}
```

`src/ui/components/QueueCard.tsx`:
```tsx
import { useGame } from '../../store/game';
import { Character } from '../characters/Character';

export function QueueCard() {
  const line = useGame((s) => s.queueLine);
  return (
    <div className="card queue-card">
      <Character id="soul" mood="ok" size={44} />
      <div>
        <div className="label">Now serving</div>
        <div className="queue-line">{line}</div>
      </div>
    </div>
  );
}
```

`src/ui/components/StaffRow.tsx`:
```tsx
import Decimal from 'break_infinity.js';
import { useGame } from '../../store/game';
import type { StaffDef } from '../../engine/content';
import type { BuyMode } from '../../engine/actions';
import { staffBulkCost, maxAffordable, nextMilestone, prevMilestone } from '../../engine/economy';
import { formatNumber } from '../../engine/format';
import { Character } from '../characters/Character';

export function StaffRow({ staff, mode }: { staff: StaffDef; mode: BuyMode }) {
  const owned = useGame((s) => s.state.staff[staff.id] ?? 0);
  const kc = useGame((s) => s.state.kc);
  const rate = useGame((s) => s.rates.byStaff[staff.id] ?? new Decimal(0));
  const hire = useGame((s) => s.hire);
  const count = mode === 'max' ? maxAffordable(staff, owned, kc) : mode;
  const cost = staffBulkCost(staff, owned, Math.max(count, 1));
  const affordable = count > 0 && cost.lte(kc);
  const next = nextMilestone(owned);
  const prev = prevMilestone(owned);
  const progress = Math.min(1, (owned - prev) / (next - prev));
  return (
    <div className="card staff-row">
      <Character id={staff.character} mood="ok" size={52} />
      <div className="staff-info">
        <div className="staff-name">{staff.name} <span className="mono owned">×{owned}</span></div>
        <div className="sub">{staff.role} — {staff.flavor}</div>
        <div className="mono sub">{formatNumber(rate)}/s · next ×2 at {next}</div>
        <div className="bar"><div className="bar-fill" style={{ width: progress * 100 + '%' }} /></div>
      </div>
      <button className="btn hire" disabled={!affordable} onClick={() => hire(staff.id, mode)} aria-label={`Hire ${staff.name}`}>
        <span>Hire {mode === 'max' ? (count || 1) : mode}</span>
        <span className="mono">{formatNumber(cost)}</span>
      </button>
    </div>
  );
}
```

`src/ui/components/UpgradeRow.tsx`:
```tsx
import { useGame } from '../../store/game';
import type { UpgradeDef } from '../../engine/content';
import { upgradeCost } from '../../engine/economy';
import { formatNumber } from '../../engine/format';

export function UpgradeRow({ upgrade }: { upgrade: UpgradeDef }) {
  const level = useGame((s) => s.state.upgrades[upgrade.id] ?? 0);
  const kc = useGame((s) => s.state.kc);
  const buy = useGame((s) => s.upgrade);
  const maxed = level >= upgrade.maxLevel;
  const cost = upgradeCost(upgrade, level);
  return (
    <button className="card upgrade-row" disabled={maxed || cost.gt(kc)} onClick={() => buy(upgrade.id)} aria-label={upgrade.name}>
      <div>
        <div className="staff-name">{upgrade.name} <span className="mono owned">{level}/{upgrade.maxLevel}</span></div>
        <div className="sub">{upgrade.desc}</div>
      </div>
      <div className="mono">{maxed ? 'MAX' : formatNumber(cost)}</div>
    </button>
  );
}
```

`src/ui/components/MemoTicker.tsx`:
```tsx
import { useEffect } from 'react';
import { useGame } from '../../store/game';

export function MemoTicker() {
  const memo = useGame((s) => s.memoLine);
  const rotate = useGame((s) => s.rotateMemo);
  useEffect(() => {
    const t = setInterval(rotate, 12_000);
    return () => clearInterval(t);
  }, [rotate]);
  return (
    <div className="memo-ticker" role="status" aria-live="polite">
      <span className="memo-text">{memo}</span>
    </div>
  );
}
```

`src/ui/screens/OfficeScreen.tsx`:
```tsx
import { useState, type CSSProperties } from 'react';
import { useGame } from '../../store/game';
import { content } from '../../data';
import { findDepartment } from '../../engine/content';
import type { BuyMode } from '../../engine/actions';
import { CurrencyBar } from '../components/CurrencyBar';
import { QueueCard } from '../components/QueueCard';
import { StampButton } from '../components/StampButton';
import { StaffRow } from '../components/StaffRow';
import { UpgradeRow } from '../components/UpgradeRow';
import { MemoTicker } from '../components/MemoTicker';

const MODES: BuyMode[] = [1, 10, 'max'];

export function OfficeScreen() {
  const activeDept = useGame((s) => s.state.activeDept);
  const dept = findDepartment(content, activeDept);
  const [mode, setMode] = useState<BuyMode>(1);
  const accentStyle = { '--accent': dept.accent } as CSSProperties;
  return (
    <section className="screen office" style={accentStyle}>
      <CurrencyBar />
      <h2 className="dept-title">{dept.name} Department</h2>
      <QueueCard />
      <StampButton />
      <div className="section-head">
        <h3>Staff</h3>
        <div className="mode-switch" role="group" aria-label="Buy amount">
          {MODES.map((m) => (
            <button key={String(m)} className={'btn btn-ghost' + (mode === m ? ' active' : '')} onClick={() => setMode(m)} aria-label={`×${m}`}>×{m}</button>
          ))}
        </div>
      </div>
      {dept.staff.map((s) => <StaffRow key={s.id} staff={s} mode={mode} />)}
      <div className="section-head"><h3>Upgrades</h3></div>
      {dept.upgrades.map((u) => <UpgradeRow key={u.id} upgrade={u} />)}
      <MemoTicker />
    </section>
  );
}
```

- [ ] **Step 4: Append styles to theme.css**

Append to `src/ui/theme.css`:
```css
.label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted); }
.sub { font-size: 12px; color: var(--ink-muted); }
.value { font-size: 22px; }
.brass { color: var(--brass); }
.currency-bar { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.dept-title { color: var(--accent, var(--green)); margin: 6px 0 10px; font-size: 20px; }
.queue-card { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
.queue-line { font-size: 14px; line-height: 1.3; }
.stamp-wrap { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; margin: 4px 0 16px; }
.stamp { transition: transform 80ms ease; touch-action: manipulation; }
.stamp.pressed { transform: scale(0.92) rotate(-3deg); }
.float { position: absolute; top: 0; color: var(--brass); font-weight: 600; animation: floatUp 700ms ease-out forwards; pointer-events: none; }
@keyframes floatUp { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-48px); opacity: 0; } }
.section-head { display: flex; justify-content: space-between; align-items: center; margin: 12px 0 8px; }
.mode-switch { display: flex; gap: 4px; }
.mode-switch .btn { padding: 4px 8px; font-size: 12px; }
.mode-switch .btn.active { border-color: var(--ink); color: var(--ink); }
.staff-row { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; margin-bottom: 8px; }
.staff-name { font-weight: 600; }
.owned { color: var(--ink-muted); font-weight: 500; margin-left: 4px; }
.bar { height: 4px; background: var(--surface-2); border-radius: 2px; margin-top: 4px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--accent, var(--green)); }
.hire { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 84px; padding: 6px 8px; }
.upgrade-row { display: flex; justify-content: space-between; align-items: center; width: 100%; text-align: left; margin-bottom: 8px; }
.memo-ticker { position: fixed; left: 0; right: 0; bottom: var(--tabbar-h); background: var(--green); color: var(--paper); font-family: var(--font-mono); font-size: 12px; padding: 6px 12px; white-space: nowrap; overflow: hidden; }
.memo-text { display: inline-block; animation: ticker 18s linear infinite; }
@keyframes ticker { from { transform: translateX(100vw); } to { transform: translateX(-100%); } }
```

- [ ] **Step 5: Wire into App and polyfill rAF for tests**

In `src/ui/App.tsx` replace the office placeholder line with:
```tsx
{ready && tab === 'office' && <OfficeScreen />}
```
and add `import { OfficeScreen } from './screens/OfficeScreen';`.

`src/test-setup.ts` becomes:
```ts
import '@testing-library/jest-dom/vitest';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run src/ui/screens/OfficeScreen.test.tsx src/ui/App.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 7: Visual check**

Run `npm run dev`, play for a minute: stamp works with floating numbers, Dave becomes affordable at 15 KC, hiring shows rate, upgrades buy, memo ticker scrolls, dark mode via OS setting flips palette. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add src/ui src/test-setup.ts
git commit -m "feat(ui): Office screen with stamp, staff, upgrades, memo ticker"
git push origin main
```

---

### Task 12: Overnight Backlog Report overlay and background save

**Files:**
- Create: `src/ui/components/Modal.tsx`, `src/ui/overlays/BacklogReport.tsx`, `src/ui/overlays/BacklogReport.test.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/theme.css`

**Interfaces:**
- Consumes: `useGame().pendingOffline`, `dismissOffline`, `doubleOffline`, `save`, `boot` (Task 8).
- Produces: `<Modal open title onClose>` and `<BacklogReport />`. The ×2 button in this plan calls `doubleOffline()` directly and is labelled "Watch ad ×2 (preview)"; Plan 4 replaces the handler with the rewarded-ad flow.
- App: saves on `visibilitychange` to hidden and on Capacitor `App.addListener('appStateChange')` when `isActive` is false; re-runs `boot()` when the app becomes active again so offline earnings apply after a background gap.

- [ ] **Step 1: Write failing test**

`src/ui/overlays/BacklogReport.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import Decimal from 'break_infinity.js';
import { BacklogReport } from './BacklogReport';
import { useGame } from '../../store/game';
import { createInitialState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

describe('BacklogReport', () => {
  it('renders nothing without pending offline', () => {
    useGame.setState({ pendingOffline: null });
    const { container } = render(<BacklogReport />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows earnings and doubles them', () => {
    const state = createInitialState({ wall: 0, mono: 0 });
    useGame.setState({
      state, rates: computeRates(state, content, 0),
      pendingOffline: { elapsedSec: 7200, creditedSec: 7200, souls: new Decimal(900), kc: new Decimal(360), capped: false },
    });
    render(<BacklogReport />);
    expect(screen.getByText(/2h 0m/)).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /×2/i }));
    expect(useGame.getState().state.soulsRun.toNumber()).toBe(900);
    expect(useGame.getState().pendingOffline).toBeNull();
  });
  it('mentions the cap when capped', () => {
    const state = createInitialState({ wall: 0, mono: 0 });
    useGame.setState({
      state, rates: computeRates(state, content, 0),
      pendingOffline: { elapsedSec: 40000, creditedSec: 14400, souls: new Decimal(1), kc: new Decimal(1), capped: true },
    });
    render(<BacklogReport />);
    expect(screen.getByText(/backlog full/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/overlays/BacklogReport.test.tsx`
Expected: FAIL, cannot find module './BacklogReport'.

- [ ] **Step 3: Implement Modal and BacklogReport**

`src/ui/components/Modal.tsx`:
```tsx
import type { ReactNode } from 'react';

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose?: () => void }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
```

`src/ui/overlays/BacklogReport.tsx`:
```tsx
import { useGame } from '../../store/game';
import { formatNumber } from '../../engine/format';
import { Modal } from '../components/Modal';

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

export function BacklogReport() {
  const pending = useGame((s) => s.pendingOffline);
  const dismiss = useGame((s) => s.dismissOffline);
  const double = useGame((s) => s.doubleOffline);
  if (!pending) return null;
  return (
    <Modal open title="Overnight Backlog Report">
      <p className="sub">Staff kept stamping for {fmtDuration(pending.creditedSec)} while you were away.</p>
      {pending.capped && <p className="sub warn">Backlog full: the in-tray overflowed at the offline cap. Extend it with Night Shift Rota.</p>}
      <div className="report-grid">
        <div><div className="label">Souls</div><div className="mono value">{formatNumber(pending.souls)}</div></div>
        <div><div className="label">Karma Credits</div><div className="mono value brass">{formatNumber(pending.kc)}</div></div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={double}>Watch ad ×2 (preview)</button>
        <button className="btn btn-ghost" onClick={dismiss}>File it</button>
      </div>
    </Modal>
  );
}
```

Append to `src/ui/theme.css`:
```css
.modal-backdrop { position: fixed; inset: 0; background: rgba(42, 38, 32, 0.55); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
.modal { width: 100%; max-width: 380px; padding: 18px; }
.modal-title { font-size: 20px; margin-bottom: 8px; }
.report-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }
.modal-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.warn { color: var(--red); }
```

- [ ] **Step 4: Wire into App with background save and resume**

`src/ui/App.tsx` becomes:
```tsx
import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useGame } from '../store/game';
import { TabBar, type TabId } from './components/TabBar';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { OfficeScreen } from './screens/OfficeScreen';
import { BacklogReport } from './overlays/BacklogReport';

export function App() {
  const [tab, setTab] = useState<TabId>('office');
  const boot = useGame((s) => s.boot);
  const save = useGame((s) => s.save);
  const ready = useGame((s) => s.ready);

  useEffect(() => { void boot(); }, [boot]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void save();
      else void boot();
    };
    document.addEventListener('visibilitychange', onVisibility);
    let handle: { remove(): Promise<void> } | null = null;
    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void boot(); else void save(); }).then((h) => { handle = h; });
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void handle?.remove();
    };
  }, [boot, save]);

  return (
    <div className="app">
      {!ready && <section className="screen"><h2>Opening the office…</h2></section>}
      {ready && tab === 'office' && <OfficeScreen />}
      {ready && tab === 'personnel' && <PlaceholderScreen title="Personnel" note="Requisition Lottery opens in a later update." />}
      {ready && tab === 'ledger' && <PlaceholderScreen title="Ledger" note="Fiscal Year Audits open in a later update." />}
      {ready && tab === 'tasks' && <PlaceholderScreen title="Tasks" note="Daily tasks and achievements open in a later update." />}
      {ready && tab === 'store' && <PlaceholderScreen title="Store" note="Requisition Vouchers store opens in a later update." />}
      <BacklogReport />
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
```

Note: `boot()` on resume re-reads the save written on hide, so the offline gap is measured from the last save. Because `boot()` calls `stopLoop()` before starting a new loop, there is never more than one tick interval.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: all suites PASS.

- [ ] **Step 6: Manual check**

Run `npm run dev`. Hire Dave, switch to another browser tab for 70 seconds, switch back. Expect the Backlog Report with about 1m credited. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/ui
git commit -m "feat(ui): Overnight Backlog Report overlay, save on background, resume offline"
git push origin main
```

---

### Task 13: Android shell with Capacitor

**Files:**
- Create: `capacitor.config.ts`, `android/` (generated), `docs/android-build.md`
- Modify: `android/variables.gradle`, `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Produces: `npm run cap:sync` builds the web app and syncs into `android/`; the Android project targets SDK 36, portrait only, dark background while loading.

- [ ] **Step 1: Create capacitor.config.ts**

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.afterlifebureaucracy.game',
  appName: 'Afterlife Bureaucracy',
  webDir: 'dist',
  android: { backgroundColor: '#1B1915' },
};

export default config;
```

- [ ] **Step 2: Generate the Android project**

Run:
```bash
npm run build && npx cap add android && npx cap sync android
```
Expected: `android/` created, sync reports the `@capacitor/app` and `@capacitor/preferences` plugins.

- [ ] **Step 3: Set SDK 36 and portrait**

In `android/variables.gradle` set:
```groovy
minSdkVersion = 24
compileSdkVersion = 36
targetSdkVersion = 36
```

In `android/app/src/main/AndroidManifest.xml`, on the `<activity android:name=".MainActivity"` element add:
```xml
android:screenOrientation="portrait"
```

- [ ] **Step 4: Verify the Gradle build**

Run (from `android/`): `gradlew.bat assembleDebug` (on macOS/Linux `./gradlew assembleDebug`).
Expected: `BUILD SUCCESSFUL`, APK at `android/app/build/outputs/apk/debug/app-debug.apk`. If the JDK or Android SDK is missing, install Android Studio, open `android/` once so it downloads SDK 36, then rerun.

- [ ] **Step 5: Write docs/android-build.md**

```markdown
# Android build

- `npm run cap:sync` builds the web app and copies it into `android/`.
- `npm run cap:open` opens the project in Android Studio.
- Debug APK from the command line: `cd android && gradlew.bat assembleDebug`.
- Target SDK 36 is set in `android/variables.gradle`. Google Play rejects lower targets.
- Portrait orientation is locked in `AndroidManifest.xml`.
- Saves live in Capacitor Preferences under key `afterlife.save.v1`.
```

- [ ] **Step 6: Commit**

```bash
git add capacitor.config.ts android docs/android-build.md
git commit -m "feat(android): Capacitor Android shell targeting SDK 36"
git push origin main
```

---

## Self-review

**Spec coverage for this plan's scope (Plan 1 = foundation and core loop):**
- Currencies KC, souls (run + lifetime), seals and vouchers fields: Task 4.
- Cost curve, milestones, click power, global multiplier with seals and boost, KC 0.4 ratio: Task 5.
- Tick, click, buy modes ×1/×10/×max, department unlock by souls: Task 6.
- Offline cap 4 h + upgrades, 50% rate + upgrades, 60 s minimum, Backlog Report with ×2: Tasks 7, 8, 12.
- Number formatting: Task 2.
- Content as JSON with zod validation, Intake with 4 staff, 5 upgrades, 18 queue lines, 18 memos: Task 3.
- Versioned save with migrations, autosave 10 s and on background: Tasks 4, 8, 12.
- Palette, fonts bundled, dark theme, portrait, tab bar with 5 tabs: Tasks 9, 13.
- Ink-stamp SVG characters with two moods: Task 10 (mood switching by offline cap is wired in Plan 3 with the notification work; the prop exists now).
- Android target SDK 36: Task 13.

Deferred to later plans by design: departments 2–5 and chips (Plan 2), prestige and Perk Ledger (Plan 2), gacha, dailies, achievements, memo story, notifications (Plan 3), ads, billing, cloud save, clock integrity, simulator, store assets (Plan 4).

**Placeholder scan:** none.

**Type consistency:** `BuyMode` defined in Task 6 and consumed in Tasks 8 and 11 as `1 | 10 | 'max'`; `buyStaff` takes four arguments in Task 6, the store (Task 8) and the tests; `Rates.byStaff` defined in Task 5 and read in Task 11; `prevMilestone` defined in Task 5 and used in Task 11; `PendingOffline` shape identical in the Task 8 store and Task 12 tests; `findDepartment` exported in Task 3 and used in Tasks 8 and 11; `MIN_OFFLINE_SECONDS` exported from `offline.ts` (Task 7) and used in the store (Task 8).

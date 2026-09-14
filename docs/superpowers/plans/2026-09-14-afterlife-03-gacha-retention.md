# Afterlife Bureaucracy — Plan 3: Gacha, Dailies, Achievements, Story, Notifications

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The two remaining retention tabs come alive: Personnel (Requisition Lottery gacha with pity, star ranks and equip slots) and Tasks (three daily tasks with streaks, ~80 achievements with trophy badges). Story memos unlock on milestones and show once as a modal. Staff flip to their "cooked" face after long absences. Local notifications remind the player when the in-tray fills or dailies reset, behind an opt-in.

**Architecture:** New pure engine modules `rng.ts`, `gacha.ts`, `vouchers.ts`, `dailies.ts`, `achievements.ts`, `story.ts`; content JSON `cards.json`, `dailies.json`, `achievements.json`, `story.json` validated by zod; save v4 adds `cards`, `equipped`, `pity`, `rngSeed`, `dailies`, `achievements`, `storySeen`, `settings`, `firstSeenWallClock` and new `stats` counters. Card bonuses and the achievement bonus feed the existing multiplier functions. The store gains `pull`, `equip`, `unequip`, `claimDaily`, `skipDaily`, `dismissStory`, `dismissPull`, `setNotifOptIn`, runs a day-rollover check and an achievement/story check after every state change. A `Notifications` platform interface has a Capacitor implementation and a web no-op. New UI: `PersonnelScreen` + `PullReveal`, `TasksScreen` + `StoryMemo` + `AchievementToast`, `SettingsSheet` + `NotifPrompt`, trophy `Badge` SVGs.

**Tech Stack:** unchanged plus `@capacitor/local-notifications@^7`.

**Spec:** `docs/superpowers/specs/2026-09-14-afterlife-bureaucracy-design.md` — sections 3, 7, 8, 10, 11, 12, 16.

## Global Constraints

- Engine code in `src/engine` never imports React, zustand, or `@capacitor/*`; pure functions; never mutate input; refused actions return the same state object.
- Gacha: 1 voucher per single pull, 9 per 10-pull. Odds Temp 70% / Full-Time 22% / Senior Staff 6.5% / Executive 1.5%. Pity: Senior-or-better guaranteed within every 10 pulls, Executive within every 60. Pity counters persist across sessions and audits. Duplicates raise a card's stars 1→5; past 5 stars a duplicate converts to KC equal to 600 s of current KC income (minimum 100 KC). Equip slots: 3 + `perkSum('equipSlots')`, max 8. Only equipped cards apply. Card bonus = `value × stars`. RNG is a seeded xorshift32 stored in the save so pulls are reproducible in tests.
- Dailies: 3 tasks per local calendar day chosen deterministically from the pool by date; reset at local midnight; each task rewards 1 voucher (× voucher multiplier, rounded up) plus KC = 300 s of current KC income (minimum 50); a day counts toward the streak only when all 3 are claimed; a missed day resets the streak; a skip token (1 granted every 7 calendar days, max 1 held) marks one unfinished task as done; every 7th consecutive completed day grants +3 vouchers.
- Achievements: each unlocked achievement adds +1% to the global multiplier (`1 + 0.01 × count`); some grant vouchers once. Unlock checks run after every state change and are idempotent.
- Story memos: shown once as a modal when their trigger is met, then join the memo ticker pool. `storySeen` persists across audits.
- Moods: staff show `cooked` when the last resume credited a capped offline gap or the player was away ≥ 12 h; any stamp restores `ok`.
- Notifications: opt-in prompt no earlier than 2 days after first launch; at most 2 scheduled at a time ("In-tray full" at offline-cap time, "Daily tasks reset" at next local midnight + 5 min); all cancelled on resume. Web build is a no-op.
- Save: `SAVE_VERSION = 4`; every previous fixture still loads; the exhaustive round-trip test covers the new fields.
- Existing public store API unchanged. Pristine test output; suite under 30 s.
- Commit after every task with a conventional-commit message ending in `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; push to `origin main` after each commit.

---

## File map

| Path | Responsibility |
|---|---|
| `src/data/cards.json`, `dailies.json`, `achievements.json`, `story.json` | New content |
| `src/engine/content.ts` | schemas + `Content.cards/dailies/achievements/story`, `findCard` |
| `src/engine/state.ts`, `migrations.ts`, `fixtures/save-v4.json` | v4 fields |
| `src/engine/rng.ts` | xorshift32 |
| `src/engine/gacha.ts` | `pull`, `equipCard`, `unequipCard`, `equipSlots`, card multipliers |
| `src/engine/vouchers.ts` | `voucherMult`, `grantVouchers` |
| `src/engine/economy.ts`, `offline.ts` | card + achievement multipliers |
| `src/engine/dailies.ts` | day key, task selection, progress, claim, rollover, streak |
| `src/engine/achievements.ts` | condition evaluation, unlock, bonus |
| `src/engine/story.ts` | trigger evaluation |
| `src/store/game.ts` | new actions, rollover, checks, mood, notification scheduling |
| `src/platform/notifications.ts` | interface + implementations |
| `src/ui/screens/PersonnelScreen.tsx`, `src/ui/overlays/PullReveal.tsx`, `src/ui/components/CardTile.tsx` | Personnel tab |
| `src/ui/screens/TasksScreen.tsx`, `src/ui/components/Badge.tsx`, `src/ui/overlays/StoryMemo.tsx`, `src/ui/components/AchievementToast.tsx` | Tasks tab |
| `src/ui/overlays/SettingsSheet.tsx`, `src/ui/overlays/NotifPrompt.tsx`, `src/ui/components/CurrencyBar.tsx` | settings + gear button |
| `src/ui/components/StaffRow.tsx` | mood |

---

### Task 1: Content schemas, data files, save v4

**Files:**
- Create: `src/data/cards.json`, `src/data/dailies.json`, `src/data/achievements.json`, `src/data/story.json`, `src/engine/fixtures/save-v4.json`
- Modify: `src/engine/content.ts`, `src/engine/content.test.ts`, `src/data/index.ts`, `src/engine/state.ts`, `src/engine/migrations.ts`, `src/engine/state.test.ts`

**Interfaces:**
```ts
// content.ts
type Rarity = 'temp' | 'fulltime' | 'senior' | 'executive';
type CardEffect =
  | { type: 'deptMult'; dept: string; value: number }
  | { type: 'globalMult'; value: number }
  | { type: 'clickMult'; value: number }
  | { type: 'offlineCapHours'; value: number }
  | { type: 'voucherMult'; value: number };
interface CardDef { id: string; name: string; title: string; rarity: Rarity; dept: string; character: string; effect: CardEffect; flavor: string }
type DailyKind = 'clicks' | 'hire' | 'upgrades' | 'equip' | 'audit' | 'perk' | 'pulls';
interface DailyDef { id: string; kind: DailyKind; target: number; text: string }   // text contains "{n}"
type AchievementCondition =
  | { type: 'soulsLifetime'; target: number }
  | { type: 'clicks' | 'staffHired' | 'upgradesBought' | 'audits' | 'pulls' | 'dailiesClaimed' | 'adsWatched'; target: number }
  | { type: 'bestStreak' | 'seals' | 'fiscalYear' | 'cardsOwned' | 'executivesOwned' | 'fiveStarCards' | 'perksOwned' | 'departmentsUnlocked' | 'equipped'; target: number }
  | { type: 'staffOwned'; staff: string; target: number };
interface AchievementDef { id: string; name: string; desc: string; badge: 'stamp' | 'trophy' | 'star' | 'scroll' | 'flame' | 'gear'; tier: 1 | 2 | 3 | 4; condition: AchievementCondition; vouchers?: number }
type StoryTrigger = { type: 'soulsLifetime' | 'audits' | 'departmentsUnlocked' | 'cardsOwned' | 'fiscalYear' | 'bestStreak'; target: number };
interface StoryDef { id: string; trigger: StoryTrigger; title: string; text: string }
interface Content { departments; perks; cards: CardDef[]; dailies: DailyDef[]; achievements: AchievementDef[]; story: StoryDef[] }
function loadContent(departments: unknown[], perks?: unknown[], extras?: { cards?: unknown[]; dailies?: unknown[]; achievements?: unknown[]; story?: unknown[] }): Content
function findCard(content: Content, id: string): CardDef
// state.ts
interface DailyTaskState { id: string; claimed: boolean }
interface DailyBaseline { clicks: number; staffHired: number; upgradesBought: number; equips: number; audits: number; perksBought: number; pulls: number }
interface DailiesState { date: string; tasks: DailyTaskState[]; skipped: string[]; streak: number; bestStreak: number; skipTokens: number; lastTokenDate: string; baseline: DailyBaseline; completedToday: boolean }
interface Settings { notifOptIn: 'unasked' | 'yes' | 'no' }
interface Stats { clicks: number; staffHired: number; upgradesBought: number; audits: number; pulls: number; equips: number; dailiesClaimed: number; adsWatched: number; perksBought: number }
interface GameState { ...existing; cards: Record<string, number>; equipped: string[]; pity: { senior: number; executive: number }; rngSeed: number; dailies: DailiesState; achievements: string[]; storySeen: string[]; settings: Settings; firstSeenWallClock: number }
SAVE_VERSION = 4
```
Validation in `loadContent`: unique ids per collection; card `dept` exists ("Unknown department"); `staffOwned` staff exists ("Unknown staff"); daily `text` contains `{n}` (message contains `{n}`); each rarity has ≥ 3 cards; cards ≥ 28.

- [ ] **Step 1: Write failing tests**

Append to `src/engine/content.test.ts` (add `findCard` to the content import; `content`, `intake`, `loadContent` already imported):
```ts
import cards from '../data/cards.json';
import dailies from '../data/dailies.json';
import achievements from '../data/achievements.json';

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
});
```

Append to `src/engine/state.test.ts` (`saveV3` is already imported there):
```ts
import saveV4 from './fixtures/save-v4.json';

describe('save v4', () => {
  it('initial state has empty retention fields', () => {
    const s = createInitialState(now, content);
    expect(s.cards).toEqual({});
    expect(s.equipped).toEqual([]);
    expect(s.pity).toEqual({ senior: 0, executive: 0 });
    expect(s.rngSeed).toBeGreaterThan(0);
    expect(s.dailies.tasks).toEqual([]);
    expect(s.dailies.streak).toBe(0);
    expect(s.achievements).toEqual([]);
    expect(s.storySeen).toEqual([]);
    expect(s.settings.notifOptIn).toBe('unasked');
    expect(s.firstSeenWallClock).toBe(now.wall);
    expect(s.stats.pulls).toBe(0);
  });
  it('migrates a v3 save to v4 with defaults', () => {
    const s = deserialize(JSON.stringify(saveV3), content);
    expect(s.saveVersion).toBe(4);
    expect(s.cards).toEqual({});
    expect(s.dailies.date).toBe('');
    expect(s.firstSeenWallClock).toBe(saveV3.lastSeenWallClock);
  });
  it('loads the v4 fixture', () => {
    const s = deserialize(JSON.stringify(saveV4), content);
    expect(s.cards).toEqual({ 'c-dave-overtime': 2 });
    expect(s.equipped).toEqual(['c-dave-overtime']);
    expect(s.pity).toEqual({ senior: 4, executive: 12 });
    expect(s.dailies.streak).toBe(3);
  });
  it('sanitises retention fields', () => {
    const raw = { ...saveV4, cards: { 'c-dave-overtime': 9, junk: 'x' }, equipped: ['c-dave-overtime', 5, 'c-dave-overtime'], pity: { senior: -1 } };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.cards).toEqual({ 'c-dave-overtime': 5 });
    expect(s.equipped).toEqual(['c-dave-overtime']);
    expect(s.pity).toEqual({ senior: 0, executive: 0 });
  });
});
```
Extend the Plan 2 exhaustive round-trip test to set every new field to a non-default value; it must still pass.

`src/engine/fixtures/save-v4.json`: copy `save-v3.json`, set `"saveVersion": 4`, add:
```json
"cards": { "c-dave-overtime": 2 }, "equipped": ["c-dave-overtime"], "pity": { "senior": 4, "executive": 12 }, "rngSeed": 123456789,
"dailies": { "date": "2026-09-14", "tasks": [{ "id": "d-clicks-1", "claimed": true }, { "id": "d-hire-1", "claimed": false }, { "id": "d-upgrades-1", "claimed": false }], "skipped": [], "streak": 3, "bestStreak": 3, "skipTokens": 1, "lastTokenDate": "2026-09-08", "baseline": { "clicks": 240, "staffHired": 15, "upgradesBought": 2, "equips": 0, "audits": 0, "perksBought": 0, "pulls": 0 }, "completedToday": false },
"achievements": ["a-souls-1"], "storySeen": ["s-first-stamp"], "settings": { "notifOptIn": "unasked" }, "firstSeenWallClock": 1700000000000
```
and extend `stats` with `"pulls": 3, "equips": 1, "dailiesClaimed": 4, "adsWatched": 0, "perksBought": 1`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/content.test.ts src/engine/state.test.ts` — FAIL.

- [ ] **Step 3: Write cards.json** (30 cards; `character` reuses existing ids)

```json
[
  { "id": "c-dave-overtime", "name": "Dave", "title": "Reaper, Double Overtime", "rarity": "temp", "dept": "intake", "character": "dave", "effect": { "type": "deptMult", "dept": "intake", "value": 0.05 }, "flavor": "Two shifts. One scythe." },
  { "id": "c-seraphine-chipper", "name": "Seraphine", "title": "Angel, Still Chipper", "rarity": "temp", "dept": "intake", "character": "seraphine", "effect": { "type": "deptMult", "dept": "intake", "value": 0.05 }, "flavor": "Positive attitude, negative pay." },
  { "id": "c-gary-break", "name": "Gary", "title": "Demon Intern, On Break", "rarity": "temp", "dept": "intake", "character": "gary", "effect": { "type": "offlineCapHours", "value": 0.5 }, "flavor": "Union-mandated." },
  { "id": "c-cherub-choir", "name": "Choir Cherub", "title": "Soprano, Third Row", "rarity": "temp", "dept": "heaven", "character": "angel:0", "effect": { "type": "deptMult", "dept": "heaven", "value": 0.05 }, "flavor": "Knows one hymn. Sings it." },
  { "id": "c-imp-qa", "name": "QA Imp", "title": "Torment Tester", "rarity": "temp", "dept": "hell", "character": "demon:0", "effect": { "type": "deptMult", "dept": "hell", "value": 0.05 }, "flavor": "Files a defect against every scream." },
  { "id": "c-clerk-karma", "name": "Karma Clerk", "title": "Ledger Pool, Desk 4", "rarity": "temp", "dept": "reincarnation", "character": "clerk:0", "effect": { "type": "deptMult", "dept": "reincarnation", "value": 0.05 }, "flavor": "Itemises good deeds by weight." },
  { "id": "c-archivist-dust", "name": "Dust Archivist", "title": "Filing, Indefinite", "rarity": "temp", "dept": "limbo", "character": "archivist:0", "effect": { "type": "deptMult", "dept": "limbo", "value": 0.05 }, "flavor": "Everything is filed. Nothing is found." },
  { "id": "c-temp-stapler", "name": "Temp Stapler", "title": "Rented By The Hour", "rarity": "temp", "dept": "intake", "character": "soul", "effect": { "type": "clickMult", "value": 0.02 }, "flavor": "Jams on Fridays." },
  { "id": "c-temp-voucher", "name": "Petty Cash Temp", "title": "Receipts, Mostly", "rarity": "temp", "dept": "intake", "character": "clerk:1", "effect": { "type": "voucherMult", "value": 0.03 }, "flavor": "Keeps every receipt. Loses the drawer." },
  { "id": "c-temp-night", "name": "Night Temp", "title": "Graveyard, Literally", "rarity": "temp", "dept": "limbo", "character": "archivist:1", "effect": { "type": "offlineCapHours", "value": 0.5 }, "flavor": "Nobody told them to go home." },

  { "id": "c-petra-keys", "name": "Petra", "title": "Gatekeeper, Tenured", "rarity": "fulltime", "dept": "heaven", "character": "angel:1", "effect": { "type": "deptMult", "dept": "heaven", "value": 0.12 }, "flavor": "Found the list. Lost the keys." },
  { "id": "c-malphas-forks", "name": "Malphas", "title": "Pitchfork Logistics, Senior", "rarity": "fulltime", "dept": "hell", "character": "demon:1", "effect": { "type": "deptMult", "dept": "hell", "value": 0.12 }, "flavor": "Every fork accounted for. One spoon at large." },
  { "id": "c-pemberton", "name": "Officer Pemberton", "title": "Canine Placement", "rarity": "fulltime", "dept": "reincarnation", "character": "clerk:1", "effect": { "type": "deptMult", "dept": "reincarnation", "value": 0.12 }, "flavor": "Golden retriever tier: closed." },
  { "id": "c-ferro", "name": "Ms. Ferro", "title": "Lost & Found", "rarity": "fulltime", "dept": "limbo", "character": "archivist:1", "effect": { "type": "deptMult", "dept": "limbo", "value": 0.12 }, "flavor": "Fourteen halos and a sense of purpose." },
  { "id": "c-auditor-fruit", "name": "The Auditor", "title": "Fruit Basket Recipient", "rarity": "fulltime", "dept": "intake", "character": "auditor", "effect": { "type": "deptMult", "dept": "intake", "value": 0.12 }, "flavor": "This is fine." },
  { "id": "c-harpist-hold", "name": "Melodia", "title": "Hold Music, Eternal", "rarity": "fulltime", "dept": "heaven", "character": "angel:2", "effect": { "type": "offlineCapHours", "value": 1 }, "flavor": "Your call is important to eternity." },
  { "id": "c-lilith-culture", "name": "Lilith from HR", "title": "People & Culture", "rarity": "fulltime", "dept": "hell", "character": "demon:2", "effect": { "type": "voucherMult", "value": 0.08 }, "flavor": "Culture is mandatory." },
  { "id": "c-nadia-odds", "name": "Nadia", "title": "Actuary, Next Lives", "rarity": "fulltime", "dept": "reincarnation", "character": "clerk:2", "effect": { "type": "clickMult", "value": 0.06 }, "flavor": "Knows your odds. Won't say." },
  { "id": "c-forgot", "name": "The One Who Forgot", "title": "Resident Since Forever", "rarity": "fulltime", "dept": "limbo", "character": "archivist:2", "effect": { "type": "offlineCapHours", "value": 1 }, "flavor": "Meant to leave. Got comfortable." },

  { "id": "c-bev-wings", "name": "Archangel Bev", "title": "Regional Manager", "rarity": "senior", "dept": "heaven", "character": "angel:3", "effect": { "type": "deptMult", "dept": "heaven", "value": 0.3 }, "flavor": "Six wings, one clipboard." },
  { "id": "c-grax-fire", "name": "Foreman Grax", "title": "Furnace Operations", "rarity": "senior", "dept": "hell", "character": "demon:3", "effect": { "type": "deptMult", "dept": "hell", "value": 0.3 }, "flavor": "Union rep. Also on fire." },
  { "id": "c-wheel-tech", "name": "Wheel Technician", "title": "Samsara Maintenance", "rarity": "senior", "dept": "reincarnation", "character": "clerk:3", "effect": { "type": "deptMult", "dept": "reincarnation", "value": 0.3 }, "flavor": "The squeak is structural." },
  { "id": "c-obroin", "name": "Registrar Ó Broin", "title": "Master of Records", "rarity": "senior", "dept": "limbo", "character": "archivist:3", "effect": { "type": "deptMult", "dept": "limbo", "value": 0.3 }, "flavor": "Knows where box 7 is." },
  { "id": "c-dave-cooked", "name": "Dave", "title": "Officially Cooked", "rarity": "senior", "dept": "intake", "character": "dave", "effect": { "type": "clickMult", "value": 0.15 }, "flavor": "Past clock-out. Past caring." },
  { "id": "c-grandma-liu", "name": "Grandma Liu", "title": "Snack Coordinator", "rarity": "senior", "dept": "intake", "character": "soul", "effect": { "type": "voucherMult", "value": 0.15 }, "flavor": "Brought snacks. Still needs stamping." },

  { "id": "c-seraph-board", "name": "The Seraph Board", "title": "Steering Committee", "rarity": "executive", "dept": "heaven", "character": "angel:4", "effect": { "type": "globalMult", "value": 0.08 }, "flavor": "Burns with holy fire and quarterly goals." },
  { "id": "c-duke-vassago", "name": "Duke Vassago", "title": "VP, Eternal Torment", "rarity": "executive", "dept": "hell", "character": "demon:4", "effect": { "type": "globalMult", "value": 0.08 }, "flavor": "Very senior. Very tired." },
  { "id": "c-bodhisattva", "name": "The Bodhisattva", "title": "Senior Advisor (Contract)", "rarity": "executive", "dept": "reincarnation", "character": "clerk:4", "effect": { "type": "globalMult", "value": 0.08 }, "flavor": "Stays for the pension." },
  { "id": "c-keeper", "name": "The Keeper", "title": "Head of the Cabinet", "rarity": "executive", "dept": "limbo", "character": "archivist:4", "effect": { "type": "globalMult", "value": 0.08 }, "flavor": "Bigger on the inside." },
  { "id": "c-auditor-true", "name": "The Auditor", "title": "Unbribed", "rarity": "executive", "dept": "intake", "character": "auditor", "effect": { "type": "globalMult", "value": 0.1 }, "flavor": "Has been asking questions." }
]
```

- [ ] **Step 4: Write dailies.json**

```json
[
  { "id": "d-clicks-1", "kind": "clicks", "target": 150, "text": "Stamp {n} souls by hand" },
  { "id": "d-clicks-2", "kind": "clicks", "target": 400, "text": "Stamp {n} souls by hand" },
  { "id": "d-hire-1", "kind": "hire", "target": 10, "text": "Hire {n} staff" },
  { "id": "d-hire-2", "kind": "hire", "target": 40, "text": "Hire {n} staff" },
  { "id": "d-upgrades-1", "kind": "upgrades", "target": 2, "text": "Buy {n} upgrades" },
  { "id": "d-upgrades-2", "kind": "upgrades", "target": 5, "text": "Buy {n} upgrades" },
  { "id": "d-equip-1", "kind": "equip", "target": 1, "text": "Equip {n} personnel card" },
  { "id": "d-pulls-1", "kind": "pulls", "target": 1, "text": "Draw {n} requisition" },
  { "id": "d-audit-1", "kind": "audit", "target": 1, "text": "File {n} annual audit" },
  { "id": "d-perk-1", "kind": "perk", "target": 1, "text": "Buy {n} perk in the Ledger" }
]
```

- [ ] **Step 5: Write achievements.json** (80 entries, one object per line, ids `a-<series>-<n>`; tier 1 = 0 vouchers, tier 2 = 1, tier 3 = 2–3, tier 4 = 5–8; names in the office-satire voice)

Series and targets:
- `souls` (badge `stamp`), `soulsLifetime`: 1e3, 1e4, 1e5, 1e6, 1e8, 1e10, 1e12, 1e14, 1e16, 1e18, 1e21, 1e24 — tiers 1,1,1,2,2,2,3,3,3,4,4,4 (12). Names e.g. "First Thousand", "Ten Thousand Stamped", "Quota, Technically", "A Million Filed", …, "Beyond Counting".
- `clicks` (`stamp`): 100, 1000, 10000, 100000 — tiers 1,2,3,4 (4).
- `staff` (`gear`), `staffHired`: 10, 50, 200, 1000, 5000, 20000 — tiers 1,1,2,3,3,4 (6).
- `dave`, `seraphine`, `gary`, `auditor` (`gear`), `staffOwned` 25 (tier 2) and 100 (tier 3) each (8), e.g. "Dave Never Leaves".
- `upgrades` (`gear`), `upgradesBought`: 5, 20, 50, 100 — tiers 1,2,3,4 (4).
- `depts` (`scroll`), `departmentsUnlocked`: 2, 3, 4, 5 — tiers 1,2,3,4 (4).
- `audits` (`trophy`), `audits`: 1, 3, 10, 25, 50, 100 — tiers 1,2,2,3,4,4 (6); `a-audits-1` "Books Closed".
- `seals` (`trophy`), `seals`: 10, 100, 1000, 10000 — tiers 1,2,3,4 (4).
- `perks` (`scroll`), `perksOwned`: 1, 5, 15, 30, 40 — tiers 1,2,3,4,4 (5).
- `cards` (`star`), `cardsOwned`: 1, 5, 10, 20, 30 — tiers 1,1,2,3,4 (5); `execs` `executivesOwned` 1, 3, 5 — tiers 2,3,4 (3); `fivestar` `fiveStarCards` 1, 5, 10 — tiers 2,3,4 (3); `equipped` 3, 5, 8 — tiers 1,2,3 (3).
- `pulls` (`star`), `pulls`: 1, 10, 50, 200 — tiers 1,1,2,3 (4).
- `dailies` (`flame`), `dailiesClaimed`: 3, 21, 90, 365 — tiers 1,2,3,4 (4); `streak` `bestStreak` 3, 7, 30, 100 — tiers 1,2,3,4 (4); `a-streak-2` "Seven Days a Week".
- `ads` (`flame`), `adsWatched`: 1 — tier 1 (1; only unlockable after Plan 4).
Total 80.

- [ ] **Step 6: Write story.json** (30 memos; each `text` one or two sentences in the memo voice; first two ids must be `s-first-stamp` and `s-deja-vu`)

Beats in trigger order: (1) `s-first-stamp` `soulsLifetime` 10 — welcome to Intake, nobody knows where the tray leads; (2) `s-deja-vu` `soulsLifetime` 1e3 — mortal realm déjà vu spike; (3) `departmentsUnlocked` 2 — Heaven at capacity; (4) `soulsLifetime` 1e5 — soul filed as both cat and CEO; (5) `departmentsUnlocked` 3 — Hell's imps unionise; (6) `audits` 1 — the Auditor signed without reading; (7) `soulsLifetime` 1e8 — fewer people, 'somehow'; (8) `cardsOwned` 1 — staffing is now a lottery, HR calls it engagement; (9) `audits` 3 — fiscal years are getting shorter; (10) `departmentsUnlocked` 4 — the Wheel squeaks; (11) `bestStreak` 7 — Legal flags you as suspiciously reliable; (12) `soulsLifetime` 1e12 — two people share a memory of a Tuesday; (13) `audits` 10 — the Auditor asks a question; (14) `departmentsUnlocked` 5 — box 7; (15) `cardsOwned` 10 — the roster contains three Daves; (16) `fiscalYear` 15 — eternity is a KPI; (17) `soulsLifetime` 1e15 — gravity briefly optional; (18) `audits` 25 — the basket holds one unstamped form: yours; (19) `cardsOwned` 20 — Lost & Found returns a sense of purpose; (20) `fiscalYear` 30 — the backlog sees you; (21) `soulsLifetime` 1e18 — the queue stamps itself; (22) `audits` 50 — the Auditor, unbribed, files a report on you; (23) `cardsOwned` 30 — HR declares victory and closes; (24) `fiscalYear` 50 — Cosmic Restructuring is 'being discussed'; (25) `soulsLifetime` 1e21 — souls arrive pre-approved; (26) `audits` 100 — the auditor has retired, into the tray; (27) `bestStreak` 30 — the mortal realm has noticed a pattern; (28) `soulsLifetime` 1e24 — the department is now the afterlife; (29) `fiscalYear` 100 — Cosmic Restructuring will be in touch; (30) `audits` 200 — the stamp has your name on it.

- [ ] **Step 7: Implement content.ts, data index, state v4**

`content.ts`: zod schemas per the interface block (`cardSchema` with `rarity: z.enum([...])`; `dailySchema` with `.refine((d) => d.text.includes('{n}'), { message: '{n} placeholder required' })`; `achievementSchema` with `tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])` and `condition` as a discriminated union on `type` (the `staffOwned` variant carries `staff`); `storySchema`). `loadContent(rawDepartments, rawPerks = [], extras = {})` parses each collection, `assertUnique` per collection, validates card `dept` ("Unknown department"), achievement `staffOwned` ("Unknown staff"). `findCard` throws "Unknown card: id". `src/data/index.ts` passes all four files in `extras`.

`migrations.ts`: `SAVE_VERSION = 4`; step 3→4:
```ts
(raw) => ({
  ...raw,
  cards: {}, equipped: [], pity: { senior: 0, executive: 0 }, rngSeed: 0x9e3779b9,
  dailies: { date: '', tasks: [], skipped: [], streak: 0, bestStreak: 0, skipTokens: 0, lastTokenDate: '', baseline: { clicks: 0, staffHired: 0, upgradesBought: 0, equips: 0, audits: 0, perksBought: 0, pulls: 0 }, completedToday: false },
  achievements: [], storySeen: [], settings: { notifOptIn: 'unasked' },
  firstSeenWallClock: typeof raw.lastSeenWallClock === 'number' ? raw.lastSeenWallClock : 0,
  stats: { ...((raw.stats as object) ?? {}), pulls: 0, equips: 0, dailiesClaimed: 0, adsWatched: 0, perksBought: 0 },
}),
```
`state.ts`: new interfaces and fields; `createInitialState` sets `rngSeed: (now.wall % 2147483647) || 1`, `firstSeenWallClock: now.wall`, empty dailies as above. `deserialize`: `cards` → `counts()` filtered to known card ids, stars clamped 1–5 (0 dropped); `equipped` → strings, known and owned, de-duplicated, max 8; `pity` → non-negative ints; `rngSeed` → positive int else default; `dailies` → every field coerced (`num`/string), `tasks` filtered to `{ id: string; claimed: boolean }` with known daily ids, `skipped` known ids; `achievements`/`storySeen` → known ids; `settings.notifOptIn` ∈ enum else `'unasked'`; `firstSeenWallClock` → `num(raw.firstSeenWallClock, lastSeenWallClock)`; new `stats` counters via `num`.

- [ ] **Step 8: Run, commit**

Run: `npm test` — PASS.
```bash
git add src/data src/engine
git commit -m "feat(content): cards, dailies, achievements, story content; save v4"
git push origin main
```

---

### Task 2: RNG and gacha engine

**Files:**
- Create: `src/engine/rng.ts`, `src/engine/rng.test.ts`, `src/engine/gacha.ts`, `src/engine/gacha.test.ts`
- Modify: `src/engine/economy.ts`, `src/engine/economy.test.ts`, `src/engine/offline.ts`, `src/engine/offline.test.ts`

**Interfaces:**
```ts
// rng.ts
function xorshift32(seed: number): number                          // next seed, never 0
function nextFloat(seed: number): { seed: number; value: number }  // value in [0,1)
// gacha.ts
const PULL_COST = 1, TEN_PULL_COST = 9, MAX_STARS = 5, BASE_EQUIP_SLOTS = 3, MAX_EQUIP_SLOTS = 8, PITY_SENIOR = 10, PITY_EXECUTIVE = 60, DUPLICATE_KC_SECONDS = 600, DUPLICATE_KC_MIN = 100;
const ODDS: Record<Rarity, number> = { temp: 0.70, fulltime: 0.22, senior: 0.065, executive: 0.015 };
interface PullResult { cardId: string; rarity: Rarity; starsAfter: number; duplicateKc: Decimal | null; pityTriggered: 'senior' | 'executive' | null }
function rollRarity(seed: number, pity: { senior: number; executive: number }): { seed: number; rarity: Rarity; pityTriggered: PullResult['pityTriggered'] }
function pull(state: GameState, content: Content, count: 1 | 10, kcPerSec: Decimal): { state: GameState; results: PullResult[] }  // same state, [] if unaffordable
function equipSlots(state: GameState, content: Content): number
function equipCard(state: GameState, content: Content, cardId: string): GameState   // same state if not owned / already equipped / no free slot
function unequipCard(state: GameState, cardId: string): GameState
function cardGlobalMult(state, content): Decimal; function cardDeptMult(state, content, deptId): Decimal
function cardClickMult(state, content): number; function cardOfflineCapHours(state, content): number; function cardVoucherMult(state, content): number
```
Integration: `globalMult` × `cardGlobalMult`; `deptMult` × `cardDeptMult`; `computeRates` clickPower × `(1 + cardClickMult)`; `offlineCapSeconds` + `cardOfflineCapHours × 3600`.

- [ ] **Step 1: Write failing tests**

`src/engine/rng.test.ts`:
```ts
import { xorshift32, nextFloat } from './rng';
describe('xorshift32', () => {
  it('is deterministic and never returns 0', () => {
    expect(xorshift32(1)).toBe(xorshift32(1));
    let s = 1; for (let i = 0; i < 10000; i++) { s = xorshift32(s); expect(s).not.toBe(0); }
    expect(xorshift32(0)).not.toBe(0);
  });
  it('yields floats in [0,1) with a roughly uniform mean', () => {
    let s = 42, sum = 0;
    for (let i = 0; i < 20000; i++) { const r = nextFloat(s); s = r.seed; expect(r.value).toBeGreaterThanOrEqual(0); expect(r.value).toBeLessThan(1); sum += r.value; }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
  });
});
```

`src/engine/gacha.test.ts`:
```ts
import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import { pull, rollRarity, equipCard, unequipCard, equipSlots, cardGlobalMult, cardDeptMult, cardClickMult, cardOfflineCapHours, ODDS, PITY_SENIOR, PITY_EXECUTIVE } from './gacha';

const now = { wall: 0, mono: 0 };
const base = () => ({ ...createInitialState(now, content), vouchers: 100, rngSeed: 7 });
const rate = new Decimal(10);

describe('rollRarity', () => {
  it('matches published odds over 100k rolls (no pity)', () => {
    let seed = 99; const counts = { temp: 0, fulltime: 0, senior: 0, executive: 0 };
    for (let i = 0; i < 100_000; i++) { const r = rollRarity(seed, { senior: 0, executive: 0 }); seed = r.seed; counts[r.rarity]++; }
    for (const k of Object.keys(ODDS) as Array<keyof typeof ODDS>) expect(counts[k] / 100_000).toBeCloseTo(ODDS[k], 2);
  });
  it('forces senior+ on the 10th pull and executive on the 60th', () => {
    expect(['senior', 'executive']).toContain(rollRarity(1, { senior: PITY_SENIOR - 1, executive: 0 }).rarity);
    expect(rollRarity(1, { senior: 0, executive: PITY_EXECUTIVE - 1 }).rarity).toBe('executive');
  });
});

describe('pull', () => {
  it('charges 1 per single and 9 per ten, advances the seed, records stats, never mutates', () => {
    const s0 = base();
    const one = pull(s0, content, 1, rate);
    expect(one.state.vouchers).toBe(99);
    expect(one.results).toHaveLength(1);
    expect(one.state.rngSeed).not.toBe(s0.rngSeed);
    expect(one.state.stats.pulls).toBe(1);
    const ten = pull(s0, content, 10, rate);
    expect(ten.state.vouchers).toBe(91);
    expect(ten.results).toHaveLength(10);
    expect(s0.vouchers).toBe(100);
  });
  it('refuses when vouchers are short', () => {
    const s0 = { ...base(), vouchers: 8 };
    expect(pull(s0, content, 10, rate).state).toBe(s0);
    const s1 = { ...base(), vouchers: 0 };
    expect(pull(s1, content, 1, rate).state).toBe(s1);
  });
  it('is reproducible from the seed', () => {
    const a = pull(base(), content, 10, rate).results.map((r) => r.cardId);
    const b = pull(base(), content, 10, rate).results.map((r) => r.cardId);
    expect(a).toEqual(b);
  });
  it('never exceeds 10 pulls without a senior+ and 60 without an executive', () => {
    let s = { ...base(), vouchers: 100_000 };
    let sinceSenior = 0, sinceExec = 0;
    for (let i = 0; i < 3000; i++) {
      const r = pull(s, content, 1, rate); s = r.state;
      const rar = r.results[0].rarity;
      sinceSenior = rar === 'senior' || rar === 'executive' ? 0 : sinceSenior + 1;
      sinceExec = rar === 'executive' ? 0 : sinceExec + 1;
      expect(sinceSenior).toBeLessThan(PITY_SENIOR);
      expect(sinceExec).toBeLessThan(PITY_EXECUTIVE);
    }
  });
  it('raises stars on duplicates and converts past five stars to KC', () => {
    const one = { ...content, cards: [content.cards[0]] };
    let s = { ...base(), vouchers: 50 };
    for (let i = 0; i < 5; i++) s = pull(s, one, 1, rate).state;
    expect(s.cards[content.cards[0].id]).toBe(5);
    const r = pull(s, one, 1, rate);
    expect(r.state.cards[content.cards[0].id]).toBe(5);
    expect(r.results[0].duplicateKc?.toNumber()).toBe(6000);
    expect(r.state.kc.toNumber()).toBe(6000);
    expect(pull({ ...s, kc: new Decimal(0) }, one, 1, new Decimal(0.01)).results[0].duplicateKc?.toNumber()).toBe(100);
  });
});

describe('equip', () => {
  it('has 3 slots by default, more with perks, max 8', () => {
    const s = base();
    expect(equipSlots(s, content)).toBe(3);
    expect(equipSlots({ ...s, perks: ['requisition-1', 'requisition-3', 'requisition-4'] }, content)).toBe(5);
    expect(equipSlots({ ...s, perks: ['requisition-1', 'requisition-2', 'requisition-3', 'requisition-4', 'requisition-5', 'requisition-6', 'requisition-7', 'requisition-8'] }, content)).toBe(8);
  });
  it('equips owned cards up to the slot limit and unequips', () => {
    const ids = content.cards.slice(0, 4).map((c) => c.id);
    let s = { ...base(), cards: Object.fromEntries(ids.map((id) => [id, 1])) };
    for (const id of ids.slice(0, 3)) s = equipCard(s, content, id);
    expect(s.equipped).toEqual(ids.slice(0, 3));
    expect(equipCard(s, content, ids[3])).toBe(s);
    expect(equipCard(s, content, ids[0])).toBe(s);
    expect(equipCard(s, content, 'c-keeper')).toBe(s);
    expect(s.stats.equips).toBe(3);
    const u = unequipCard(s, ids[1]);
    expect(u.equipped).toEqual([ids[0], ids[2]]);
    expect(unequipCard(u, 'zzz')).toBe(u);
  });
  it('applies only equipped card bonuses scaled by stars', () => {
    const s = { ...base(), cards: { 'c-seraph-board': 3, 'c-dave-overtime': 2, 'c-temp-stapler': 5, 'c-gary-break': 1 }, equipped: ['c-seraph-board', 'c-dave-overtime', 'c-temp-stapler'] };
    expect(cardGlobalMult(s, content).toNumber()).toBeCloseTo(1 + 0.08 * 3);
    expect(cardDeptMult(s, content, 'intake').toNumber()).toBeCloseTo(1 + 0.05 * 2);
    expect(cardDeptMult(s, content, 'heaven').toNumber()).toBe(1);
    expect(cardClickMult(s, content)).toBeCloseTo(0.02 * 5);
    expect(cardOfflineCapHours(s, content)).toBe(0);
  });
});
```
Append to `economy.test.ts`: with `c-temp-stapler` at 5 stars equipped, `computeRates(...).clickPower` for a state with 0 staff and 0 stapler level is `1.1`; `globalMult` with `c-seraph-board` at 1 star equipped is `×1.08`. Append to `offline.test.ts`: `c-gary-break` at 2 stars equipped adds 3600 s to `offlineCapSeconds`.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/engine/rng.test.ts src/engine/gacha.test.ts` → FAIL.

- [ ] **Step 3: Implement rng.ts**

```ts
export function xorshift32(seed: number): number {
  let x = (seed >>> 0) || 0x9e3779b9;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  return x || 0x9e3779b9;
}
export function nextFloat(seed: number): { seed: number; value: number } {
  const next = xorshift32(seed);
  return { seed: next, value: next / 4294967296 };
}
```

- [ ] **Step 4: Implement gacha.ts**

```ts
import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content, CardDef, Rarity } from './content';
import { findCard } from './content';
import { nextFloat } from './rng';
import { perkSum } from './perks';

export const PULL_COST = 1;
export const TEN_PULL_COST = 9;
export const MAX_STARS = 5;
export const BASE_EQUIP_SLOTS = 3;
export const MAX_EQUIP_SLOTS = 8;
export const PITY_SENIOR = 10;
export const PITY_EXECUTIVE = 60;
export const DUPLICATE_KC_SECONDS = 600;
export const DUPLICATE_KC_MIN = 100;
export const ODDS: Record<Rarity, number> = { temp: 0.70, fulltime: 0.22, senior: 0.065, executive: 0.015 };
const ROLL_ORDER: Rarity[] = ['executive', 'senior', 'fulltime', 'temp'];

export interface PullResult { cardId: string; rarity: Rarity; starsAfter: number; duplicateKc: Decimal | null; pityTriggered: 'senior' | 'executive' | null }

export function rollRarity(seed: number, pity: { senior: number; executive: number }): { seed: number; rarity: Rarity; pityTriggered: PullResult['pityTriggered'] } {
  const r = nextFloat(seed);
  let acc = 0;
  let natural: Rarity = 'temp';
  for (const rarity of ROLL_ORDER) {
    acc += ODDS[rarity];
    if (r.value < acc) { natural = rarity; break; }
  }
  if (pity.executive >= PITY_EXECUTIVE - 1) return { seed: r.seed, rarity: 'executive', pityTriggered: 'executive' };
  if (pity.senior >= PITY_SENIOR - 1 && natural !== 'executive' && natural !== 'senior') return { seed: r.seed, rarity: 'senior', pityTriggered: 'senior' };
  return { seed: r.seed, rarity: natural, pityTriggered: null };
}

function pickCard(seed: number, pool: CardDef[]): { seed: number; card: CardDef } {
  const r = nextFloat(seed);
  return { seed: r.seed, card: pool[Math.min(pool.length - 1, Math.floor(r.value * pool.length))] };
}

export function pull(state: GameState, content: Content, count: 1 | 10, kcPerSec: Decimal): { state: GameState; results: PullResult[] } {
  const cost = count === 10 ? TEN_PULL_COST : PULL_COST;
  if (state.vouchers < cost) return { state, results: [] };
  let seed = state.rngSeed;
  let pity = { ...state.pity };
  const cards = { ...state.cards };
  let kc = state.kc;
  const results: PullResult[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rollRarity(seed, pity);
    seed = roll.seed;
    const pool = content.cards.filter((c) => c.rarity === roll.rarity);
    const picked = pickCard(seed, pool.length ? pool : content.cards);
    seed = picked.seed;
    const id = picked.card.id;
    const stars = cards[id] ?? 0;
    let duplicateKc: Decimal | null = null;
    if (stars >= MAX_STARS) {
      duplicateKc = Decimal.max(new Decimal(DUPLICATE_KC_MIN), kcPerSec.mul(DUPLICATE_KC_SECONDS));
      kc = kc.add(duplicateKc);
    } else {
      cards[id] = stars + 1;
    }
    const gotSenior = roll.rarity === 'senior' || roll.rarity === 'executive';
    pity = { senior: gotSenior ? 0 : pity.senior + 1, executive: roll.rarity === 'executive' ? 0 : pity.executive + 1 };
    results.push({ cardId: id, rarity: roll.rarity, starsAfter: cards[id] ?? MAX_STARS, duplicateKc, pityTriggered: roll.pityTriggered });
  }
  return {
    state: { ...state, vouchers: state.vouchers - cost, rngSeed: seed, pity, cards, kc, stats: { ...state.stats, pulls: state.stats.pulls + count } },
    results,
  };
}

export function equipSlots(state: GameState, content: Content): number {
  return Math.min(MAX_EQUIP_SLOTS, BASE_EQUIP_SLOTS + perkSum(state, content, 'equipSlots'));
}
export function equipCard(state: GameState, content: Content, cardId: string): GameState {
  if (!(cardId in state.cards) || state.equipped.includes(cardId)) return state;
  if (state.equipped.length >= equipSlots(state, content)) return state;
  return { ...state, equipped: [...state.equipped, cardId], stats: { ...state.stats, equips: state.stats.equips + 1 } };
}
export function unequipCard(state: GameState, cardId: string): GameState {
  if (!state.equipped.includes(cardId)) return state;
  return { ...state, equipped: state.equipped.filter((id) => id !== cardId) };
}

function equippedDefs(state: GameState, content: Content): Array<{ def: CardDef; stars: number }> {
  return state.equipped.map((id) => ({ def: findCard(content, id), stars: state.cards[id] ?? 1 }));
}
export function cardGlobalMult(state: GameState, content: Content): Decimal {
  let m = new Decimal(1);
  for (const { def, stars } of equippedDefs(state, content)) if (def.effect.type === 'globalMult') m = m.mul(1 + def.effect.value * stars);
  return m;
}
export function cardDeptMult(state: GameState, content: Content, deptId: string): Decimal {
  let m = new Decimal(1);
  for (const { def, stars } of equippedDefs(state, content)) if (def.effect.type === 'deptMult' && def.effect.dept === deptId) m = m.mul(1 + def.effect.value * stars);
  return m;
}
function sumEffect(state: GameState, content: Content, type: 'clickMult' | 'offlineCapHours' | 'voucherMult'): number {
  let t = 0;
  for (const { def, stars } of equippedDefs(state, content)) if (def.effect.type === type) t += def.effect.value * stars;
  return t;
}
export const cardClickMult = (s: GameState, c: Content): number => sumEffect(s, c, 'clickMult');
export const cardOfflineCapHours = (s: GameState, c: Content): number => sumEffect(s, c, 'offlineCapHours');
export const cardVoucherMult = (s: GameState, c: Content): number => sumEffect(s, c, 'voucherMult');
```
Integrate into `economy.ts` (`globalMult` `.mul(cardGlobalMult(state, content))`; `deptMult` `.mul(cardDeptMult(state, content, dept.id))`; `computeRates` `clickPower = (...).mul(1 + cardClickMult(state, content))`) and `offline.ts` (`hours += cardOfflineCapHours(state, content)`).

- [ ] **Step 5: Run and commit**

Run: `npm test` — PASS.
```bash
git add src/engine
git commit -m "feat(engine): seeded gacha with pity, star ranks, equip slots and card bonuses"
git push origin main
```

---

### Task 3: Vouchers and dailies engine

**Files:**
- Create: `src/engine/vouchers.ts`, `src/engine/dailies.ts`, `src/engine/dailies.test.ts`
- Modify: `src/engine/actions.ts` (`buyPerk` increments `stats.perksBought`), `src/engine/perks.test.ts` (assert it)

**Interfaces:**
```ts
// vouchers.ts
function voucherMult(state, content): number                    // 1 + perkSum('voucherMult') + cardVoucherMult
function grantVouchers(state, content, base: number): GameState  // vouchers += ceil(base × voucherMult); same state if base ≤ 0
// dailies.ts
const TASKS_PER_DAY = 3, STREAK_BONUS_EVERY = 7, STREAK_BONUS_VOUCHERS = 3, TOKEN_EVERY_DAYS = 7, DAILY_VOUCHERS = 1, DAILY_KC_SECONDS = 300, DAILY_KC_MIN = 50;
function dayKey(wallMs: number): string                          // local 'YYYY-MM-DD'
function nextLocalMidnight(wallMs: number): number               // ms epoch
function daysBetween(a: string, b: string): number               // calendar days b − a; 0 if either empty
function pickTasks(content, date: string): DailyDef[]            // 3 distinct kinds, deterministic from a hash of the date
function baselineFrom(stats: Stats): DailyBaseline
function progressOf(state, def: DailyDef): number
function isDone(state, def): boolean                             // skipped or progress ≥ target
function rollover(state, content, wallMs): GameState             // same state when the day has not changed
function claimDaily(state, content, taskId, kcPerSec): { state; vouchers: number; kc: Decimal }   // unchanged state + 0 when not claimable
function skipDaily(state, content, taskId): GameState            // same state if no token / claimed / already done
```
Kind → stat: `clicks→clicks, hire→staffHired, upgrades→upgradesBought, equip→equips, audit→audits, perk→perksBought, pulls→pulls`; progress = `stat − baseline[stat]` clamped ≥ 0. Rollover: if `dailies.date !== today`: `streak = (date && daysBetween(date, today) === 1 && completedToday) ? streak + 1 : (date ? 0 : streak)`; `bestStreak = max`; token if `!lastTokenDate || daysBetween(lastTokenDate, today) ≥ 7` → `skipTokens = min(1, +1)`, `lastTokenDate = today`; new tasks, `skipped = []`, `baseline = baselineFrom(stats)`, `completedToday = false`. Claim: mark claimed, `stats.dailiesClaimed + 1`, `kc += max(50, kcPerSec × 300)`, `grantVouchers(1)`; if all claimed → `completedToday = true` and if `(streak + 1) % 7 === 0` → `grantVouchers(3)` (the +1 anticipates tonight's settlement — comment it).

- [ ] **Step 1: Write failing tests**

`src/engine/dailies.test.ts`:
```ts
import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import { dayKey, nextLocalMidnight, daysBetween, pickTasks, rollover, claimDaily, skipDaily, progressOf, isDone, TASKS_PER_DAY } from './dailies';
import { voucherMult, grantVouchers } from './vouchers';

const now = { wall: 0, mono: 0 };
const T0 = new Date(2026, 8, 14, 10, 0, 0).getTime();
const day = (n: number) => T0 + n * 86_400_000;
const KIND_STAT = { clicks: 'clicks', hire: 'staffHired', upgrades: 'upgradesBought', equip: 'equips', audit: 'audits', perk: 'perksBought', pulls: 'pulls' } as const;

describe('day helpers', () => {
  it('formats local day keys and computes midnight and day gaps', () => {
    expect(dayKey(T0)).toBe('2026-09-14');
    expect(dayKey(nextLocalMidnight(T0))).toBe('2026-09-15');
    expect(nextLocalMidnight(T0)).toBeGreaterThan(T0);
    expect(daysBetween('2026-09-14', '2026-09-16')).toBe(2);
    expect(daysBetween('2026-09-14', '2026-09-14')).toBe(0);
    expect(daysBetween('', '2026-09-14')).toBe(0);
  });
  it('picks 3 tasks of distinct kinds deterministically per date', () => {
    const a = pickTasks(content, '2026-09-14'), b = pickTasks(content, '2026-09-14'), c = pickTasks(content, '2026-09-15');
    expect(a).toHaveLength(TASKS_PER_DAY);
    expect(new Set(a.map((t) => t.kind)).size).toBe(3);
    expect(a.map((t) => t.id)).toEqual(b.map((t) => t.id));
    expect(a.map((t) => t.id)).not.toEqual(c.map((t) => t.id));
  });
});

describe('rollover and progress', () => {
  it('assigns tasks and a baseline on the first day', () => {
    const s0 = createInitialState(now, content);
    const s = rollover({ ...s0, stats: { ...s0.stats, clicks: 40 } }, content, T0);
    expect(s.dailies.date).toBe('2026-09-14');
    expect(s.dailies.tasks).toHaveLength(3);
    expect(s.dailies.baseline.clicks).toBe(40);
    expect(rollover(s, content, T0 + 1000)).toBe(s);
  });
  it('measures progress from the baseline', () => {
    const s0 = rollover(createInitialState(now, content), content, T0);
    const def = content.dailies.find((d) => d.kind === 'clicks')!;
    expect(progressOf(s0, def)).toBe(0);
    const s1 = { ...s0, stats: { ...s0.stats, clicks: def.target + 5 } };
    expect(progressOf(s1, def)).toBe(def.target + 5);
    expect(isDone(s1, def)).toBe(true);
  });
  it('increments the streak only after a fully completed day, resets after a gap', () => {
    let s = rollover(createInitialState(now, content), content, T0);
    s = rollover({ ...s, dailies: { ...s.dailies, completedToday: true } }, content, day(1));
    expect(s.dailies.streak).toBe(1);
    s = rollover({ ...s, dailies: { ...s.dailies, completedToday: true } }, content, day(2));
    expect(s.dailies.streak).toBe(2);
    expect(s.dailies.bestStreak).toBe(2);
    s = rollover(s, content, day(4));
    expect(s.dailies.streak).toBe(0);
    expect(s.dailies.bestStreak).toBe(2);
  });
  it('grants one skip token per 7 days, capped at one', () => {
    let s = rollover(createInitialState(now, content), content, T0);
    expect(s.dailies.skipTokens).toBe(1);
    s = rollover(s, content, day(3));
    expect(s.dailies.skipTokens).toBe(1);
    s = rollover({ ...s, dailies: { ...s.dailies, skipTokens: 0 } }, content, day(6));
    expect(s.dailies.skipTokens).toBe(0);
    s = rollover(s, content, day(7));
    expect(s.dailies.skipTokens).toBe(1);
  });
});

describe('claim and skip', () => {
  const ready = () => {
    const s = rollover({ ...createInitialState(now, content), vouchers: 0 }, content, T0);
    const stats = { ...s.stats };
    for (const t of s.dailies.tasks) {
      const d = content.dailies.find((x) => x.id === t.id)!;
      const key = KIND_STAT[d.kind];
      stats[key] = s.dailies.baseline[key] + d.target;
    }
    return { ...s, stats };
  };
  it('pays vouchers and KC once per task and completes the day', () => {
    let s = ready();
    const ids = s.dailies.tasks.map((t) => t.id);
    const r1 = claimDaily(s, content, ids[0], new Decimal(2));
    expect(r1.vouchers).toBe(1);
    expect(r1.kc.toNumber()).toBe(600);
    s = r1.state;
    expect(s.vouchers).toBe(1);
    expect(s.stats.dailiesClaimed).toBe(1);
    expect(claimDaily(s, content, ids[0], new Decimal(2)).state).toBe(s);
    s = claimDaily(s, content, ids[1], new Decimal(0)).state;
    expect(s.kc.toNumber()).toBe(650);
    s = claimDaily(s, content, ids[2], new Decimal(0)).state;
    expect(s.dailies.completedToday).toBe(true);
  });
  it('refuses an unfinished task; skip spends a token', () => {
    const s0 = rollover({ ...createInitialState(now, content), vouchers: 0 }, content, T0);
    const id = s0.dailies.tasks[0].id;
    expect(claimDaily(s0, content, id, new Decimal(1)).state).toBe(s0);
    const s1 = skipDaily(s0, content, id);
    expect(s1.dailies.skipTokens).toBe(0);
    expect(claimDaily(s1, content, id, new Decimal(1)).vouchers).toBe(1);
    expect(skipDaily(s1, content, s1.dailies.tasks[1].id)).toBe(s1);
  });
  it('grants the streak bonus on every 7th consecutive day', () => {
    let s = { ...ready() };
    s = { ...s, dailies: { ...s.dailies, streak: 6 } };
    for (const t of s.dailies.tasks) s = claimDaily(s, content, t.id, new Decimal(0)).state;
    expect(s.vouchers).toBe(3 + 3);
  });
  it('voucher multiplier rounds up', () => {
    const s = { ...createInitialState(now, content), perks: ['requisition-1'] };
    expect(voucherMult(s, content)).toBeCloseTo(1.1);
    expect(grantVouchers(s, content, 1).vouchers).toBe(2);
    expect(grantVouchers(createInitialState(now, content), content, 1).vouchers).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement vouchers.ts and dailies.ts**

`vouchers.ts`:
```ts
import type { GameState } from './state';
import type { Content } from './content';
import { perkSum } from './perks';
import { cardVoucherMult } from './gacha';

export function voucherMult(state: GameState, content: Content): number {
  return 1 + perkSum(state, content, 'voucherMult') + cardVoucherMult(state, content);
}
export function grantVouchers(state: GameState, content: Content, base: number): GameState {
  if (base <= 0) return state;
  return { ...state, vouchers: state.vouchers + Math.ceil(base * voucherMult(state, content) - 1e-9) };
}
```
`dailies.ts`:
```ts
import Decimal from 'break_infinity.js';
import type { GameState, Stats, DailyBaseline } from './state';
import type { Content, DailyDef, DailyKind } from './content';
import { nextFloat } from './rng';
import { grantVouchers } from './vouchers';

export const TASKS_PER_DAY = 3;
export const STREAK_BONUS_EVERY = 7;
export const STREAK_BONUS_VOUCHERS = 3;
export const TOKEN_EVERY_DAYS = 7;
export const DAILY_VOUCHERS = 1;
export const DAILY_KC_SECONDS = 300;
export const DAILY_KC_MIN = 50;

export function dayKey(wallMs: number): string {
  const d = new Date(wallMs);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function nextLocalMidnight(wallMs: number): number {
  const d = new Date(wallMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
}
function parseKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
export function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.round((parseKey(b) - parseKey(a)) / 86_400_000);
}
function hashDate(key: string): number {
  let h = 2166136261;
  for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h || 1;
}
export function pickTasks(content: Content, date: string): DailyDef[] {
  const pool = [...content.dailies];
  const out: DailyDef[] = [];
  let seed = hashDate(date);
  while (out.length < TASKS_PER_DAY && pool.length) {
    const r = nextFloat(seed); seed = r.seed;
    const [def] = pool.splice(Math.min(pool.length - 1, Math.floor(r.value * pool.length)), 1);
    if (out.some((o) => o.kind === def.kind)) continue;
    out.push(def);
  }
  return out;
}
const STAT_FOR_KIND: Record<DailyKind, keyof DailyBaseline> = { clicks: 'clicks', hire: 'staffHired', upgrades: 'upgradesBought', equip: 'equips', audit: 'audits', perk: 'perksBought', pulls: 'pulls' };
export function baselineFrom(stats: Stats): DailyBaseline {
  return { clicks: stats.clicks, staffHired: stats.staffHired, upgradesBought: stats.upgradesBought, equips: stats.equips, audits: stats.audits, perksBought: stats.perksBought, pulls: stats.pulls };
}
export function progressOf(state: GameState, def: DailyDef): number {
  const key = STAT_FOR_KIND[def.kind];
  return Math.max(0, state.stats[key] - state.dailies.baseline[key]);
}
export function isDone(state: GameState, def: DailyDef): boolean {
  return state.dailies.skipped.includes(def.id) || progressOf(state, def) >= def.target;
}
export function rollover(state: GameState, content: Content, wallMs: number): GameState {
  const today = dayKey(wallMs);
  const d = state.dailies;
  if (d.date === today) return state;
  let streak = d.streak;
  if (d.date) streak = daysBetween(d.date, today) === 1 && d.completedToday ? streak + 1 : 0;
  const bestStreak = Math.max(d.bestStreak, streak);
  let skipTokens = d.skipTokens;
  let lastTokenDate = d.lastTokenDate;
  if (!lastTokenDate || daysBetween(lastTokenDate, today) >= TOKEN_EVERY_DAYS) { skipTokens = Math.min(1, skipTokens + 1); lastTokenDate = today; }
  return {
    ...state,
    dailies: { date: today, tasks: pickTasks(content, today).map((t) => ({ id: t.id, claimed: false })), skipped: [], streak, bestStreak, skipTokens, lastTokenDate, baseline: baselineFrom(state.stats), completedToday: false },
  };
}
export function claimDaily(state: GameState, content: Content, taskId: string, kcPerSec: Decimal): { state: GameState; vouchers: number; kc: Decimal } {
  const zero = { state, vouchers: 0, kc: new Decimal(0) };
  const task = state.dailies.tasks.find((t) => t.id === taskId);
  const def = content.dailies.find((x) => x.id === taskId);
  if (!task || !def || task.claimed || !isDone(state, def)) return zero;
  const kc = Decimal.max(new Decimal(DAILY_KC_MIN), kcPerSec.mul(DAILY_KC_SECONDS));
  const tasks = state.dailies.tasks.map((t) => (t.id === taskId ? { ...t, claimed: true } : t));
  const allClaimed = tasks.every((t) => t.claimed);
  let next: GameState = { ...state, kc: state.kc.add(kc), dailies: { ...state.dailies, tasks, completedToday: allClaimed }, stats: { ...state.stats, dailiesClaimed: state.stats.dailiesClaimed + 1 } };
  const before = next.vouchers;
  next = grantVouchers(next, content, DAILY_VOUCHERS);
  // streak + 1 anticipates tonight's rollover, which will count today as completed.
  if (allClaimed && (state.dailies.streak + 1) % STREAK_BONUS_EVERY === 0) next = grantVouchers(next, content, STREAK_BONUS_VOUCHERS);
  return { state: next, vouchers: next.vouchers - before, kc };
}
export function skipDaily(state: GameState, content: Content, taskId: string): GameState {
  const task = state.dailies.tasks.find((t) => t.id === taskId);
  const def = content.dailies.find((x) => x.id === taskId);
  if (!task || !def || task.claimed || state.dailies.skipTokens < 1 || isDone(state, def)) return state;
  return { ...state, dailies: { ...state.dailies, skipTokens: state.dailies.skipTokens - 1, skipped: [...state.dailies.skipped, taskId] } };
}
```
`actions.ts` `buyPerk`: add `stats: { ...state.stats, perksBought: state.stats.perksBought + 1 }`; assert in `perks.test.ts`.

- [ ] **Step 4: Run and commit**

```bash
git add src/engine
git commit -m "feat(engine): voucher multiplier, daily tasks with streaks, skip tokens and rewards"
git push origin main
```

---

### Task 4: Achievements and story engine

**Files:**
- Create: `src/engine/achievements.ts`, `src/engine/achievements.test.ts`, `src/engine/story.ts`, `src/engine/story.test.ts`
- Modify: `src/engine/economy.ts`, `src/engine/economy.test.ts`

**Interfaces:**
```ts
function isMet(state, content, cond: AchievementCondition | StoryTrigger): boolean
function checkAchievements(state, content): { state: GameState; unlocked: AchievementDef[] }   // same state if none
function achievementMult(state): Decimal                                                       // 1 + 0.01 × achievements.length
function checkStory(state, content): { state: GameState; unlocked: StoryDef[] }               // marks all newly met as seen, returns them in content order
```
`globalMult` × `achievementMult`.

- [ ] **Step 1: Write failing tests**

`src/engine/achievements.test.ts`:
```ts
import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import { checkAchievements, achievementMult, isMet } from './achievements';
const now = { wall: 0, mono: 0 };

describe('achievements', () => {
  it('unlocks souls milestones by Decimal comparison and grants vouchers once', () => {
    const s0 = { ...createInitialState(now, content), soulsLifetime: new Decimal('1e6') };
    const r = checkAchievements(s0, content);
    const ids = r.unlocked.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['a-souls-1', 'a-souls-2', 'a-souls-3', 'a-souls-4']));
    expect(r.state.achievements).toEqual(expect.arrayContaining(ids));
    expect(r.state.vouchers).toBe(r.unlocked.reduce((n, a) => n + (a.vouchers ?? 0), 0));
    expect(checkAchievements(r.state, content).state).toBe(r.state);
  });
  it('evaluates count-based conditions', () => {
    const b = createInitialState(now, content);
    const s = { ...b, staff: { dave: 25 }, cards: { 'c-keeper': 5, 'c-dave-overtime': 1 }, equipped: ['c-keeper'], perks: ['throughput-1'], dailies: { ...b.dailies, bestStreak: 7 } };
    expect(isMet(s, content, { type: 'staffOwned', staff: 'dave', target: 25 })).toBe(true);
    expect(isMet(s, content, { type: 'executivesOwned', target: 1 })).toBe(true);
    expect(isMet(s, content, { type: 'fiveStarCards', target: 1 })).toBe(true);
    expect(isMet(s, content, { type: 'cardsOwned', target: 3 })).toBe(false);
    expect(isMet(s, content, { type: 'bestStreak', target: 7 })).toBe(true);
    expect(isMet(s, content, { type: 'perksOwned', target: 2 })).toBe(false);
  });
  it('adds 1% per unlocked achievement', () => {
    expect(achievementMult({ ...createInitialState(now, content), achievements: ['a', 'b', 'c'] }).toNumber()).toBeCloseTo(1.03);
  });
});
```
`src/engine/story.test.ts`:
```ts
import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import { checkStory } from './story';
const now = { wall: 0, mono: 0 };
describe('story', () => {
  it('returns newly met memos in content order and marks them seen', () => {
    const r = checkStory({ ...createInitialState(now, content), soulsLifetime: new Decimal(2000) }, content);
    expect(r.unlocked.map((m) => m.id)).toEqual(['s-first-stamp', 's-deja-vu']);
    expect(r.state.storySeen).toEqual(['s-first-stamp', 's-deja-vu']);
    expect(checkStory(r.state, content).state).toBe(r.state);
  });
});
```
Append to `economy.test.ts`: `globalMult` with 5 achievement ids is `×1.05`.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

`achievements.ts`:
```ts
import Decimal from 'break_infinity.js';
import type { GameState } from './state';
import type { Content, AchievementDef, AchievementCondition, StoryTrigger } from './content';
import { grantVouchers } from './vouchers';

export function isMet(state: GameState, content: Content, cond: AchievementCondition | StoryTrigger): boolean {
  switch (cond.type) {
    case 'soulsLifetime': return state.soulsLifetime.gte(cond.target);
    case 'staffOwned': return (state.staff[cond.staff] ?? 0) >= cond.target;
    case 'cardsOwned': return Object.keys(state.cards).length >= cond.target;
    case 'executivesOwned': return content.cards.filter((c) => c.rarity === 'executive' && c.id in state.cards).length >= cond.target;
    case 'fiveStarCards': return Object.values(state.cards).filter((s) => s >= 5).length >= cond.target;
    case 'perksOwned': return state.perks.length >= cond.target;
    case 'departmentsUnlocked': return state.deptsUnlocked.length >= cond.target;
    case 'equipped': return state.equipped.length >= cond.target;
    case 'bestStreak': return state.dailies.bestStreak >= cond.target;
    case 'seals': return state.seals >= cond.target;
    case 'fiscalYear': return state.fiscalYear >= cond.target;
    default: return state.stats[cond.type] >= cond.target;
  }
}
export function checkAchievements(state: GameState, content: Content): { state: GameState; unlocked: AchievementDef[] } {
  const unlocked = content.achievements.filter((a) => !state.achievements.includes(a.id) && isMet(state, content, a.condition));
  if (unlocked.length === 0) return { state, unlocked };
  let next: GameState = { ...state, achievements: [...state.achievements, ...unlocked.map((a) => a.id)] };
  for (const a of unlocked) if (a.vouchers) next = grantVouchers(next, content, a.vouchers);
  return { state: next, unlocked };
}
export function achievementMult(state: GameState): Decimal {
  return new Decimal(1 + 0.01 * state.achievements.length);
}
```
`story.ts`:
```ts
import type { GameState } from './state';
import type { Content, StoryDef } from './content';
import { isMet } from './achievements';
export function checkStory(state: GameState, content: Content): { state: GameState; unlocked: StoryDef[] } {
  const unlocked = content.story.filter((m) => !state.storySeen.includes(m.id) && isMet(state, content, m.trigger));
  if (unlocked.length === 0) return { state, unlocked };
  return { state: { ...state, storySeen: [...state.storySeen, ...unlocked.map((m) => m.id)] }, unlocked };
}
```
`economy.ts` `globalMult`: `.mul(achievementMult(state))`.

- [ ] **Step 4: Run and commit**

```bash
git add src/engine
git commit -m "feat(engine): achievements with global bonus and vouchers; story memo triggers"
git push origin main
```

---

### Task 5: Store integration and notifications platform

**Files:**
- Create: `src/platform/notifications.ts`, `src/store/retention.test.ts`
- Modify: `src/store/game.ts`, `package.json` (`@capacitor/local-notifications@^7`)

**Interfaces:**
```ts
// platform/notifications.ts
interface NotificationItem { id: number; atWall: number; title: string; body: string }
interface Notifications { requestPermission(): Promise<boolean>; schedule(items: NotificationItem[]): Promise<void>; cancelAll(): Promise<void> }
const noopNotifications: Notifications; const capacitorNotifications: Notifications; function pickNotifications(): Notifications;
const NOTIF_INTRAY = 1, NOTIF_DAILY = 2;
// store additions
interface GameStore {
  ...existing;
  pendingPull: PullResult[] | null;
  pendingStory: StoryDef[];
  recentAchievements: AchievementDef[];
  mood: 'ok' | 'cooked';
  pull(count: 1 | 10): void; dismissPull(): void;
  equip(cardId: string): void; unequip(cardId: string): void;
  claimDaily(taskId: string): void; skipDaily(taskId: string): void;
  dismissStory(): void; clearAchievementToast(): void;
  setNotifOptIn(v: 'yes' | 'no'): Promise<void>;
  shouldAskNotifications(): boolean;   // settings.notifOptIn === 'unasked' && wall − firstSeenWallClock ≥ 2 days
}
StoreDeps gains `notifications?: Notifications` (default `pickNotifications()`).
```
Behaviour:
- Shared pipeline `settle(next)`: `rollover(next, content, wall)` → `checkAchievements` → `checkStory`; `apply(next)` runs `settle` and sets `state`, `rates`, appends `unlockedAch` to `recentAchievements` and `unlockedStory` to `pendingStory`. The tick loop runs `settle` only on every 10th fire (1 Hz); other fires set state + rates only.
- `memoPool(dept, fiscalYear, storySeen)`: also appends the `text` of seen story memos (all departments share them).
- `boot`/`resume`: after `creditOffline`, `settle`; set `mood = (capped || elapsedSec ≥ 43_200) ? 'cooked' : 'ok'`; `void notifications.cancelAll()`.
- `pause()`: after `save()`, if `settings.notifOptIn === 'yes'` schedule `[{ id: NOTIF_INTRAY, atWall: wall + offlineCapSeconds(state, content) × 1000, title: 'In-tray full', body: 'Your staff have stopped stamping. The backlog is waiting.' }, { id: NOTIF_DAILY, atWall: nextLocalMidnight(wall) + 300_000, title: 'Daily tasks reset', body: 'Three fresh tasks are on your desk.' }]`.
- `stamp()`: also `mood: 'ok'`.
- `pull(count)`: `pull(state, content, count, rates.kcPerSec)`; if results non-empty → `apply(state)` and `pendingPull = results`.
- `claimDaily(id)`: `claimDaily(state, content, id, rates.kcPerSec)` → `apply`.
- `setNotifOptIn('yes')`: `granted = await notifications.requestPermission()`; store `'yes'` if granted else `'no'`; `'no'` stores `'no'`; both via `apply` and `save()`.

- [ ] **Step 1: Write failing tests**

`src/store/retention.test.ts`:
```ts
import Decimal from 'break_infinity.js';
import { createGameStore } from './game';
import { memoryStorage } from '../platform/storage';
import { fakeClock } from '../engine/time';
import { content } from '../data';
import type { Notifications } from '../platform/notifications';

function fakeNotifications() {
  const calls: string[] = [];
  const n: Notifications = {
    requestPermission: async () => { calls.push('perm'); return true; },
    schedule: async (items) => { calls.push('schedule:' + items.map((i) => i.id).join(',')); },
    cancelAll: async () => { calls.push('cancel'); },
  };
  return { n, calls };
}
async function make(wall = new Date(2026, 8, 14, 10).getTime()) {
  const storage = memoryStorage();
  const clock = fakeClock({ wall, mono: 0 });
  const { n, calls } = fakeNotifications();
  const store = createGameStore({ content, storage, clock, tickMs: 1_000_000, autosaveMs: 1_000_000, notifications: n });
  await store.getState().boot();
  return { store, storage, clock, calls };
}

describe('retention store', () => {
  it('assigns dailies on boot and rolls over at midnight', async () => {
    const { store, clock } = await make();
    expect(store.getState().state.dailies.tasks).toHaveLength(3);
    const date = store.getState().state.dailies.date;
    clock.advance(24 * 3600 * 1000);
    store.getState().stamp();
    expect(store.getState().state.dailies.date).not.toBe(date);
    store.getState().stopLoop();
  });
  it('pulls, reveals, equips', async () => {
    const { store } = await make();
    store.setState({ state: { ...store.getState().state, vouchers: 9 } });
    store.getState().pull(10);
    expect(store.getState().pendingPull).toHaveLength(10);
    expect(store.getState().state.vouchers).toBe(0);
    const id = store.getState().pendingPull![0].cardId;
    store.getState().dismissPull();
    expect(store.getState().pendingPull).toBeNull();
    store.getState().equip(id);
    expect(store.getState().state.equipped).toEqual([id]);
    store.getState().unequip(id);
    expect(store.getState().state.equipped).toEqual([]);
    store.getState().stopLoop();
  });
  it('unlocks achievements and queues story memos after actions', async () => {
    const { store } = await make();
    store.setState({ state: { ...store.getState().state, soulsLifetime: new Decimal(999) } });
    store.getState().stamp();
    expect(store.getState().state.achievements).toContain('a-souls-1');
    expect(store.getState().recentAchievements.map((a) => a.id)).toContain('a-souls-1');
    expect(store.getState().pendingStory.map((m) => m.id)).toContain('s-deja-vu');
    store.getState().dismissStory();
    store.getState().clearAchievementToast();
    expect(store.getState().recentAchievements).toEqual([]);
    store.getState().stopLoop();
  });
  it('claims a finished daily', async () => {
    const { store } = await make();
    const s = store.getState().state;
    const clicksTask = s.dailies.tasks.map((t) => content.dailies.find((d) => d.id === t.id)!).find((d) => d.kind === 'clicks');
    if (!clicksTask) { store.getState().stopLoop(); return; }
    for (let i = 0; i < clicksTask.target; i++) store.getState().stamp();
    store.getState().claimDaily(clicksTask.id);
    expect(store.getState().state.vouchers).toBeGreaterThanOrEqual(1);
    store.getState().stopLoop();
  });
  it('sets cooked mood after a long absence and restores on stamp', async () => {
    const { store, clock } = await make();
    await store.getState().pause();
    clock.advance(13 * 3600 * 1000);
    await store.getState().resume();
    expect(store.getState().mood).toBe('cooked');
    store.getState().stamp();
    expect(store.getState().mood).toBe('ok');
    store.getState().stopLoop();
  });
  it('schedules notifications on pause only after opt-in, cancels on resume', async () => {
    const { store, calls } = await make();
    await store.getState().pause();
    expect(calls.filter((c) => c.startsWith('schedule'))).toHaveLength(0);
    await store.getState().setNotifOptIn('yes');
    expect(store.getState().state.settings.notifOptIn).toBe('yes');
    await store.getState().pause();
    expect(calls).toContain('schedule:1,2');
    await store.getState().resume();
    expect(calls.filter((c) => c === 'cancel').length).toBeGreaterThan(0);
    store.getState().stopLoop();
  });
  it('asks for notifications only after two days', async () => {
    const { store, clock } = await make();
    expect(store.getState().shouldAskNotifications()).toBe(false);
    clock.advance(2 * 86_400_000 + 1);
    expect(store.getState().shouldAskNotifications()).toBe(true);
    store.getState().stopLoop();
  });
  it('audit keeps cards, dailies, achievements and story', async () => {
    const { store } = await make();
    const s = store.getState().state;
    store.setState({ state: { ...s, soulsRun: new Decimal('1e13'), cards: { 'c-keeper': 2 }, equipped: ['c-keeper'], achievements: ['a-souls-1'], storySeen: ['s-first-stamp'] } });
    store.getState().audit();
    const a = store.getState().state;
    expect(a.cards).toEqual({ 'c-keeper': 2 });
    expect(a.equipped).toEqual(['c-keeper']);
    expect(a.achievements).toContain('a-souls-1');
    expect(a.storySeen).toContain('s-first-stamp');
    expect(a.dailies.date).toBe(s.dailies.date);
    store.getState().stopLoop();
  });
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement notifications.ts**

Install `@capacitor/local-notifications@^7`, then:
```ts
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface NotificationItem { id: number; atWall: number; title: string; body: string }
export interface Notifications {
  requestPermission(): Promise<boolean>;
  schedule(items: NotificationItem[]): Promise<void>;
  cancelAll(): Promise<void>;
}
export const NOTIF_INTRAY = 1;
export const NOTIF_DAILY = 2;

export const noopNotifications: Notifications = {
  async requestPermission() { return false; },
  async schedule() {},
  async cancelAll() {},
};
export const capacitorNotifications: Notifications = {
  async requestPermission() {
    const r = await LocalNotifications.requestPermissions();
    return r.display === 'granted';
  },
  async schedule(items) {
    await LocalNotifications.schedule({ notifications: items.map((i) => ({ id: i.id, title: i.title, body: i.body, schedule: { at: new Date(i.atWall) } })) });
  },
  async cancelAll() {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  },
};
export function pickNotifications(): Notifications {
  return Capacitor.isNativePlatform() ? capacitorNotifications : noopNotifications;
}
```

- [ ] **Step 4: Implement the store changes** per Behaviour. Pipeline sketch:
```ts
const settle = (next: GameState) => {
  const rolled = rollover(next, content, clock.wall());
  const a = checkAchievements(rolled, content);
  const st = checkStory(a.state, content);
  return { state: st.state, unlockedAch: a.unlocked, unlockedStory: st.unlocked };
};
const apply = (next: GameState) => {
  const r = settle(next);
  set((cur) => ({
    state: r.state,
    rates: computeRates(r.state, content, clock.wall()),
    recentAchievements: r.unlockedAch.length ? [...cur.recentAchievements, ...r.unlockedAch] : cur.recentAchievements,
    pendingStory: r.unlockedStory.length ? [...cur.pendingStory, ...r.unlockedStory] : cur.pendingStory,
  }));
};
```
Tick loop: keep a `fires` counter; on `fires % 10 === 0` run `apply(r.state)` (which settles) instead of the raw `set`. If the `@capacitor/local-notifications` import breaks jsdom, inline it in `vitest.config.ts` `server.deps.inline` like the other Capacitor packages.

- [ ] **Step 5: Run and commit**

```bash
git add src/store src/platform package.json package-lock.json vitest.config.ts
git commit -m "feat(store): gacha, dailies, achievements, story queue, moods and notification scheduling"
git push origin main
```

---

### Task 6: Personnel screen and pull reveal

**Files:**
- Create: `src/ui/screens/PersonnelScreen.tsx`, `src/ui/screens/PersonnelScreen.test.tsx`, `src/ui/components/CardTile.tsx`, `src/ui/overlays/PullReveal.tsx`, `src/ui/overlays/PullReveal.test.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/theme.css`

**Interfaces:**
- `<CardTile card stars owned equipped onClick />`: `<button aria-label="<name>, <title>">` with classes `tile rarity-<rarity> owned|locked equipped`, `Character` at 48 px (`card.character`), name, rarity label (`Temp`, `Full-Time`, `Senior Staff`, `Executive`), `<span aria-label="{stars} stars">★…</span>` when owned; unknown/unowned tiles show a `?` silhouette (`Character id="soul"`) and `locked` class.
- `<PersonnelScreen />`: header card — `Requisition Vouchers` count (`◇`), pity lines `Senior guaranteed in {PITY_SENIOR − pity.senior}` and `Executive guaranteed in {PITY_EXECUTIVE − pity.executive}`; buttons `aria-label="Draw one requisition"` (`1 ◇`) and `"Draw ten requisitions"` (`9 ◇`), disabled when unaffordable; "Equipped" row rendering `equipSlots` slots (filled slots are `CardTile`s that unequip on click; empty slots render text `Empty slot`); "Collection" grid of every card in content order (owned tiles equip on click; if no free slot show inline `sub` text `No free lanyard` for 2 s); "Odds" card listing `Temp 70%`, `Full-Time 22%`, `Senior Staff 6.5%`, `Executive 1.5%` and the two pity rules in one sentence each.
- `<PullReveal />`: nothing unless `pendingPull`; `role="dialog"` `aria-label="Requisition results"`; one row per result: `CardTile` + label `NEW` (starsAfter 1 and no duplicateKc) / `★ {starsAfter}` (2–5) / `+{formatNumber(kc)} KC` (duplicate); executive rows class `foil`; `pityTriggered` rows show `Guaranteed`; button `Back to Personnel` → `dismissPull()`.
- App: Personnel tab → `<PersonnelScreen />`; `<PullReveal />` mounted with the other overlays.

- [ ] **Step 1: Write failing tests**

`src/ui/screens/PersonnelScreen.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PersonnelScreen } from './PersonnelScreen';
import { useGame } from '../../store/game';
import { createInitialState, type GameState } from '../../engine/state';
import { computeRates } from '../../engine/economy';
import { content } from '../../data';

function seed(patch: Partial<GameState>) {
  const state = { ...createInitialState({ wall: 0, mono: 0 }, content), ...patch };
  useGame.setState({ state, rates: computeRates(state, content, 0), ready: true, pendingPull: null });
}
describe('PersonnelScreen', () => {
  it('disables pulls without vouchers and shows odds', () => {
    seed({ vouchers: 0 });
    render(<PersonnelScreen />);
    expect(screen.getByRole('button', { name: /draw one requisition/i })).toBeDisabled();
    expect(screen.getByText(/70%/)).toBeInTheDocument();
    expect(screen.getByText(/1\.5%/)).toBeInTheDocument();
  });
  it('pulls ten and opens the reveal', () => {
    seed({ vouchers: 9 });
    render(<PersonnelScreen />);
    fireEvent.click(screen.getByRole('button', { name: /draw ten requisitions/i }));
    expect(useGame.getState().pendingPull).toHaveLength(10);
    expect(useGame.getState().state.vouchers).toBe(0);
  });
  it('equips and unequips from the collection', () => {
    seed({ cards: { 'c-dave-overtime': 1 } });
    render(<PersonnelScreen />);
    fireEvent.click(screen.getByRole('button', { name: /^dave, reaper, double overtime$/i }));
    expect(useGame.getState().state.equipped).toEqual(['c-dave-overtime']);
    expect(screen.getAllByText(/empty slot/i)).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: /^dave, reaper, double overtime$/i })[0]);
    expect(useGame.getState().state.equipped).toEqual([]);
  });
  it('shows pity counters', () => {
    seed({ pity: { senior: 7, executive: 30 } });
    render(<PersonnelScreen />);
    expect(screen.getByText(/senior guaranteed in 3/i)).toBeInTheDocument();
    expect(screen.getByText(/executive guaranteed in 30/i)).toBeInTheDocument();
  });
});
```
`src/ui/overlays/PullReveal.test.tsx`: renders nothing when `pendingPull` is null; with two results (`{ cardId: 'c-dave-overtime', rarity: 'temp', starsAfter: 1, duplicateKc: null, pityTriggered: null }` and `{ cardId: 'c-keeper', rarity: 'executive', starsAfter: 5, duplicateKc: new Decimal(6000), pityTriggered: 'executive' }`) shows `NEW`, `+6,000 KC`, `Guaranteed`, a `.foil` row, and `Back to Personnel` clears `pendingPull`.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** the three components and styles. Suggested CSS: `.tile` grid `repeat(3, 1fr)` gap 8; rarity borders `.rarity-temp { border-color: var(--line) } .rarity-fulltime { border-color: var(--teal) } .rarity-senior { border-color: var(--brass) } .rarity-executive { border-color: var(--red) }`; `.tile.locked { opacity: .45; filter: grayscale(1) }`; `.tile.equipped { box-shadow: 0 0 0 2px var(--green) }`; `.foil { animation: foil 1.2s ease-in-out infinite alternate; background: linear-gradient(120deg, var(--surface), color-mix(in srgb, var(--brass) 30%, var(--surface))) }`; `.pity .bar-fill` widths from pity counters. Wire App.

- [ ] **Step 4: Run, visual check, commit**

Run `npm test`; `npm run dev` — seed vouchers via the save trick, pull ten, equip three, confirm Office rates change. Commit `feat(ui): Personnel tab with requisition pulls, reveal, collection and equip slots`.

---

### Task 7: Tasks screen, badges, story modal, toasts, moods

**Files:**
- Create: `src/ui/screens/TasksScreen.tsx`, `src/ui/screens/TasksScreen.test.tsx`, `src/ui/components/Badge.tsx`, `src/ui/components/Badge.test.tsx`, `src/ui/overlays/StoryMemo.tsx`, `src/ui/overlays/StoryMemo.test.tsx`, `src/ui/components/AchievementToast.tsx`, `src/ui/components/AchievementToast.test.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/components/StaffRow.tsx`, `src/ui/components/StaffRow.test.tsx` (create if absent), `src/ui/theme.css`

**Interfaces:**
- `<Badge kind tier locked size />`: inline SVG 64×64 trophy-style badge: a rosette/shield base filled by tier (1 `var(--line)`, 2 `var(--teal)`, 3 `var(--brass)`, 4 `var(--red)`), outline `var(--ink)` 2.5, and a glyph by kind (`stamp` rounded rect with a bar, `trophy` cup, `star` five-point star, `scroll` rolled paper, `flame` flame, `gear` six-tooth gear) in `var(--ink)`; `locked` → `opacity: .35; filter: grayscale(1)`. Attributes `data-kind`, `data-tier`, `data-locked`.
- `<TasksScreen />`: "Daily tasks" card — line `Streak: {streak} days · Best: {bestStreak}`, `Skip tokens: {skipTokens}`; three rows: text with `{n}` replaced by target, `.bar` progress `min(progress, target)/target`, `mono` `{progress}/{target}`, button `aria-label="Claim: <text>"` disabled unless `isDone && !claimed` (claimed rows show `Claimed`), button `aria-label="Skip: <text>"` only when `skipTokens > 0 && !isDone && !claimed`. "Achievements" card — header `{unlocked} / {total}`, grid of all achievements with `Badge`, name, desc (locked ones show name and desc dimmed).
- `<StoryMemo />`: `pendingStory[0]` as `role="dialog"` `aria-label="Memo"` with title (`Special Elite`), text, button `Filed` → `dismissStory()`.
- `<AchievementToast />`: `recentAchievements[0]` as `role="status"` with `Badge` + name for 3000 ms, then `clearAchievementToast()`.
- `StaffRow`: `mood` from `useGame((s) => s.mood)`.

- [ ] **Step 1: Write failing tests** — `TasksScreen`: claim disabled below target and enabled at target (seed `stats.clicks = baseline + target` for a clicks task, or seed a `dailies` object directly with a known task id), `Skip` visible only with a token and unfinished task, header `1 / 80` after seeding one achievement; `Badge`: attributes and locked styling; `StoryMemo`: dialog text and `Filed` dismiss; `AchievementToast`: shows then clears after 3 s with `vi.useFakeTimers()`; `StaffRow`: `data-mood="cooked"` when store `mood` is cooked.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement.** Badge glyphs ≤ 12 SVG elements each. Grid `repeat(4, 1fr)`.

- [ ] **Step 4: Run, visual check, commit** — `feat(ui): Tasks tab with dailies, trophy badges, story memos, toasts and moods`.

---

### Task 8: Settings sheet, notification opt-in, reduced motion

**Files:**
- Create: `src/ui/overlays/SettingsSheet.tsx`, `src/ui/overlays/SettingsSheet.test.tsx`, `src/ui/overlays/NotifPrompt.tsx`, `src/ui/overlays/NotifPrompt.test.tsx`
- Modify: `src/ui/components/CurrencyBar.tsx`, `src/ui/App.tsx`, `src/ui/theme.css`

**Interfaces:**
- `CurrencyBar` gets a gear `<button aria-label="Settings">` (top-right) that calls an `onSettings` prop; `OfficeScreen` and the other screens pass App's `openSettings`.
- `<SettingsSheet open onClose onGoToOdds />` (uses `Modal`): rows — Notifications (`<input type="checkbox" aria-label="Reminder notifications">` checked when `settings.notifOptIn === 'yes'`; change → `setNotifOptIn(checked ? 'yes' : 'no')`), Odds (`button` `See requisition odds` → `onGoToOdds()` which switches to the Personnel tab), Save (`Save v{saveVersion} · FY {fiscalYear} · {formatNumber(soulsLifetime)} souls lifetime`), Version (`APP_VERSION` constant exported from `src/version.ts` = package.json version, read via `import pkg from '../package.json'`), Privacy (`<a href="https://example.invalid/privacy">` placeholder; Plan 4 replaces), `Close`.
- `<NotifPrompt />`: renders when `shouldAskNotifications()` and no `pendingOffline`/`pendingPull`/`pendingStory[0]`/`lastAudit`; `role="dialog"` `aria-label="Reminders"`; buttons `Yes, remind me` → `setNotifOptIn('yes')`, `Not now` → `setNotifOptIn('no')`.
- `theme.css`: `@media (prefers-reduced-motion: reduce) { .slam, .foil, .float, .memo-text { animation: none } }`.

- [ ] **Step 1: Write failing tests** — gear opens the sheet; checkbox reflects and updates `notifOptIn` (fake the store's `setNotifOptIn`); `NotifPrompt` absent before two days, present after, gone after a choice.
- [ ] **Step 2–4:** run red, implement, run green, visual check, commit `feat(ui): settings sheet, notification opt-in prompt, reduced-motion support`.

---

## Self-review

**Spec coverage:** §7 gacha (cost, odds, pity, 30-card pool, stars, KC conversion, slots 3→8 via perks, reveal animation, odds disclosure, seeded RNG) — Tasks 1, 2, 6. §8 dailies (3/day, local midnight, KC + vouchers, streak, 7-day bonus, skip token), achievements (80, +1%, vouchers, trophy badges, grid), story (30, once as modal then ticker), moods, notifications (opt-in after day 2, ≤ 2 scheduled, cancel on resume) — Tasks 1, 3, 4, 5, 7, 8. §3 voucher income — Tasks 3, 4. §10 Personnel and Tasks tabs, settings overlay — Tasks 6, 7, 8. §12 save v4 — Task 1. Play Games / Game Center achievement mirroring and the ad-driven free pull — Plan 4.

**Placeholder scan:** Tasks 6–8 specify components by props, aria labels, classes, text and test intents rather than full source; every name a later task or test depends on is stated. Story memo bodies are given as beats; the implementer writes the one-to-two-sentence texts in the memo voice already used in the department files.

**Type consistency:** `PullResult` (Task 2) → store `pendingPull` (Task 5) → `PullReveal` (Task 6); `DailyKind`→`DailyBaseline` key map (Task 3) matches `Stats`/`DailyBaseline` (Task 1); `AchievementDef`/`StoryDef` from Task 4 queued in Task 5 and rendered in Task 7; `equipSlots` (Task 2) used by `PersonnelScreen` (Task 6); `Notifications` (Task 5) injected via `StoreDeps.notifications`; `stats.perksBought` incremented in Task 3 and consumed by the `perk` daily kind; `memoPool` gains a `storySeen` parameter in Task 5.

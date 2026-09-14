# Afterlife Bureaucracy Inc. — Game Design Spec

**Date:** 2026-09-14
**Platform:** Android (Capacitor 7, target SDK 36), web build for development
**Stack:** Vite + React 18 + TypeScript, zustand, break_infinity.js, vitest
**Source concept:** `afterlife-bureaucracy-design-doc.md` (v1 scope doc). This spec supersedes it and expands it into a multi-year live-ops design.

## 1. Vision

An idle clicker set in the afterlife's DMV. The player runs a soul-processing bureau: stamp souls manually, hire idle staff, buy upgrades, unlock departments, file annual audits (prestige), and collect staff through a requisition lottery (gacha). Dark-comedy office satire throughout.

Design goal: **players keep returning for years.** Achieved through nested progression loops at different time scales, so that there is always a near goal (minutes), a medium goal (days) and a long goal (weeks or months), and through content delivered as data files that can grow without code changes.

Session model: **check-in idle.** 3–5 short sessions per day, 2–5 minutes each. Offline earnings are capped so returning matters. Clicking stays relevant at every stage but is never mandatory.

Decisions already made:
- Monetization: rewarded ads + in-app purchases. No interstitials in v1.
- Backend: none. Fully on-device logic. Google Play Games Services for cloud save, achievements and leaderboards. Event configuration is a static JSON file on a CDN with a bundled fallback.
- Art: all characters, icons and stamps are inline SVG authored in code. Two mood faces per character via layer toggle.

## 2. Progression loops

| Time scale | Loop | Player goal |
|---|---|---|
| Minutes | Stamp, buy staff, buy upgrades, hit staff milestones | "Next milestone at 25 Daves" |
| Hours | Unlock departments (Heaven, Hell, Reincarnation, Limbo) | "500K more souls to Hell Compliance" |
| Days | Fiscal Year Audit (prestige) → Karma Seals → Perk Ledger | "Audit at 1M gives 4 seals, buy Offline cap perk" |
| Weeks | Gacha collection, rank up duplicates, equip loadout | "Need 2 more Seraphine dupes for 3-star" |
| Ongoing | Daily tasks, streak, achievements, memo story arc, weekly events | "3 more dailies for streak bonus" |
| Months | Cosmic Restructuring (second prestige tier), new afterlife branches | "100 Seals unlocks Cosmic" |

## 3. Currencies

| Currency | Type | Earned | Spent | Reset on Audit |
|---|---|---|---|---|
| Karma Credits (KC) | soft | stamps, staff per second | staff, upgrades | yes |
| Souls Processed | score | same events as KC | never (gates unlocks, achievements) | per-run counter resets; lifetime never |
| Karma Seals | prestige | Fiscal Year Audit | Perk Ledger | no (reset only by Cosmic Restructuring) |
| Requisition Vouchers | premium | daily tasks, achievements, events, ads, IAP | gacha pulls, time skips | no |

## 4. Economy math

All numbers are `Decimal` from break_infinity.js so the game survives values beyond 1e308 over years of prestige.

**Producers (staff).**
- Cost of the next unit: `baseCost × 1.15^owned`.
- Output per second: `baseRate × owned × milestoneMult × deptMult × globalMult`.
- Milestone multiplier: ×2 at 10, 25, 50, 100, 200, 300, 400, 500, then every 100. Displayed as "next milestone" progress on each staff row.
- Buy modes: ×1, ×10, ×max.

**Click power.** `clickPower = (1 + staplerLevel) + 0.01 × totalPassivePerSecond × clickPerk`. The passive fraction keeps clicks meaningful late game.

**Global multiplier** is the product of: Seal bonus (1 + 0.02 × seals) × Perk Ledger multipliers × equipped gacha card bonuses × achievement bonus (1 + 0.01 × unlocked) × active event bonus × ad boost (×2 while Overtime Boost active) × subscription bonus.

**Karma Credit rate** equals soul rate for clicks and 0.4 × soul rate for passive income, as in the original doc.

**Offline earnings.**
- Base cap 4 hours. Upgrades extend to 8, 12, 24 hours. Perk Ledger extends to 48 hours.
- Offline rate is 50% of online rate; upgradeable to 100%. Remove-Ads purchase grants a permanent ×2 on offline earnings.
- On return after ≥ 60 seconds away, show the "Overnight Backlog Report" modal with the amount earned and a rewarded-ad ×2 button.

**Pacing targets** (validated by the balance simulator, section 13): first department unlock within 15 minutes of play; first Audit available on day 2–3 for a check-in player; each subsequent department 2–4 hours of play apart on a fresh run; a run after 20 Seals reaches the Audit threshold roughly 3× faster than the first run.

**Number formatting.** Plain up to 999,999; then K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc; then letters aa, ab, ac… Numbers in IBM Plex Mono with tabular figures, and the displayed value lerps toward the true value each animation frame.

## 5. Departments

Five departments in v1, each defined entirely in `src/data/departments/*.json`. Adding a department later is a data change only.

| Department | Unlock (souls this run) | Accent colour | Flavor |
|---|---|---|---|
| Intake | start | ledger green `#1F3B33` | Dave (Reaper, Overtime), Seraphine (Angel, Temp), Gary (Demon Intern), The Auditor (Bribed) |
| Heaven Admissions | 10,000 | soul teal `#3E9C93` | angels, Cloud Nine Staffing temps, choir HR |
| Hell Compliance | 250,000 | stamp red `#A6402B` | unionized demons, torment QA, pitchfork logistics |
| Reincarnation Desk | 10,000,000 | brass `#A8823C` | karma accountants, golden-retriever placement officers |
| Limbo Records | 500,000,000 | grey-violet `#6B6478` | archivists, souls who forgot to leave, lost-and-found |

Each department has:
- 4–6 staff producers with base cost, base rate, name, role, flavor line, SVG character id and two mood faces.
- 3–6 upgrades (click power, department rate, offline cap, offline rate).
- A flavor-queue pool of 15+ one-line soul requests.
- A memo pool of 15+ ticker lines.
- A department multiplier applied to its own staff, raised by its upgrades.

Departments are shown as chips at the top of the Office tab. A locked department shows its unlock threshold and progress.

## 6. Prestige: Fiscal Year Audit

- Available when souls processed this run ≥ 1,000,000.
- Seals awarded on Audit: `floor(sqrt(soulsThisRun / 1e6))`, so seals scale with the square root of run size. The Ledger tab shows "Audit now for +N Seals" live.
- Reset: KC, staff counts, upgrades, department unlocks, souls-this-run, offline cap upgrades. Keep: Seals, Perk Ledger purchases, gacha collection and equips, achievements, vouchers, lifetime statistics, fiscal year counter, settings.
- Each Seal held grants +2% global multiplier passively.
- **Perk Ledger:** a tree defined in `src/data/perks.json`, about 40 nodes in v1, five branches: Throughput (rate multipliers), Overtime (offline cap and rate), Stapler (click power), Requisition (voucher income and gacha discounts), Head Start (start each run with departments or staff pre-unlocked). Node cost in Seals; prerequisites by node id.
- Audit ceremony: full-screen overlay, stamp slams "APPROVED", paper burst animation, fiscal year counter increments, then a fresh Intake office. Memo pools include year-specific lines so later years read differently.

**Cosmic Restructuring (second tier).** Unlocked at 100 Seals. Resets Seals and Perk Ledger for Cosmic Clauses, each granting large multipliers and unlocking new afterlife branches (Valhalla first). The data model (`cosmicClauses`, `branchesUnlocked` in the save) ships in v1.0; the UI ships in v1.2.

## 7. Gacha: Personnel Requisition Lottery

- Cost: 1 voucher per single pull; 9 vouchers per 10-pull.
- Rarities and odds: Temp 70%, Full-Time 22%, Senior Staff 6.5%, Executive 1.5%. Odds are shown in-app on an Odds screen (Play Store requirement).
- Pity: guaranteed Senior Staff or better within every 10 pulls; guaranteed Executive within every 60 pulls. Pity counters persist across sessions and audits.
- Pool: about 30 named staff cards in v1, 6–8 per department, defined in `src/data/cards.json`. Each card grants a passive bonus: department output %, offline cap hours, click power %, voucher income %, or (Executive only) global %.
- Duplicates raise the card's rank from 1 to 5 stars; each star scales the bonus. Extra duplicates past 5 stars convert to KC.
- Equip slots: 3 at start, up to 8 through Perk Ledger. Only equipped cards apply their bonus.
- Reveal animation: filing drawer slides open, envelope rises, a stamp reveals the rarity colour; Executive pulls get a gold-foil shake and confetti of forms.
- Free-to-play voucher income target: about 3 per day from dailies, achievements and the daily rewarded-ad pull, so a free single pull every day or so and a 10-pull roughly monthly.
- RNG: seeded xorshift so unit tests can verify odds and pity deterministically.

## 8. Retention systems

**Daily tasks.** Three per day, drawn from a pool in `src/data/dailies.json` (stamp N souls, buy N staff, watch 1 ad, equip a card, reach N souls per second). Reset at local midnight. Rewards: KC scaled to current rate, plus vouchers. Streak counter with a bonus voucher pack at 7-day streaks; one missed day breaks the streak, one skip token per week protects it.

**Achievements.** About 80 in v1 in `src/data/achievements.json`: souls milestones, staff counts, audits filed, cards collected, ads watched, streaks. Each grants +1% permanent global multiplier and some grant vouchers. Trophy-style badge icons (SVG), grid on the Tasks tab. Mirrored to Play Games achievements.

**Memo story arc.** About 120 memo lines in v1; about 30 are story memos unlocked by milestones and shown once as a modal before entering the ticker rotation. Arc: clearing the backlog destabilises the mortal realm → reality bugs → the bribed Auditor's true role → Cosmic Restructuring foreshadowing. The rest are random flavor, weighted by department and fiscal year.

**Character moods.** Staff portraits flip to their second face when the offline cap is reached or when the player has been away 12+ hours, and flip back on interaction.

**Local notifications** (Capacitor Local Notifications, opt-in prompt after day 2): offline cap reached, daily tasks reset, Audit available. Maximum 2 per day.

**Weekly events (v1.1).** A 3-day "Overflow" department appears with its own progress, event-only cards, and a Play Games leaderboard. Event definitions are fetched from a static JSON URL at launch with a bundled fallback; no server logic.

## 9. Monetization

**Rewarded ads** (Google AdMob through a Capacitor plugin). No interstitials or banners in v1.
- Overnight Backlog Report ×2.
- Overtime Boost: ×2 rate for 4 hours, 4-hour cooldown.
- One free single gacha pull per day.
- Skip one daily task.

**In-app purchases** (Google Play Billing 8+, via RevenueCat or the Capacitor community billing plugin; decide at implementation time based on plugin health).
- Voucher packs: 10, 55, 120, 300.
- Remove Ads (one-time, about $4.99): grants the permanent ×2 offline bonus and hides all ad prompts except the optional rewarded buttons.
- Starter Pack: offered once, days 1–3: vouchers, one Senior Staff card, KC.
- Union Membership (monthly subscription): daily vouchers, +25% global rate, daily tasks auto-collect.

Purchases are validated locally through the billing library; there is no server receipt validation.

## 10. Screens

Portrait only. Bottom tab bar with five tabs.

1. **Office.** Department chips at top. Intake queue card showing the current flavor line. Large stamp button (the primary click target) with a stamp-slam animation and floating "+N" text. Staff list with buy ×1/×10/×max, milestone progress bars, mood faces. Upgrades section. Memo ticker fixed at the bottom.
2. **Personnel.** Pull buttons, pity counters, collection grid with rank stars, equip slots, Odds screen link.
3. **Ledger.** Seals held, live "Audit now for +N" button, Perk Ledger tree, Cosmic panel (locked placeholder in v1.0).
4. **Tasks.** Daily tasks with progress, streak, achievements grid with badges.
5. **Store.** Voucher packs, Remove Ads, Starter Pack, Union Membership, restore purchases.

Overlays: Overnight Backlog Report, Audit ceremony, gacha reveal, story memo, settings (sound, haptics, cloud save sync, notifications, odds, privacy policy, credits).

Visual direction follows the concept doc: parchment palette, Special Elite for headers, IBM Plex Sans for body, IBM Plex Mono for numbers, ink-stamp SVG characters with bold outlines and one or two flat fills. A dark theme mirrors the palette with brighter accents. Fonts are bundled locally, not fetched.

## 11. Architecture

```
src/
  engine/      Pure TypeScript, no React, no platform imports.
               GameState type, tick(), cost and rate math, milestones,
               offline calculation, audit/prestige, gacha RNG and pity,
               daily task evaluation, achievement checks, save migration.
  data/        JSON content: departments, staff, upgrades, perks, cards,
               achievements, dailies, memos, flavor lines, IAP catalogue.
  store/       zustand store that owns GameState, runs the tick loop,
               persists saves, and exposes actions to the UI.
  ui/          React screens, components, SVG characters and icons,
               animations, theming.
  platform/    Capacitor wrappers behind interfaces: Ads, Billing,
               CloudSave, Notifications, Haptics. Each has a web no-op
               or mock implementation so the game runs in a browser.
  sim/         Headless balance simulator (npm run sim).
```

- Engine tick runs at 10 Hz on a `setInterval`; the UI lerps displayed numbers with `requestAnimationFrame`.
- The engine is a set of pure functions `(state, input) => state`; the store applies them. This keeps the engine fully unit-testable.
- Content JSON is validated at build time with zod schemas; a bad content file fails the build, not the player.

## 12. Save, cloud and integrity

- Save format: versioned JSON (`saveVersion` integer) with a migration chain in `engine/migrations.ts`. Every version bump adds a migration and a test fixture.
- Autosave every 10 seconds and on `appStateChange` to background. Stored with Capacitor Preferences (web: localStorage).
- Cloud save through Play Games Saved Games. On sign-in or manual sync, if local and cloud differ, keep the one with higher lifetime Souls Processed and inform the player.
- Clock integrity: saves carry `lastSeenWallClock` and a monotonic `uptimeAtSave`. On load, if wall clock moved backwards, or the offline gap is implausible relative to uptime, offline earnings for that gap are zero. Overtime Boost timers use monotonic time. Without a server, some cheating is accepted.

## 13. Testing and balance

- vitest for the engine: cost curves, milestone multipliers, click power, offline cap and rate, audit seal formula, Perk Ledger prerequisites, gacha odds (100,000 seeded pulls within tolerance of the published odds) and pity guarantees, daily reset boundaries, save migrations from every prior fixture.
- Content schema tests: every JSON file parses against its zod schema; every referenced id (perk prerequisites, card department, achievement targets) resolves.
- Balance simulator `npm run sim`: models a check-in player (5 sessions/day, 3 minutes, greedy buying) and an active player, prints day-by-day table of souls, KC, departments unlocked, audits filed and seals. Pacing targets in section 4 are asserted by a test that runs the simulator.
- UI: React Testing Library smoke tests for each tab and overlay; manual device pass on Android before each release.

## 14. Release phasing

- **v1.0** — everything above except weekly events and the Cosmic Restructuring UI. Store-ready: privacy policy, odds disclosure, data-safety form, adaptive icon, screenshots.
- **v1.1** — weekly events with CDN config and Play Games leaderboard.
- **v1.2** — Cosmic Restructuring UI and the Valhalla branch (new department data plus Cosmic Clauses).

## 15. Out of scope

Multiplayer, guilds, real-time chat, server-authoritative economy, iOS (deferred until Android proves retention), localisation beyond English (data files are structured for it later).

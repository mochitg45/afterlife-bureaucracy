# Afterlife Bureaucracy Inc. — Game Design Spec

**Date:** 2026-09-14
**Platform:** Android (Capacitor 7, target SDK 36) and iOS (Capacitor 7, iOS 15+), web build for development. Android is the first store release; the iOS project is kept buildable from the same web bundle so an App Store release needs only a Mac, signing, and the iOS-side plugin configuration.
**Stack:** Vite + React 18 + TypeScript, zustand, break_infinity.js, vitest
**Source concept:** `afterlife-bureaucracy-design-doc.md` (v1 scope doc). This spec supersedes it and expands it into a multi-year live-ops design.

## 1. Vision

An idle clicker set in the afterlife's DMV. The player runs a soul-processing bureau: stamp souls manually, hire idle staff, buy upgrades, unlock departments, file annual audits (prestige), and collect staff through a requisition lottery (gacha). Dark-comedy office satire throughout.

Design goal: **players keep returning for years.** Achieved through nested progression loops at different time scales, so that there is always a near goal (minutes), a medium goal (days) and a long goal (weeks or months), and through content delivered as data files that can grow without code changes.

Session model: **check-in idle.** 3–5 short sessions per day, 2–5 minutes each. Offline earnings are capped so returning matters. Clicking stays relevant at every stage but is never mandatory.

Decisions already made:
- Monetization: rewarded ads + in-app purchases. No interstitials in v1.
- Backend: none. Fully on-device logic. Platform game services for cloud save, achievements and leaderboards: Google Play Games Services on Android, Game Center plus iCloud key-value storage on iOS, behind one `CloudSave`/`Achievements` interface in `src/platform`. Event configuration is a static JSON file on a CDN with a bundled fallback.
- Art: all characters, icons and stamps are inline SVG authored in code. Two mood faces per character via layer toggle.

## 2. Progression loops

| Time scale | Loop | Player goal |
|---|---|---|
| Minutes | Stamp, buy staff, buy upgrades, hit staff milestones | "Next milestone at 25 Daves" |
| Hours | Unlock departments (Heaven, Hell, Reincarnation, Limbo) | "500K more souls to Hell Compliance" |
| Days | Fiscal Year Audit (prestige) → Karma Seals → Perk Ledger | "Audit at 8 Qa gives 16 seals, buy Offline cap perk" |
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

**Pacing targets** (validated by the balance simulator, section 13, which models a check-in player: 5 sessions of 3 minutes per day, 3 stamps per second, greedy buying, auditing as soon as the Audit is available, spending Seals on the cheapest affordable perk, taking the Seal Clauses first and the rest in content order, claiming every finished daily, taking all four rewarded placements as often as their own gates allow — `offline-double` on every return, `overtime-boost` whenever its cooldown has cleared, the daily `free-pull`, and one `daily-skip` on a task the day never finished — spending vouchers on pulls, and filing a Cosmic Restructuring the moment the Bureau will hear one). Targets, over 30 simulated days:
- Heaven Admissions unlocks within 15 minutes of play.
- The first Audit becomes available on day 2 or 3 (never on day 1).
- Hell Compliance unlocks during the first run, before the first Audit.
- Reincarnation Desk does not unlock before fiscal year 2, and Limbo Records not before fiscal year 3; both unlock by day 14.
- A run started with 20 Seals and the first two Throughput perks plus the first two Head Start perks reaches the Audit threshold at least 1.3× faster (in played seconds) than the first run.
- The prestige loop compounds: each of the first five runs reaches its Audit threshold in at most 0.85× the played seconds the previous run needed.
- The simulator's second profile — an active player, 2 sessions of 30 minutes a day at 5 stamps per second over 14 days — is held to the weaker version of the same target, that no run is *slower* than the one before it (ratio ≤ 1.0), plus the Seal cap; its fortnight is too short for the 30-day Cosmic and faucet windows.
- The first Cosmic Restructuring is available between day 8 and day 30, and between two and five Restructurings are filed inside the first 30 days. Fewer than two and the second tier is a rumour; more than five and a ceremony that hands back every Seal and Perk stops meaning anything.
- The recurring voucher faucet — the three daily tasks plus the seven-day streak pack — pays a free player 20–40 vouchers a day averaged over days 3–14. Achievement grants are a separate one-off budget (1,700 vouchers across the 80 unlocks) that lands on top of this, mostly in the first fortnight.
- No Audit pays more than the cap in force at that filing: `SEAL_CAP_PER_AUDIT` (120) multiplied by the Clause Seal multiplier the run held.

Tunable to meet these: staff `baseCost`/`baseRate` in every department (Intake's Dave and Seraphine stay at 15 / 0.5 and 100 / 2 because tests and tutorial copy depend on them), upgrade costs, Perk Ledger node costs, Cosmic Clause values, the Reincarnation, Limbo and Valhalla unlock thresholds (the values in section 5 are starting points), the five prestige constants of section 6 — Audit base threshold, seal coefficient, seal exponent, year growth and the per-Audit Seal cap — and the Cosmic threshold formula. Fixed: the 1.15 cost growth, the milestone table, Heaven and Hell thresholds, Seal bonus, perk effect values, the achievement voucher grants.

**Number formatting.** Plain up to 999,999; then K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc; then letters aa, ab, ac… Numbers in IBM Plex Mono with tabular figures, and the displayed value lerps toward the true value each animation frame.

## 5. Departments

Five departments in v1, each defined entirely in `src/data/departments/*.json`. Adding a department later is a data change only.

| Department | Unlock (souls this run) | Accent colour | Flavor |
|---|---|---|---|
| Intake | start | ledger green `#1F3B33` | Dave (Reaper, Overtime), Seraphine (Angel, Temp), Gary (Demon Intern), The Auditor (Bribed) |
| Heaven Admissions | 10,000 | soul teal `#3E9C93` | angels, Cloud Nine Staffing temps, choir HR |
| Hell Compliance | 250,000 | stamp red `#A6402B` | unionized demons, torment QA, pitchfork logistics |
| Reincarnation Desk | 9,600,000,000,000,000 | brass `#A8823C` | karma accountants, golden-retriever placement officers |
| Limbo Records | 240,000,000,000,000,000 | grey-violet `#6B6478` | archivists, souls who forgot to leave, lost-and-found |

Each department has:
- 4–6 staff producers with base cost, base rate, name, role, flavor line, SVG character id and two mood faces.
- 3–6 upgrades (click power, department rate, offline cap, offline rate).
- A flavor-queue pool of 15+ one-line soul requests.
- A memo pool of 15+ ticker lines.
- A department multiplier applied to its own staff, raised by its upgrades.

Departments are shown as chips at the top of the Office tab. A locked department shows its unlock threshold and progress.

## 6. Prestige: Fiscal Year Audit

- The threshold rises every fiscal year: `auditThreshold(year) = AUDIT_BASE × YEAR_GROWTH^(year − 1)`, with `AUDIT_BASE = 8,000,000,000,000,000` (8 Qa) and `YEAR_GROWTH = 1.5`. Year 1 asks for 8 Qa, year 2 for 12 Qa, year 3 for 18 Qa, and so on — a run has to out-earn the one before it, which is what makes the loop compound instead of flattening. The growth has to be steep because the Backlog Report dominates a check-in player's income: one four-hour-plus gap is worth tens of thousands of seconds of online rate, so souls jump by orders of magnitude at every session boundary, and a gentler growth let a mature player close a fiscal year inside a single session five times a day — which banked Seals faster than any Cosmic threshold could rise.
- Available when souls processed this run ≥ `auditThreshold(fiscalYear)`.
- Seals awarded on Audit: `min(sealCap(clauseSealMult), floor(SEAL_COEFF × (soulsThisRun / AUDIT_BASE)^SEAL_EXP × clauseSealMult))`, where `sealCap(m) = SEAL_CAP_PER_AUDIT × m`, with `SEAL_COEFF = 60`, `SEAL_EXP = 0.4` and `SEAL_CAP_PER_AUDIT = 120` (the cap was raised from 80 in Plan 7 to compensate for duplicate-based star-ups making equipped cards a slower source of income, and the coefficient from 40 to 60 in the round-1 fix wave so that the active player's early runs — whose payouts sit below the cap — also compound instead of stalling). A run that lands exactly on the year-1 threshold pays 60 Seals; the exponent below 0.5 means a run that overshoots by orders of magnitude does not hand out a lifetime of Seals at once, while measuring against `AUDIT_BASE` rather than the year's own threshold keeps later years paying more for the same work. The cap is the hard stop above that: every Seal held is +2% global multiplier for good, so an uncapped payout on a heavily overshot run feeds straight into the next overshoot — the simulator showed the loop collapsing into three-second fiscal years inside a week without it. The cap scales with the Clause Seal multiplier rather than sitting flat above it, because a Clause that promises "Audits pay double" has to mean it: a flat ceiling silently cancelled the entire purchase for any run already at it. The multiplier is bounded at ×3 (×1.5 × ×2 across the two Seal Clauses) and gated behind Cosmic Restructuring, so the runaway stays shut. The Ledger tab shows "Audit now for +N Seals" live.
- Reset: KC, staff counts, upgrades, department unlocks, souls-this-run, offline cap upgrades. Keep: Seals, Perk Ledger purchases, gacha collection and equips, achievements, vouchers, lifetime statistics, fiscal year counter, settings.
- Each Seal held grants +2% global multiplier passively.
- **Perk Ledger:** a tree defined in `src/data/perks.json`, about 40 nodes in v1, five branches: Throughput (rate multipliers), Overtime (offline cap and rate), Stapler (click power), Requisition (voucher income and gacha discounts), Head Start (start each run with departments or staff pre-unlocked). Node cost in Seals; prerequisites by node id.
- Audit ceremony: full-screen overlay, stamp slams "APPROVED", paper burst animation, fiscal year counter increments, then a fresh Intake office. Memo pools include year-specific lines so later years read differently.

**Cosmic Restructuring (second tier).** The first is unlocked at 100 Seals, and each filing multiplies the bar by `COSMIC_THRESHOLD_GROWTH`: `cosmicThreshold(filings) = 100 × 2.5^filings`, so 100, 250, 625, 1563, 3906, … Every reader — the Bureau's own check, the Ledger's Cosmic panel and the ceremony that announces the next one — goes through that one function, so the number on screen is always the number the filing will check. A flat 100 turned into a treadmill the moment the Perk Ledger was doing its work: the simulator filed eight Restructurings in the first month. The growth has to outrun its own reward, because each filing raises Seal income too — a Cosmic Point buys a Seal Clause, which lifts both the payout and the cap it is measured against.

A Restructuring also opens a **new fiscal calendar**: the fiscal year goes back to 1 along with the office. It has to, because a Restructuring wipes the Seal bonus and the entire Perk Ledger — leaving the player in fiscal year 31 with a fresh Intake desk meant a threshold their new staff could not approach for the better part of a week, so the reward for filing was a dead stretch. What survives is everything that is neither this run nor the Perk Ledger: lifetime souls, vouchers, the gacha collection and equips, achievements, Clauses, unlocked branches, `stats.cosmics` and every other lifetime statistic. Resets Seals and Perk Ledger for Cosmic Clauses, each granting large multipliers and unlocking new afterlife branches (Valhalla first). The data model (`cosmicClauses`, `branchesUnlocked` in the save), the Cosmic panel on the Ledger, the ceremony and the Valhalla branch all ship in v1.0.

## 7. Gacha: Personnel Requisition Lottery

- Cost: 10 vouchers per single pull; 90 vouchers per 10-pull. (Playtest round 1, 2026-09-20: every voucher amount in the game was scaled ×10 so the numbers read as a currency; daily claim 10, streak pack 30, starter pack 200, IAP packs 100/550/1200/3000.)
- Rarities and odds: Temp 70%, Full-Time 24.5%, Senior Staff 5%, Executive 0.5% (playtest round 1; executives come mostly from the 60-pull guarantee). Odds are shown in-app on an Odds screen (Play Store requirement).
- Pity: guaranteed Senior Staff or better within every 10 pulls; guaranteed Executive within every 60 pulls. Pity counters persist across sessions and audits.
- Pool: about 30 named staff cards in v1, 6–8 per department, defined in `src/data/cards.json`. Each card grants a passive bonus: department output %, offline cap hours, click power %, voucher income %, or (Executive only) global %.
- Duplicates raise the card's rank from 1 to 5 stars; each star scales the bonus. Each star-up costs more duplicates than the last — 1/2/3/5 to go ★1→★2/★2→★3/★3→★4/★4→★5 — banked as shards shown alongside the card ("2/3") until the threshold is met. Extra duplicates past 5 stars convert to KC.
- Equip slots: 3 at start, up to 8 through Perk Ledger. Only equipped cards apply their bonus.
- Reveal animation: filing drawer slides open, envelope rises, a stamp reveals the rarity colour; Executive pulls get a gold-foil shake and confetti of forms.
- Free-to-play voucher income target: 20–40 per day (was 2–4 before the ×10 scaling) from the recurring faucet (the three daily tasks and the seven-day streak pack), so a free single pull every day or so and a 10-pull roughly monthly. Achievement unlocks pay a separate one-off 1,700 vouchers across the 80 badges; the simulator shows roughly half of that arriving inside the first fortnight, which is an onboarding bulge rather than sustained income.
- RNG: seeded xorshift so unit tests can verify odds and pity deterministically.

## 8. Retention systems

**Daily tasks.** Three per day, drawn from a pool in `src/data/dailies.json` (stamp N souls, hire N staff, buy N upgrades, reach N souls per second, watch 1 ad (Plan 4), plus gated tasks — equip a card, draw a requisition, buy a perk, file an audit — offered only on days the player can currently do them). Reset at local midnight. Rewards: KC scaled to current rate, plus vouchers. Streak counter with a bonus voucher pack at 7-day streaks; one missed day breaks the streak, one skip token per week protects it. A skipped task — by token or by the rewarded `daily-skip` ad — counts as finished, not forfeited: it is claimable and pays its KC and vouchers like any other, which is what makes the ad worth thirty seconds. The in-app help on the Tasks screen says so.

**Achievements.** About 80 in v1 in `src/data/achievements.json`: souls milestones, staff counts, audits filed, cards collected, ads watched, streaks. Each grants +1% permanent global multiplier and some grant vouchers. Trophy-style badge icons (SVG), grid on the Tasks tab. Mirrored to Play Games achievements on Android and Game Center achievements on iOS.

**Memo story arc.** About 120 memo lines in v1; about 30 are story memos unlocked by milestones and shown once as a modal before entering the ticker rotation. Arc: clearing the backlog destabilises the mortal realm → reality bugs → the bribed Auditor's true role → Cosmic Restructuring foreshadowing. The rest are random flavor, weighted by department and fiscal year.

**Character moods.** Staff portraits flip to their second face when the offline cap is reached or when the player has been away 12+ hours, and flip back on interaction.

**Local notifications** (Capacitor Local Notifications, opt-in prompt after day 2): offline cap reached, daily tasks reset, Audit available. Maximum 2 per day.

**Leaderboard.** One leaderboard, lifetime Souls Processed, through Play Games on Android and Game Center on iOS. It ships in v1.0 alongside the achievement mirroring, behind the same optional sign-in.

**Weekly events (v1.1).** A 3-day "Overflow" department appears with its own progress, event-only cards, and an event-scoped Play Games leaderboard of its own. Event definitions are fetched from a static JSON URL at launch with a bundled fallback; no server logic.

## 9. Monetization

**Rewarded ads** (Google AdMob through a Capacitor plugin). No interstitials or banners in v1.
- Overnight Backlog Report ×2.
- Overtime Boost: ×2 rate for 4 hours, 4-hour cooldown.
- One free single gacha pull per day.
- Skip one daily task.

**In-app purchases** (Google Play Billing 8+, via RevenueCat or the Capacitor community billing plugin; decide at implementation time based on plugin health).
- Voucher packs: 100, 550, 1,200, 3,000 (the product ids keep their pre-×10 names: `vouchers_10`, `vouchers_55`, `vouchers_120`, `vouchers_300`). The first purchase of each pack id pays double; every purchase after that pays the listed amount.
- Remove Ads (one-time, about $4.99): a permanent ×2 on the Overnight Backlog Report. The name is the joke, not the promise — v1 shows no interstitials, banners or forced prompts to anybody, so there is nothing for it to remove, and the store copy, the privacy policy and the Play listing all say plainly that the rewarded buttons stay optional either way. Making the rewarded rewards free for owners (an ad-free ×2 Backlog Report, a free pull without the ad) is a v1.1 candidate; it is deliberately not v1.0, because it would turn every rewarded placement into a second price list.
- Starter Pack: offered once, days 1–3: vouchers, one Senior Staff card, KC.
- Union Membership (monthly subscription): daily vouchers, +25% global rate, daily tasks auto-collect.

Purchases are validated locally through the billing library; there is no server receipt validation.

## 10. Screens

Portrait only. Bottom tab bar with five tabs.

1. **Office.** Department chips at top. Intake queue card showing the current flavor line. Large stamp button (the primary click target) with a stamp-slam animation and floating "+N" text. Staff list with buy ×1/×10/×max, milestone progress bars, mood faces. Upgrades section. Memo ticker fixed at the bottom.
2. **Personnel.** Pull buttons, pity counters, collection grid with rank stars, equip slots, Odds screen link.
3. **Ledger.** Seals held, live "Audit now for +N" button, Perk Ledger tree, Cosmic panel — locked with a progress bar to the next threshold until the Seals are there, then the two-step Restructure confirm and the Clause list.
4. **Tasks.** Daily tasks with progress, streak, achievements grid with badges.
5. **Store.** Voucher packs, Remove Ads, Starter Pack, Union Membership, restore purchases.

Overlays: Overnight Backlog Report, Audit ceremony, gacha reveal, story memo, settings (sound, haptics, cloud save sync, notifications, odds, privacy policy, credits).

**Title screen (every cold boot, one tap).** Ledger-ruled parchment, the stamp seal, "Afterlife Bureaucracy Inc. — Please take a number.", and two buttons: "Sign in with Google Play Games" (hidden where cloud save is unavailable, replaced by "Clocked in with Play Games" once signed in) and "Clock in without signing in". Sign-in runs a cloud sync before the office opens. Footer: version, Privacy, Odds.

**First launch (once, persisted in `onboarding`).** Two memos on parchment after the title screen — FORM 1-A *Notice of Decease* ("You have died. Do not be alarmed; it is quite common…", Dave) and FORM 2-C *Offer of Employment* ("Position: Intake Clerk (Temporary). Duties: stamp. Benefits: none…", Seraphine) — then a three-step training overlay with a spotlight coach mark: 1 stamp the soul (completes on the first stamp), 2 hire Dave (completes on the first hire), 3 "Souls pay Karma Credits; Karma hires staff; the Backlog Report pays you when you come back" (dismiss). Every step has Skip; skipping marks training done. Memo copy lives in `src/data/onboarding.json`.

Visual direction follows the concept doc: parchment palette, Special Elite for headers, IBM Plex Sans for body, IBM Plex Mono for numbers, ink-stamp SVG characters with bold outlines and one or two flat fills. A dark theme mirrors the palette with brighter accents. Fonts are bundled locally, not fetched.

*Decision 2026-09-16:* four alternative directions were mocked up on the style canvas (Midnight Ledger, Corporate Cartoon, Cozy Afterlife, Risograph Office); the parchment direction above is kept. Still open for later design work: a title / sign-in screen (arrives with cloud save) and a first-launch opening (two memos plus a first-stamp training overlay); the canvas holds a first draft of both in the parchment style. Known art gaps to close: cards whose `character` is `soul` (e.g. Grandma Liu) have no portrait yet, and archetype variants differ only by a small accessory.

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
- Cloud save through Play Games Saved Games on Android and iCloud key-value storage on iOS, behind one `CloudSave` interface (`available`, `isSignedIn`, `signIn`, `load`, `save`). One snapshot per player, name `afterlife-main`, holding the serialized save plus `savedAtWall`. Sync points: after boot when signed in, right after a sign-in, on pause, every fifth autosave (about 50 s at the 10 s autosave), and manually from Settings. Winner rule (`pickWinner` in `src/engine/cloudSync.ts`): higher lifetime Souls Processed wins; equal → the later `savedAtWall`; still equal → local. The winner is applied automatically and the player is told in a dismissible notice ("Restored your desk from the cloud · 12.4M souls · saved 2 h ago"); Settings offers the explicit overrides "Upload this device" and "Restore from cloud" behind a confirm. Entitlements merge by the never-take-away rule regardless of which save wins. Nothing is uploaded while `clockSuspect` is set or after a corrupt save was parked. Saves are not shared across the two platforms in v1. Play Games Saved Games sync ships in v1.0 (Plan 6); iOS uses a documented no-op until the Game Center/iCloud implementation lands. The manual export/import save code (Settings) stays as the offline fallback.
- Clock integrity: saves carry `lastSeenWallClock`, a monotonic `uptimeAtSave` and the `processId` that wrote them. On load, `engine/integrity.ts` assesses the gap: a wall clock moved backwards by more than 60 s credits nothing and freezes the daily rollover until the next honest boot; within one process, a wall-clock jump exceeding the monotonic gap by more than 5 minutes credits only the monotonic gap; any single gap longer than 30 days is credited as 30 days. Overtime Boost deadlines are stored as wall-clock timestamps; the clock-integrity check in this section polices clock rollback. Without a server, some cheating is accepted.

## 13. Testing and balance

- vitest for the engine: cost curves, milestone multipliers, click power, offline cap and rate, audit seal formula, Perk Ledger prerequisites, gacha odds (100,000 seeded pulls within tolerance of the published odds) and pity guarantees, daily reset boundaries, save migrations from every prior fixture.
- Content schema tests: every JSON file parses against its zod schema; every referenced id (perk prerequisites, card department, achievement targets) resolves.
- Balance simulator `npm run sim`: models a check-in player (5 sessions/day, 3 minutes, greedy buying, 30 days) and an active player over the full economy — dailies rolled over on a synthetic wall clock and claimed when finished, all four rewarded placements taken as often as their gates allow, vouchers spent on pulls, the best cards equipped, perks bought after every Audit, Cosmic Restructuring filed as soon as it is available, with the Seal Clauses taken first so the scaled cap is exercised above ×1. It prints a day-by-day table of souls, KC, departments unlocked, audits filed, Seals, vouchers, cards, achievements and Clauses, plus the effective pulls and rewarded ads each day, the played seconds each run needed to reach its Audit, the Seals every Audit paid against the cap in force at it, and the days Cosmic fired. Pacing targets in section 4 are asserted by a test that runs the simulator.
- UI: React Testing Library smoke tests for each tab and overlay; manual device pass on Android before each release.

## 14. Release phasing

- **v1.0** — everything above except weekly events and cloud sync. That includes the Cosmic Restructuring UI and the Valhalla branch, which were planned for v1.2 and landed early. Play Games achievements and the lifetime-souls leaderboard are wired through `src/platform/gameServices.ts`, with the console ids still pending (`src/platform/gameIds.ts` holds `TODO` sentinels and every call site skips an unmapped id, so the build is shippable before the Play Games project exists — see `docs/store/ids.md`). Play Games Saved Games cloud sync, the title screen and the first-launch onboarding (§10, §12; Plan 6); the manual export/import save code stays as the fallback. Store-ready: privacy policy, odds disclosure, data-safety form, adaptive icon, screenshots.
- **v1.1** — weekly events with CDN config, Game Center + iCloud cloud save on iOS, and the candidate ad-free rewards for Remove Ads owners (§9).
- **v1.2** — whatever the events and the first month of players ask for.

## 15. Out of scope

Multiplayer, guilds, real-time chat, server-authoritative economy, cross-platform save sync between Android and iOS, localisation beyond English (data files are structured for it later).

## 16. iOS readiness

The iOS project (`ios/`) is generated with Capacitor and kept in the repository from Plan 2 onward. Rules that keep the web bundle store-ready on both platforms:
- Portrait only on both; `viewport-fit=cover` with `env(safe-area-inset-*)` padding on the top bar, tab bar and any fixed overlay.
- iOS 15 deployment target; `contentInset: 'always'` off (the app manages insets in CSS); background colour matches `--paper` dark value `#1B1915`.
- Every platform plugin (ads, billing, cloud save, achievements, notifications, haptics) must have both an Android and an iOS implementation or a documented no-op on the platform that lacks it. Plan 4 chooses plugins that ship both (AdMob community plugin, RevenueCat, Capacitor Local Notifications, Capacitor Haptics).
- Gacha odds disclosure and the "rewarded ad" wording satisfy App Store Review Guideline 3.1.1 (loot-box odds) as well as Play policy.
- Builds and device testing for iOS happen on a Mac with Xcode; Windows sessions only generate and configure the project and must state that the build is unverified.

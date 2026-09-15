# Afterlife Bureaucracy — Plan 4: Monetization, Integrity, Cosmic, Store Readiness

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make v1.0 shippable on Google Play: rewarded ads (AdMob) behind a platform interface, in-app purchases and the Union Membership subscription (RevenueCat), clock-integrity checks, Cosmic Restructuring (second prestige tier with Clauses and the Valhalla branch), Play Games achievements and leaderboard plus an export/import save code, a balance re-run with the full economy, store assets (icon, splash, screenshots, privacy policy, data-safety answers), signing and release-build docs, and the deferred a11y/queue fixes from Plan 3. iOS stays buildable but is not submitted.

**Architecture:** Every native capability sits behind an interface in `src/platform` with a web no-op/mock so the game runs and tests in the browser: `Ads`, `Billing`, `GameServices`. The engine gains `integrity.ts` (clock plausibility), `cosmic.ts` (second prestige tier), `entitlements.ts`, and save v6. The store adds ad/billing/cosmic actions and mirrors achievements to `GameServices`. Content gains `cosmic.json` and `departments/valhalla.json` (gated by `branchesUnlocked`). The Store tab and Cosmic panel are the new UI. Store-readiness work is scripts and docs under `scripts/` and `docs/`.

**Tech Stack:** unchanged plus `@capacitor-community/admob@^7`, `@revenuecat/purchases-capacitor@^11`, `@openforge/capacitor-game-connect@^2` (Play Games sign-in, achievements, leaderboards), `sharp` (icon/splash generation), `playwright` (screenshots).

**Spec:** `docs/superpowers/specs/2026-09-14-afterlife-bureaucracy-design.md` — §6 (Cosmic), §8 (ads in dailies), §9, §12, §14, §16. Spec amendment made by this plan (Task 1): Play Games Saved Games cloud sync moves to v1.1; v1.0 ships achievements + leaderboard via Play Games and a manual export/import save code.

## Global Constraints

- Engine (`src/engine`) never imports React, zustand, or `@capacitor/*`; pure functions. All native work goes through `src/platform/*` interfaces with a web fallback; tests inject fakes.
- Ads: rewarded only, never interstitial/banner. Placements: `offline-double` (Backlog Report ×2), `overtime-boost` (×2 for 4 h, then a 4 h cooldown), `free-pull` (one single pull per local day), `daily-skip` (marks one unfinished daily as done, once per local day). Each successful ad increments `stats.adsWatched`. The Remove-Ads entitlement hides ad *prompts* but keeps the rewarded buttons available.
- IAP products (ids fixed): `vouchers_10`, `vouchers_55`, `vouchers_120`, `vouchers_300`, `remove_ads`, `starter_pack`, `union_monthly`. Purchased vouchers go through `grantVouchersExact` (never multiplied). Remove-Ads grants permanent ×2 offline earnings. Starter Pack (once, only while days since first launch ≤ 3): 20 vouchers + Senior card `c-grandma-liu` at 1 star + KC equal to 30 minutes of current income. Union Membership: +25% global multiplier while active, 2 vouchers granted on each daily rollover while active, daily tasks auto-claim when done.
- Clock integrity (spec §12): wall clock moved backwards → no offline credit, no daily rollover, `clockSuspect` set until the next honest boot; within one process, a wall-clock jump exceeding the monotonic gap by > 5 min → credit only the monotonic gap; any single offline gap > 30 days is credited as 30 days.
- Cosmic Restructuring: available at ≥ 100 Seals; resets Seals to 0, clears `perks`, clamps `equipped`, runs `resetRun`, grants 1 Cosmic Point; Clauses cost 1 point each and are permanent; `branchesUnlocked` gates departments whose content has a `branch` field.
- Save: `SAVE_VERSION = 6`; fixtures v1–v6 load; exhaustive round-trip test extended.
- Balance targets (sim): the six existing pacing targets hold; Cosmic reachable between day 8 and day 30 for the check-in profile; F2P voucher income 2–4 per day averaged over days 3–14.
- Android release: `versionCode` bump per release, `targetSdk 36`, signed AAB via a keystore that is **never** committed; privacy policy URL live before submission.
- Pristine test output; suite under 40 s; `npm run build` clean; commit per task with the `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` trailer; push to `origin main` after each commit.

---

## File map

| Path | Responsibility |
|---|---|
| `src/engine/integrity.ts` | clock plausibility |
| `src/engine/cosmic.ts`, `src/data/cosmic.json`, `src/data/departments/valhalla.json` | second prestige tier + Valhalla |
| `src/engine/entitlements.ts` | union / remove-ads effects, starter-pack eligibility |
| `src/engine/state.ts`, `migrations.ts`, `fixtures/save-v6.json` | v6 fields |
| `src/platform/ads.ts`, `billing.ts`, `gameServices.ts`, `saveCode.ts`, `adUnits.ts`, `gameIds.ts` | native interfaces + web fallbacks + id placeholders |
| `src/store/game.ts` | ad / billing / cosmic / game-services actions |
| `src/ui/screens/StoreScreen.tsx`, `src/ui/components/CosmicPanel.tsx`, `src/ui/overlays/CosmicCeremony.tsx`, `src/ui/overlays/SaveCodeSheet.tsx` | new UI |
| `src/ui/components/Modal.tsx` | focus trap + Escape (deferred from Plan 3) |
| `src/sim/*` | economy re-run incl. dailies / vouchers / cosmic |
| `scripts/make-icon.mjs`, `scripts/screenshots.mjs`, `docs/privacy.html`, `docs/store/listing.md`, `docs/release.md`, `.github/workflows/ci.yml` | store readiness |

---

### Task 1: Save v6, clock integrity, spec amendment

**Files:**
- Create: `src/engine/integrity.ts`, `src/engine/integrity.test.ts`, `src/engine/fixtures/save-v6.json`
- Modify: `src/engine/state.ts`, `src/engine/migrations.ts`, `src/engine/state.test.ts`, `src/store/game.ts`, `src/store/game.test.ts`, spec §12 and §14

**Interfaces:**
```ts
// state.ts (v6)
interface Entitlements { removeAds: boolean; unionUntilWall: number; starterPackBought: boolean }
interface AdState { freePullDate: string; dailySkipDate: string; boostCooldownUntilWall: number }
interface GameState { ...existing; entitlements: Entitlements; adState: AdState; cosmicPoints: number; cosmicClauses: string[]; branchesUnlocked: string[]; processId: string; stats: { ...existing; cosmics: number; purchases: number } }
// integrity.ts
const MAX_OFFLINE_DAYS = 30; const FORWARD_JUMP_TOLERANCE_MS = 5 * 60_000; const BACKWARDS_TOLERANCE_MS = 60_000;
interface GapAssessment { creditSec: number; suspect: boolean; allowRollover: boolean; reason: 'ok' | 'backwards' | 'forward-jump' | 'capped' }
function assessGap(saved: { lastSeenWallClock: number; uptimeAtSave: number; processId: string }, now: { wall: number; mono: number; processId: string }): GapAssessment
```
Rules: `wallDelta = now.wall − saved.lastSeenWallClock`. If `wallDelta < −BACKWARDS_TOLERANCE_MS` → `{ 0, suspect: true, allowRollover: false, 'backwards' }`. Else if `now.processId === saved.processId` (a resume in the same process) and `wallDelta > (now.mono − saved.uptimeAtSave) + FORWARD_JUMP_TOLERANCE_MS` → `{ creditSec: max(0, monoDelta/1000), suspect: true, allowRollover: false, 'forward-jump' }`. Else if `wallDelta > 30 days` → `{ 30 days, false, true, 'capped' }`. Else `{ wallDelta/1000, false, true, 'ok' }`.
Store: `boot()` generates a fresh `processId` (e.g. `Math.random().toString(36).slice(2)`) and stamps it into the loaded state before the first save; `creditOffline` uses `assessGap` for the credited seconds; the store keeps `clockSuspect: boolean`; `settle` skips `rollover` while `clockSuspect`; `clockSuspect` clears on the next boot whose assessment reason is `'ok'` or `'capped'`. Migration 5→6 adds defaults: `entitlements { removeAds: false, unionUntilWall: 0, starterPackBought: false }`, `adState { freePullDate: '', dailySkipDate: '', boostCooldownUntilWall: 0 }`, `cosmicPoints: 0`, `cosmicClauses: []`, `branchesUnlocked: []`, `processId: ''`, `stats.cosmics: 0`, `stats.purchases: 0`. `deserialize` sanitises each (booleans, non-negative numbers, strings, known clause/branch ids once Task 2's content exists — filter against `content.clauses` ids and department `branch` values; until Task 2 lands the arrays are simply string-filtered).
Spec edits: §12 add "Play Games Saved Games sync ships in v1.1; v1.0 offers a manual export/import save code (Settings)"; §14 v1.0 bullet gains "export/import save code", v1.1 gains "Play Games Saved Games sync".

- [ ] Tests: `assessGap` for each reason with exact numbers; store: a backwards wall clock on resume credits nothing and leaves `dailies.date` unchanged; a forward jump on resume credits only the monotonic gap; a 60-day gap credits 30 days; `processId` differs across two boots.
- [ ] Implement; `npm test`; commit `feat(engine): save v6, clock integrity assessment`; push.

---

### Task 2: Cosmic Restructuring engine + Valhalla content

**Files:**
- Create: `src/engine/cosmic.ts`, `src/engine/cosmic.test.ts`, `src/data/cosmic.json`, `src/data/departments/valhalla.json`
- Modify: `src/engine/content.ts` (`DepartmentDef.branch?: string`; `ClauseDef` schema; `Content.clauses`; validation that `unlockBranch` names a branch some department declares), `src/engine/actions.ts` (`unlockDepartments` skips departments whose `branch` is set and not in `branchesUnlocked`), `src/engine/state.ts` (`startingDepartments` ignores branch-gated departments), `src/engine/economy.ts` (clause global multiplier), `src/engine/offline.ts` (clause offline cap), `src/engine/vouchers.ts` (clause voucher multiplier), `src/engine/prestige.ts` (`sealsForRun` × clause seal multiplier — signature `sealsForRun(soulsRun, fiscalYear, sealMult = 1)`), `src/data/index.ts`

**Interfaces:**
```ts
type ClauseEffect = { type: 'globalMult'; value: number } | { type: 'sealMult'; value: number } | { type: 'offlineCapHours'; value: number } | { type: 'unlockBranch'; branch: string } | { type: 'voucherMult'; value: number };
interface ClauseDef { id: string; name: string; desc: string; effect: ClauseEffect; requires: string[] }
const COSMIC_THRESHOLD = 100;
function canCosmic(state: { seals: number }): boolean
function fileCosmic(state, content): { state; pointsGained: number }   // same state + 0 when !canCosmic; else seals 0, perks [], clampEquipped, resetRun, cosmicPoints + 1, stats.cosmics + 1; fiscalYear unchanged
function buyClause(state, content, id): GameState                      // 1 point, prerequisites owned, not owned; unlockBranch appends to branchesUnlocked
function clauseGlobalMult(state, content): Decimal; function clauseSealMult(state, content): number; function clauseOfflineCapHours(state, content): number; function clauseVoucherMult(state, content): number
```
`cosmic.json` (8 clauses): `clause-throughput-1/2/3` (+50% / +100% / +200% global, chained), `clause-seals-1/2` (seal mult ×1.5 / ×2, chained), `clause-overtime-1` (+24 h cap), `clause-requisition-1` (+50% vouchers), `clause-valhalla` (`unlockBranch: 'valhalla'`, requires `clause-throughput-1`). Names/desc in the office voice ("Memo from Cosmic Restructuring: …").
`valhalla.json`: `id: 'valhalla'`, `branch: 'valhalla'`, name "Valhalla Intake Annex", `unlockSouls: 1e15`, accent `#B5651D`, 5 staff (`v-shieldmaiden`, `v-skald`, `v-quartermaster`, `v-einherjar`, `v-valkyrie`; costs from 1e14 rising ×7, rates from 1e12 rising ×5; characters mix `demon:N`/`angel:N`), 4 upgrades, ≥ 15 queue lines, ≥ 15 memos ("Mead is not a stationery item.").

- [ ] Tests: `fileCosmic` resets/keeps per constraints and is a no-op below 100 seals; branch gating in `unlockDepartments` and `startingDepartments`; `buyClause` prerequisites, point deduction, `unlockBranch`; each multiplier applied in economy/offline/vouchers/`sealsForRun`; content validation.
- [ ] Implement; commit `feat(engine): Cosmic Restructuring with clauses and the Valhalla branch`; push.

---

### Task 3: Platform interfaces — Ads, Billing, GameServices, save code

**Files:**
- Create: `src/platform/ads.ts`, `billing.ts`, `gameServices.ts`, `saveCode.ts`, `saveCode.test.ts`, `platform.test.ts` (web fallbacks), `adUnits.ts`, `gameIds.ts`
- Modify: `package.json` (add the three plugins), `android/app/src/main/AndroidManifest.xml` (AdMob `com.google.android.gms.ads.APPLICATION_ID` meta-data with a placeholder value and a comment), `docs/android-build.md` (where the ids come from)

**Interfaces:**
```ts
// ads.ts
type AdPlacement = 'offline-double' | 'overtime-boost' | 'free-pull' | 'daily-skip';
type AdResult = 'rewarded' | 'dismissed' | 'unavailable';
interface Ads { init(): Promise<void>; isReady(): boolean; showRewarded(placement: AdPlacement): Promise<AdResult> }
const webAds: Ads          // dev: isReady true; showRewarded resolves 'rewarded' after 300 ms
const admobAds: Ads        // @capacitor-community/admob rewarded video; unit ids from adUnits.ts (test ids when `import.meta.env.DEV`)
function pickAds(): Ads
// billing.ts
type ProductId = 'vouchers_10' | 'vouchers_55' | 'vouchers_120' | 'vouchers_300' | 'remove_ads' | 'starter_pack' | 'union_monthly';
interface Product { id: ProductId; price: string; title: string }
type PurchaseResult = 'ok' | 'cancelled' | 'error';
interface Restored { removeAds: boolean; unionUntilWall: number; starterPackBought: boolean }
interface Billing { init(): Promise<void>; products(): Promise<Product[]>; purchase(id: ProductId): Promise<PurchaseResult>; restore(): Promise<Restored> }
const webBilling: Billing   // mock prices ('$0.99'…), purchase resolves 'ok' after 300 ms, restore returns all-false
const revenueCatBilling: Billing   // entitlements `remove_ads`, `union`; non-consumable/subscription mapping
function pickBilling(): Billing
// gameServices.ts
interface GameServices { signIn(): Promise<boolean>; isSignedIn(): boolean; unlockAchievements(ids: string[]): Promise<void>; submitScore(leaderboardId: string, value: number): Promise<void> }
const noopGameServices: GameServices; const playGamesServices: GameServices   // @openforge/capacitor-game-connect; ids from gameIds.ts placeholders
function pickGameServices(): GameServices
// saveCode.ts
function encodeSave(json: string): string   // 'AB1.' + base64url(utf8 json) + '.' + 8-hex FNV-1a checksum of the json
function decodeSave(code: string): string   // throws Error('Invalid save code') on prefix/checksum mismatch
```

- [ ] Tests: `saveCode` round-trip, checksum rejection, prefix rejection; web fallbacks resolve as specified; `pickX()` returns the web implementation under jsdom.
- [ ] Implement; commit `feat(platform): ads, billing, game services and save-code interfaces with web fallbacks`; push.

---

### Task 4: Store integration — ads, billing, cosmic, game services, subscription effects

**Files:**
- Create: `src/engine/entitlements.ts` (+ test), `src/store/monetization.test.ts`
- Modify: `src/store/game.ts`, `src/engine/economy.ts` (union ×1.25 while `entitlements.unionUntilWall > nowWall`), `src/engine/offline.ts` (`removeAds` → ×2 on credited souls), `src/engine/gacha.ts` (`pull(state, content, count, kcPerSec, opts?: { free?: boolean })`), `src/engine/dailies.ts` (`rollover` takes `unionActive: boolean` and grants 2 vouchers exact when true; `skipDailyFree(state, content, taskId)` marks a task skipped without a token), `src/engine/content.ts` + `src/data/dailies.json` (new daily kind `ad`, target 1, "Watch {n} rewarded ad", eligible only when the store reports ads ready — pass `adsReady` into `pickTasks` via a new `eligibility` parameter object `{ adsReady: boolean }`)

**entitlements.ts:**
```ts
function unionActive(state, nowWall): boolean
function starterPackEligible(state, nowWall): boolean     // !starterPackBought && nowWall − firstSeenWallClock ≤ 3 days
function applyPurchase(state, content, id: ProductId, nowWall, kcPerSec): GameState   // vouchers packs → grantVouchersExact; remove_ads → entitlements.removeAds; starter_pack → 20 vouchers exact + card c-grandma-liu (max(stars,1)) + kc + 1800 × kcPerSec; union_monthly → unionUntilWall = max(now, unionUntilWall) + 30 days; stats.purchases + 1
```
**Store additions:**
```ts
clockSuspect: boolean; adsReady: boolean; lastCosmic: { pointsGained: number } | null; purchasePending: ProductId | null; products: Product[];
watchAd(placement: AdPlacement, taskId?: string): Promise<AdResult>;   // on 'rewarded': stats.adsWatched + 1 and: offline-double → same as doubleOffline; overtime-boost → boostUntilWall = wall + 4 h, adState.boostCooldownUntilWall = wall + 8 h; free-pull → pull free single, adState.freePullDate = today; daily-skip → skipDailyFree(taskId), adState.dailySkipDate = today
canWatch(placement: AdPlacement): boolean;   // adsReady && placement gates (pendingOffline present / cooldown passed / dates ≠ today)
buy(id: ProductId): Promise<PurchaseResult>;  // billing.purchase then applyPurchase on 'ok'; purchasePending during
restorePurchases(): Promise<void>;            // merge Restored into entitlements
cosmic(): void; dismissCosmic(): void; buyClause(id: string): void;
signInGameServices(): Promise<boolean>; exportSaveCode(): string; importSaveCode(code: string): Promise<'ok' | 'invalid'>;   // import: decode, deserialize, replace state, save; invalid leaves state untouched
```
`settle`: while union active, auto-claim every done, unclaimed daily; newly unlocked achievements → `gameServices.unlockAchievements(ids)` (guarded, fire-and-forget); on `audit()` submit `Math.round(soulsLifetime.log10() * 1000)` to leaderboard `lifetime-souls` (guarded). `boot()`: `ads.init()`, `billing.init()`, `products = await billing.products()` (guarded, non-blocking), `adsReady = ads.isReady()`.

- [ ] Tests with fakes: each placement's reward and once-per-day gating; boost cooldown; `canWatch`; each product's grant is exact; starter pack eligibility window; union effects (global ×1.25, rollover vouchers, auto-claim); cosmic flow via the store; clause purchase; import rejects a bad code and keeps the current save; achievements mirrored on unlock.
- [ ] Implement; commit `feat(store): rewarded ads, purchases, union membership, cosmic, game services`; push.

---

### Task 5: UI — Store tab, Cosmic panel + ceremony, ad buttons, save code sheet, a11y

**Files:**
- Create: `src/ui/screens/StoreScreen.tsx` (+ test), `src/ui/components/CosmicPanel.tsx`, `src/ui/overlays/CosmicCeremony.tsx` (+ test), `src/ui/overlays/SaveCodeSheet.tsx` (+ test), `src/ui/components/ScreenHeader.tsx` (title + gear used by every non-Office screen)
- Modify: `src/ui/overlays/BacklogReport.tsx` (`watchAd('offline-double')`, button text `Watch ad ×2`, hidden when `!canWatch`), `src/ui/screens/OfficeScreen.tsx` (Overtime Boost button with live cooldown/remaining text), `src/ui/screens/PersonnelScreen.tsx` (`Free daily pull` ad button), `src/ui/screens/TasksScreen.tsx` (`Skip with ad` once per day), `src/ui/screens/LedgerScreen.tsx` (replace the Cosmic placeholder with `CosmicPanel`), `src/ui/overlays/SettingsSheet.tsx` (Restore purchases, Play Games sign-in, Export/Import save code, `PRIVACY_URL`), `src/ui/components/Modal.tsx` (focus trap, initial focus on the first button, Escape → `onClose` when provided, `aria-labelledby`), `src/ui/overlays/StoryMemo.tsx` / `PullReveal.tsx` / `AuditCeremony.tsx` (use `Modal`), `src/store/game.ts` (on boot cap `pendingStory` at 3 — extras marked seen silently — and `recentAchievements` at 3), `src/ui/App.tsx`

**Store tab contract:** sections Vouchers (4 packs, price from `products`), Remove Ads, Starter Pack (only while eligible; lists contents), Union Membership (price, benefits, "Active until {date}" when active), `Restore purchases`. Buttons `aria-label="Buy <title>"`, disabled while `purchasePending`; result toast (`role="status"`). Footnote: "Requisition Vouchers are a virtual currency with no real-world value. Subscriptions renew monthly until cancelled in Google Play." Ad buttons show `Ad not available` when `!adsReady`. Cosmic panel: `Unlocks at 100 Seals` progress → `Restructure (+1 Clause point)` with a two-step confirm listing what resets; clause list with `Enact` buttons (`aria-label="Enact <name>"`). Cosmic ceremony: `role="dialog"` `aria-label="Cosmic Restructuring"`, `+1 Clause point`, `Back to the office`. Save code sheet: export shows the code in a read-only textarea with `Copy`; import has a textarea and `Import` with a confirm ("replaces your current save").

- [ ] Tests: Store screen lists products and calls `buy`; ad buttons gate on `canWatch`; Cosmic panel states and confirm; ceremony renders/dismisses; save-code sheet exports and imports (fake clipboard); `Modal` traps Tab focus and closes on Escape; each screen shows the gear.
- [ ] Implement; visual check in the browser; commit `feat(ui): Store tab, cosmic panel, ad buttons, save code sheet, modal a11y`; push.

---

### Task 6: Balance re-run with the full economy

**Files:**
- Modify: `src/sim/simulate.ts`, `src/sim/run.ts`, `src/sim/pacing.test.ts`; tunables only: prestige constants, `cosmic.json` values, `perks.json` costs, non-Dave/Seraphine staff numbers, reincarnation/limbo/valhalla thresholds; spec §4/§5/§6 numbers if changed

Extend the simulator: dailies claimed when done (feasibility-gated as shipped), vouchers spent (ten-pull at ≥ 9 else single at ≥ 1), best cards equipped greedily by effect value, cheapest affordable perk bought after each audit, Cosmic as soon as available then cheapest clause, one `offline-double` ad per session. New targets: Cosmic between day 8 and 30 (check-in); F2P vouchers 2–4/day averaged over days 3–14; seals per audit ≤ 200 in the first 30 days (add `SEAL_CAP_PER_AUDIT` to `prestige.ts` and spec §6 if needed). All six existing targets stay.

- [ ] Run, tune, tests green; record final constants and both day tables in the report and spec; commit `feat(sim): full-economy simulator with cosmic and voucher targets; retune`; push.

---

### Task 7: Store readiness — assets, privacy policy, listing, release docs, CI

**Files:**
- Create: `scripts/make-icon.mjs` (SVG stamp icon → 1024 PNG + adaptive foreground/background with `sharp`; then `npx @capacitor/assets generate --android`), `scripts/screenshots.mjs` (Playwright, 1080×1920, seeds saves for Office / Personnel / Ledger / Tasks / Backlog Report; outputs `docs/store/screenshots/*.png`), `docs/privacy.html` (privacy policy: no account, no personal data collected by the app; AdMob, RevenueCat and Play Games as third-party processors with links; contact email; effective date), `docs/store/listing.md` (title, short and full description, category, content-rating questionnaire answers, data-safety form answers, ads declaration, IAP list with prices, loot-box odds statement), `docs/release.md` (keystore creation, `android/key.properties`, Gradle signing config, `versionCode`/`versionName` bump, `./gradlew bundleRelease`, internal-testing upload, release checklist), `.github/workflows/ci.yml` (`npm ci`, `npm test`, `npm run build` on push and PR)
- Modify: `android/app/build.gradle` (release `signingConfig` from `key.properties` when present), `.gitignore` (`android/key.properties`, `*.jks`), `src/version.ts` (`PRIVACY_URL = 'https://mochitg45.github.io/afterlife-bureaucracy/privacy.html'` — document the one-time manual step: enable GitHub Pages from `main` / `docs`), `ios/App/App/Info.plist` (`SKAdNetworkItems` for AdMob, `NSUserTrackingUsageDescription`), `android/app/src/main/AndroidManifest.xml` (verify the AdMob app id placeholder and `AD_ID` permission)

- [ ] Verify: icon PNGs generated and referenced by `android/`; five screenshots produced; `gradlew bundleRelease` succeeds with a local throwaway keystore (not committed); CI workflow passes on push.
- [ ] Commit `chore(release): store assets, privacy policy, listing and release docs, CI`; push.

---

## Self-review

**Spec coverage:** §9 ads (four placements, rewarded only, Remove-Ads semantics) — Tasks 3–5; §9 IAP (packs, Remove Ads, Starter Pack, Union) — Tasks 3–5; §12 integrity — Task 1; §12 cloud save — amended to v1.1 with an export/import code in v1.0 (Task 1 spec edit; Tasks 3, 5); §6 Cosmic — Tasks 2, 5; §8 "watch 1 ad" daily and ad-driven skip — Task 4 (`adsWatched` increments so `a-ads-1` unlocks); §14 store readiness — Task 7; §16 iOS plist entries — Task 7. Plan 3 deferrals: focus trap, first-boot queue cap, settings reachability, clock-forward farming — Tasks 1, 5.

**Placeholder scan:** tasks are contract-level (files, interfaces, rules, tests); every id, product, placement and constant is named. Ad unit ids, Play Games ids and the AdMob app id are explicit placeholders to be filled from the consoles — intentional and documented.

**Type consistency:** `AdPlacement`, `AdResult`, `ProductId`, `Product`, `Restored` (Task 3) consumed in Tasks 4–5; `Entitlements`/`AdState` (Task 1) used by Tasks 4–5; `fileCosmic` result feeds `lastCosmic`; `grantVouchersExact` (Plan 3) for all purchases; `assessGap` consumed by `creditOffline`; `branch` gating consumed by `unlockDepartments` and `startingDepartments`; `sealsForRun`'s third parameter defaults to 1 so existing callers compile.

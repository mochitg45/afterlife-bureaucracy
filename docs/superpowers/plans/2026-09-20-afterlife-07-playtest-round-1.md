# Afterlife Bureaucracy — Plan 7: Playtest Round 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Act on the first device playtest: a theme switch in Settings, voucher numbers scaled ×10 with pulls at 10 / 90, a card detail sheet with equip, new gacha odds, and a bolder app icon.

**Architecture:** Engine constants and JSON content change values only (no new mechanics). One new UI overlay (`CardSheet`), one new Settings row (theme), one store field (`settings.theme`). The icon script is redrawn. Smallest diff per task; reuse what exists.

**Tech Stack:** unchanged.

**Spec:** `docs/superpowers/specs/2026-09-14-afterlife-bureaucracy-design.md` — §7 gacha (odds, pity, costs), §8 dailies/achievements (voucher amounts), §9 IAP (pack sizes), §10 settings (theme). The spec numbers are updated in the same commits as the code.

## Global Constraints

- Every voucher amount in the game scales ×10, nowhere else: `PULL_COST` 1→10, `TEN_PULL_COST` 9→90, daily task reward 1→10 per claim, `STREAK_BONUS_VOUCHERS` 3→30, every `vouchers` value in `achievements.json` ×10, `STARTER_PACK_VOUCHERS` 20→200, IAP grants 10/55/120/300 → 100/550/1200/3000 (product ids stay `vouchers_10` etc.; only the granted amount and the display names change: "100 Overtime Vouchers"). Save migration: v7→v8 multiplies stored `vouchers` by 10 (and `voucherFraction`), so existing testers keep their value.
- Odds: `ODDS = { temp: 0.70, fulltime: 0.245, senior: 0.05, executive: 0.005 }` (sum 1). `PITY_SENIOR` 10 and `PITY_EXECUTIVE` 60 unchanged. Odds screen and `docs/store/listing.md` say 70 / 24.5 / 5 / 0.5 %.
- Sim: `npm run sim` targets stay green; the faucet target becomes 20–40 vouchers/day (same band ×10). Tune only within the Plan 4 tunable list if needed.
- Theme: `settings.theme: 'light' | 'dark' | 'system'`, default `'light'`; applied by setting `data-theme` on `document.documentElement` (`'system'` removes the attribute). No new whole-state subscriptions.
- No engine imports of React/zustand/Capacitor; pristine test output; suite under 40 s; `npm run build` clean; commit per task with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; push to `origin main` after each commit.

---

### Task 1: Vouchers ×10, pull costs 10 / 90, new odds, save v8

**Files:**
- Modify: `src/engine/gacha.ts` (constants), `src/engine/dailies.ts` (the per-claim voucher literal 1 → 10, `STREAK_BONUS_VOUCHERS`), `src/engine/entitlements.ts` (`STARTER_PACK_VOUCHERS`), `src/platform/billing.ts` (grant table + web catalogue names), `src/data/achievements.json` (`vouchers` ×10, scripted edit), `src/engine/migrations.ts` (v8), `src/engine/fixtures/save-v8.json`, `src/sim/simulate.ts`/`pacing.test.ts` (band ×10), tests that pin the old numbers, `src/ui/screens/PersonnelScreen.tsx` odds text if hard-coded, `docs/store/listing.md` (odds + pack names), spec §7/§8/§9.

**Interfaces:** constants only; `pull()` signature unchanged.

- [ ] Step 1: failing tests: `gacha.test.ts` asserts `PULL_COST === 10`, `TEN_PULL_COST === 90`, `ODDS` equals the new values and sums to 1; `dailies.test.ts` a claim pays 10; `state.test.ts` v7→v8 multiplies `vouchers` 5 → 50 and fixture v8 loads; round-trip extended.
- [ ] Step 2: run, see them fail.
- [ ] Step 3: change the constants; script the JSON edit (`node -e` over achievements.json, ×10 on `vouchers`); migration step 7→8; fixture.
- [ ] Step 4: `npm test`, `npm run sim` (faucet band 20–40), `npm run build`.
- [ ] Step 5: commit `feat(economy): vouchers x10, pulls at 10/90, executive odds 0.5%`; push.

---

### Task 2: Theme setting

**Files:**
- Modify: `src/engine/state.ts` (`settings.theme`, sanitised to the three values, default `'light'`; `deserialize` fills it for older saves), `src/store/game.ts` (`setTheme(theme)` action: writes settings + saves), `src/ui/App.tsx` (effect: apply `data-theme` from `settings.theme` on mount and change), `src/ui/overlays/SettingsSheet.tsx` (row "Theme" with three `.btn` toggles Light / Dark / System), `index.html` (keep `data-theme="light"` as the pre-boot default), tests.

- [ ] Step 1: failing tests: store `setTheme('dark')` persists; App applies `data-theme="dark"` to `document.documentElement`; `'system'` removes it; Settings row renders and calls `setTheme`.
- [ ] Step 2: implement; `npm test`; browser check both themes.
- [ ] Step 3: commit `feat(ui): theme setting (light default)`; push.

---

### Task 3: Card detail sheet with equip

**Files:**
- Create: `src/ui/overlays/CardSheet.tsx` (+ test)
- Modify: `src/ui/screens/PersonnelScreen.tsx` (tap on an owned card opens the sheet instead of the current equip toggle), `src/ui/theme.css`.

**Interfaces:** `CardSheet({ cardId, onClose })` reads the card def and owned stars and shows: portrait, name, title, rarity, flavor, "Bonus now: +X% <what>" at current stars, "Next star: +Y%" (or "Max stars" at 5), the stars row, and one button `Equip` / `Unequip` (disabled with the existing "No free lanyard" reason when slots are full). Uses `Modal`. The bonus value comes from the same function `economy.ts` uses to apply an equipped card at a given star count; reuse it, never re-implement the formula.

- [ ] Step 1: failing tests: opens on tap with the card's name and bonus line; `Equip` calls `equip(cardId)`; `Unequip` when equipped; disabled state text when slots are full.
- [ ] Step 2: implement; `npm test`; browser check.
- [ ] Step 3: commit `feat(ui): card detail sheet with equip`; push.

---

### Task 4: App icon

**Files:**
- Modify: `scripts/make-icon.mjs`, regenerated `android/app/src/main/res/mipmap-*`, `docs/store/listing.md` (icon note).
- Create: `docs/store/icon-candidates/{A,B,C}.png` (512 px).

Brief: a bolder mark that reads at 48 px: the red PROCESSED seal, large and tilted, with Dave's hooded head peeking over its top edge, on parchment; 5 px ink outline; the script stays font-free (draw the dashed ring; letters only as paths if at all). Adaptive foreground = seal + Dave, background = flat parchment. Three candidates: A seal only, B seal + Dave, C Dave's face inside the seal. Pick B unless it fails the 48 px read; the controller reviews the PNGs.

- [ ] Step 1: draw; `npm run icon`; confirm mipmaps regenerated; write the three candidate PNGs.
- [ ] Step 2: commit `chore(brand): bolder icon with Dave on the seal`; push.

---

### Task 5: Unique card portraits

**Files:**
- Modify: `src/ui/characters/Character.tsx` (+ test), `src/data/cards.json` (`character` per card), `src/engine/content.ts` only if the schema restricts `character` values.

Every one of the 30 cards gets its own portrait, drawn in the shipped ink-outline style (64-grid, 2.5 px `var(--ink)` outline, flat brand fills, ok/cooked faces). Build a small parts kit inside `Character.tsx` — body (hood, blazer, robe, sheet, cloud), hair (bun, grey, spiky, none), headwear (halo, horns, cap, crown, hard hat, headset), face extras (glasses, shades, moustache, blush), one prop (scythe, coffee, clipboard, keys, snack tray, stapler, receipts, pitchfork, harp, wheel, cabinet, briefcase, box, hymn sheet) — and a `PORTRAITS: Record<cardId, Parts>` table so each card is one line of parts and colours. `Character` resolves `id` first through `PORTRAITS`, then the existing staff/archetype/soul path, so old ids keep working. Cards whose `character` is `soul` today get a real portrait (Grandma Liu: grey bun, cardigan, snack tray). Test: every card id in `cards.json` renders a portrait whose `data-character` is not `soul`, and no two cards produce identical SVG markup.

- [ ] Step 1: failing tests as above.
- [ ] Step 2: parts kit + table; visual check of the Personnel grid at 390 px (all 30 owned via a seeded save).
- [ ] Step 3: commit `feat(art): a portrait for every card`; push.

---

### Task 6: Star-up needs several duplicates

**Files:**
- Modify: `src/engine/gacha.ts` (`DUPES_PER_STAR = [1, 2, 3, 5]` for ★2..★5; `cardShards: Record<cardId, number>` in state; `pull()` adds a shard per duplicate and promotes when `shards >= DUPES_PER_STAR[stars - 1]`, resetting shards; past ★5 duplicates still pay KC), `src/engine/state.ts` (`cardShards`, sanitised), `src/engine/migrations.ts` (fold into the v8 step: `cardShards: {}`), `src/engine/fixtures/save-v8.json`, `src/sim/simulate.ts` if it reads stars, `src/ui/components/CardTile.tsx` (small "3/5" progress under the stars), spec §7, tests.

- [ ] Step 1: failing tests: five copies of one card end at ★2 with 3 shards toward ★3; eleven copies reach ★5; the twelfth pays KC; round-trip carries `cardShards`.
- [ ] Step 2: implement; `npm test`; `npm run sim` stays green (retune within the Plan 4 list only if a target moves).
- [ ] Step 3: commit `feat(gacha): star-ups cost 1/2/3/5 duplicates`; push.

Task 3 (card sheet) runs after Task 6 and shows the shard progress ("3 of 5 duplicates to ★5").

---

### Task 7: Store product art

**Files:**
- Create: `src/ui/components/StoreArt.tsx` (+ test)
- Modify: `src/ui/screens/StoreScreen.tsx`, `src/ui/theme.css`.

`StoreArt({ productId, size = 56 })` returns an inline SVG in the parchment ink-outline style (64-grid, `var(--ink)` 2.5 px, flat brand fills): `vouchers_10` one voucher ticket, `vouchers_55` a fanned pair, `vouchers_120` a stack with a rubber band, `vouchers_300` a full tray of tickets with a brass coin on top; `remove_ads` the PROCESSED seal with a crossed-out megaphone; `starter_pack` a manila "NEW CLERK" folder with Grandma Liu's snack peeking out; `union_monthly` a brass union badge with a ribbon. Each product row shows the art on the left (52 px), name and price on the right. The Requisition Vouchers footnote keeps its text. Test: every `ProductId` renders an SVG with `data-product` equal to its id, pairwise distinct; the Store screen shows one art per product.

- [ ] Step 1: failing tests; Step 2: implement; visual check; Step 3: commit `feat(ui): store product art`; push.

---

### Task 8: First purchase pays double

**Files:**
- Modify: `src/engine/entitlements.ts` (+ test), `src/engine/state.ts` (`entitlements.firstBuyUsed: Record<string, boolean>`, sanitised; folded into the v8 migration step + fixture — v8 is on no tester device), `src/store/game.ts` (`mergeRestored` treats `firstBuyUsed` as never-take-away: once true stays true from either side), `src/ui/components/StoreArt.tsx` (a `firstBuy` prop adds a red "2×" ribbon across the top-left corner of the four voucher drawings), `src/ui/screens/StoreScreen.tsx` (pack row shows "200 vouchers · first purchase 2×" style copy and the ribbon while unused; plain copy and art after), `docs/store/listing.md` (disclose "first purchase of each pack pays double"), spec §9, tests.

Rule: the first successful purchase of each voucher pack id grants `2 × pack amount` through `grantVouchersExact`; later purchases grant the pack amount. Restore never re-grants (restoring only merges entitlements; it does not run `applyPurchase` for consumables — confirm and keep). A cloud download merges the flags with never-take-away.

- [ ] Step 1: failing tests: first `buy('vouchers_10')` grants 200 and sets the flag; second grants 100; flags survive round-trip and merge; StoreScreen shows the ribbon then hides it.
- [ ] Step 2: implement; visual check; Step 3: commit `feat(store): first purchase of each pack pays double`; push.

---

## Self-review

Spec coverage: §7 odds/costs → Task 1; §8/§9 voucher amounts → Task 1; §10 theme → Task 2; card sheet is new UI under §10 Personnel → Task 3; icon → Task 4. Placeholder scan: constants and copy are exact; Task 3 names the reuse rule for the effect function. Types: `settings.theme` union is the same in Task 2's store, App and Settings.

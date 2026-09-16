# Afterlife Bureaucracy — Plan 6: Cloud Save, Title Screen and First-Launch Onboarding

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Google Play Games cloud save on Android (sign-in, automatic sync with a clear winner rule, explicit overrides), a one-tap title screen with the sign-in choice, and a persisted first-launch flow (two memos plus three training steps), all in the existing parchment style, with iOS left as a documented no-op.

**Architecture:** A pure engine module `cloudSync.ts` decides which save wins. A `CloudSave` platform interface has three implementations: an in-memory fake for tests, a no-op for web/iOS, and a Play Games one backed by a small in-repo Capacitor plugin (`CloudSavePlugin.java`, Play Games Services v2 `SnapshotsClient` — no npm plugin supports snapshots on Capacitor 7). The store gains a `cloud` slice and a `syncCloud` action wired into boot/pause/autosave. Save version 7 adds `onboarding`, `cloud` and `savedAtWall`. UI adds `TitleScreen`, `OnboardingMemos`, `Training` (with a `CoachMark`) and a cloud row in Settings.

**Tech Stack:** unchanged, plus `com.google.android.gms:play-services-games-v2` (already pulled transitively by `@openforge/capacitor-game-connect`, now pinned explicitly) and Capacitor's `registerPlugin` for the in-repo plugin.

**Spec:** `docs/superpowers/specs/2026-09-14-afterlife-bureaucracy-design.md` — §10 (title screen, first launch), §12 (cloud save rules), §14 (v1.0 scope). Research from Plan 4's ledger: `@openforge/capacitor-game-connect@5.0.2` already initialises `PlayGamesSdk` and uses `GamesSignInClient` (v2), so the in-repo plugin shares its sign-in state; `@modbender/capacitor-play-games` and `@idleflowgames/capacitor-play-games` need Capacitor 8 and are not options.

## Global Constraints

- Engine (`src/engine`) never imports React, zustand or `@capacitor/*`; `cloudSync.ts` is pure. Platform work goes through `src/platform/cloudSave.ts` with a web no-op; tests inject `memoryCloudSave()`.
- Winner rule (spec §12): higher `soulsLifetime` wins; equal → later `savedAtWall`; equal → local. Entitlements merge by never-take-away (`mergeRestored` in the store already does this for billing; reuse its shape). Never upload while `clockSuspect` is true or after a corrupt save was parked in this process.
- Snapshot name `afterlife-main`; payload is `serialize(state)` (a string, UTF-8, well under the 3 MB cap); description `"Souls: <formatNumber(soulsLifetime)> · FY <fiscalYear>"`; conflict policy "most recently modified" at the Play layer (our own rule decides afterwards).
- Sync points: boot (after `billing.sync`, only if signed in), sign-in, pause, every fifth autosave, manual. A sync is single-flight (`cloud.syncing`).
- Title screen on every cold boot; one tap to enter; sign-in button hidden when `cloud.available` is false.
- Onboarding flags persist in the save (`onboarding.memosSeen`, `onboarding.trainingStep` 0–3); Skip everywhere; nothing blocks the 10 Hz loop.
- Save `SAVE_VERSION = 7`; fixture `save-v7.json`; migration 6→7 with defaults; exhaustive round-trip test extended; deserialize sanitises the new fields.
- No new whole-state zustand subscriptions; UI selectors stay narrow.
- Play Games ids remain `TODO` sentinels in code; the manifest `APP_ID` meta-data stays commented until the console id exists (documented in Task 6). The app must run with cloud save reporting `unavailable` when ids are missing — never crash.
- Pristine test output; suite under 40 s; `npm run build` clean; `cd android && ./gradlew assembleDebug` compiles the plugin; commit per task with the `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` trailer; push to `origin main` after each commit.

---

## File map

| Path | Responsibility |
|---|---|
| `src/engine/state.ts`, `migrations.ts`, `fixtures/save-v7.json` | v7 fields |
| `src/engine/cloudSync.ts` (+ test) | winner rule, summaries |
| `src/platform/cloudSave.ts` (+ test) | interface, memory fake, web no-op, Play implementation |
| `android/app/src/main/java/com/afterlifebureaucracy/game/CloudSavePlugin.java`, `MainActivity.java`, `android/app/build.gradle` | native snapshots plugin |
| `src/store/game.ts` (+ test) | `cloud` slice, `signInCloud`, `syncCloud`, `uploadLocal`, `restoreCloud`, onboarding actions |
| `src/ui/screens/TitleScreen.tsx`, `src/ui/App.tsx`, `src/ui/overlays/SettingsSheet.tsx`, `src/ui/components/CloudNotice.tsx` | title + cloud UI |
| `src/data/onboarding.json`, `src/engine/content.ts`, `src/ui/overlays/OnboardingMemos.tsx`, `src/ui/overlays/Training.tsx`, `src/ui/components/CoachMark.tsx` | first launch |
| `docs/store/ids.md`, `docs/privacy.html`, `docs/store/listing.md`, `docs/release.md`, `docs/android-build.md` | Play Games setup and disclosures |

---

### Task 1: Save v7 and the cloud winner rule

**Files:**
- Modify: `src/engine/state.ts` (GameState, `initialState`, `deserialize`), `src/engine/migrations.ts` (step 6→7, `SAVE_VERSION = 7`), `src/engine/migrations.test.ts`, `src/engine/state.test.ts`
- Create: `src/engine/fixtures/save-v7.json`, `src/engine/cloudSync.ts`, `src/engine/cloudSync.test.ts`

**Interfaces:**
- Produces on `GameState`: `onboarding: { memosSeen: boolean; trainingStep: number }` (default `{ memosSeen: false, trainingStep: 0 }`; `trainingStep` 0 = stamp, 1 = hire, 2 = recap, 3 = done), `cloud: { lastSyncWall: number; lastResult: CloudSyncResult }` (default `{ lastSyncWall: 0, lastResult: 'none' }`), `savedAtWall: number` (default 0; the store stamps it in `save()`).
- `export type CloudSyncResult = 'none' | 'uploaded' | 'downloaded' | 'kept-local' | 'unavailable' | 'error';`
- `export function pickWinner(local: GameState, cloud: GameState): 'local' | 'cloud'`
- `export interface SaveSummary { soulsLifetime: Decimal; savedAtWall: number; fiscalYear: number; seals: number }` and `export function summarize(s: GameState): SaveSummary`.

- [ ] **Step 1: Failing tests** — `cloudSync.test.ts`:

```ts
import Decimal from 'break_infinity.js';
import { describe, it, expect } from 'vitest';
import { initialState } from './state';
import { pickWinner, summarize } from './cloudSync';
import { content } from '../data/content';

const base = () => initialState(content, { wall: 1_700_000_000_000, mono: 0 });
const withSouls = (n: number, savedAtWall = 0) => ({ ...base(), soulsLifetime: new Decimal(n), savedAtWall });

describe('pickWinner', () => {
  it('prefers the save with more lifetime souls', () => {
    expect(pickWinner(withSouls(10), withSouls(500))).toBe('cloud');
    expect(pickWinner(withSouls(900), withSouls(500))).toBe('local');
  });
  it('breaks a tie by the later savedAtWall, then local', () => {
    expect(pickWinner(withSouls(10, 100), withSouls(10, 200))).toBe('cloud');
    expect(pickWinner(withSouls(10, 300), withSouls(10, 200))).toBe('local');
    expect(pickWinner(withSouls(10, 200), withSouls(10, 200))).toBe('local');
  });
});
describe('summarize', () => {
  it('reports the fields the notice shows', () => {
    const s = { ...withSouls(42, 7), fiscalYear: 3, seals: 12 };
    expect(summarize(s)).toEqual({ soulsLifetime: new Decimal(42), savedAtWall: 7, fiscalYear: 3, seals: 12 });
  });
});
```

Migration test: add `save-v7.json` (copy `save-v6.json`, bump `saveVersion` to 7, add the three fields with non-default values `onboarding: { memosSeen: true, trainingStep: 3 }`, `cloud: { lastSyncWall: 1700000001000, lastResult: 'uploaded' }`, `savedAtWall: 1700000002000`) and assert `migrate(v6)` yields the defaults for the three fields; extend the exhaustive round-trip test to v7; `deserialize` test: `trainingStep: 99` clamps to 3, `lastResult: 'bogus'` becomes `'none'`, non-number `savedAtWall` becomes 0.

(Adapt `initialState`'s real signature — read `state.ts` first; the helper above mirrors whatever the existing tests use.)

- [ ] **Step 2: Run** `npx vitest run src/engine/cloudSync src/engine/migrations src/engine/state` → FAIL.

- [ ] **Step 3: Implement** — `cloudSync.ts`:

```ts
import type { GameState } from './state';
import type Decimal from 'break_infinity.js';

export type CloudSyncResult = 'none' | 'uploaded' | 'downloaded' | 'kept-local' | 'unavailable' | 'error';
export interface SaveSummary { soulsLifetime: Decimal; savedAtWall: number; fiscalYear: number; seals: number }

export function summarize(s: GameState): SaveSummary {
  return { soulsLifetime: s.soulsLifetime, savedAtWall: s.savedAtWall, fiscalYear: s.fiscalYear, seals: s.seals };
}

/** Spec §12: more lifetime souls wins; equal → later save; equal → local. */
export function pickWinner(local: GameState, cloud: GameState): 'local' | 'cloud' {
  const c = cloud.soulsLifetime.cmp(local.soulsLifetime);
  if (c > 0) return 'cloud';
  if (c < 0) return 'local';
  return cloud.savedAtWall > local.savedAtWall ? 'cloud' : 'local';
}
```

Migration step 6→7 appends the defaults; `deserialize` clamps `trainingStep` to `0..3`, whitelists `lastResult`, numbers default to 0.

- [ ] **Step 4: Run** `npm test` → green (every fixture v1–v7 loads).

- [ ] **Step 5: Commit**

```bash
git add src/engine
git commit -m "feat(engine): save v7 with onboarding and cloud fields; cloud winner rule"
git push origin main
```

---

### Task 2: `CloudSave` platform interface and the Android snapshots plugin

**Files:**
- Create: `src/platform/cloudSave.ts`, `src/platform/cloudSave.test.ts`, `android/app/src/main/java/com/afterlifebureaucracy/game/CloudSavePlugin.java`
- Modify: `android/app/src/main/java/com/afterlifebureaucracy/game/MainActivity.java`, `android/app/build.gradle` (dependency), `docs/android-build.md` (plugin note)

**Interfaces:**
- Produces:

```ts
export type SignInResult = 'ok' | 'cancelled' | 'unavailable';
export interface CloudSnapshot { data: string; savedAtWall: number }
export interface CloudSave {
  available(): boolean;                       // false on web and iOS today
  isSignedIn(): Promise<boolean>;
  signIn(): Promise<SignInResult>;
  load(): Promise<CloudSnapshot | null>;      // null = no snapshot yet
  save(snapshot: CloudSnapshot, description: string): Promise<'ok' | 'error'>;
}
export function memoryCloudSave(opts?: { available?: boolean; signedIn?: boolean; snapshot?: CloudSnapshot | null; failSave?: boolean }): CloudSave & { snapshot: CloudSnapshot | null; signedIn: boolean };
export const noopCloudSave: CloudSave;
export const playCloudSave: CloudSave;
export function pickCloudSave(): CloudSave;   // native Android → play, else noop
```

- Native plugin methods (Capacitor `registerPlugin<CloudSavePlugin>('CloudSave')`): `isAuthenticated(): Promise<{ value: boolean }>`, `signIn(): Promise<{ value: boolean }>`, `loadSnapshot({ name }): Promise<{ found: boolean; data?: string; savedAtWall?: number }>`, `saveSnapshot({ name, data, description, savedAtWall }): Promise<void>`.

- [ ] **Step 1: Failing tests** — `cloudSave.test.ts` covers the memory fake (round-trip, `failSave`, `available:false` → `signIn` returns `'unavailable'`), `noopCloudSave` (`available()` false, `load()` null, `save()` `'error'`), and `playCloudSave` with the plugin mocked via `vi.mock('@capacitor/core', …)` returning a stub `registerPlugin` (sign-in cancelled → `'cancelled'`; `loadSnapshot` `{found:false}` → null; `saveSnapshot` throwing → `'error'`).

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement `cloudSave.ts`** with the three implementations; `playCloudSave.available()` returns `Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'`; every plugin call is wrapped in try/catch and maps to the result unions (never throws).

- [ ] **Step 4: Native plugin** — `CloudSavePlugin.java`:

```java
package com.afterlifebureaucracy.game;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "CloudSave")
public class CloudSavePlugin extends Plugin {
  private static final int POLICY = SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED;

  @PluginMethod
  public void isAuthenticated(PluginCall call) {
    PlayGames.getGamesSignInClient(getActivity()).isAuthenticated().addOnCompleteListener(t -> {
      JSObject r = new JSObject();
      r.put("value", t.isSuccessful() && t.getResult().isAuthenticated());
      call.resolve(r);
    });
  }

  @PluginMethod
  public void signIn(PluginCall call) {
    PlayGames.getGamesSignInClient(getActivity()).signIn().addOnCompleteListener(t -> {
      JSObject r = new JSObject();
      r.put("value", t.isSuccessful() && t.getResult().isAuthenticated());
      call.resolve(r);
    });
  }

  @PluginMethod
  public void loadSnapshot(PluginCall call) {
    String name = call.getString("name", "afterlife-main");
    SnapshotsClient client = PlayGames.getSnapshotsClient(getActivity());
    client.open(name, true, POLICY).addOnCompleteListener(t -> {
      try {
        if (!t.isSuccessful()) { call.reject("open failed", t.getException()); return; }
        Snapshot snap = t.getResult().getData();
        byte[] bytes = snap == null ? null : snap.getSnapshotContents().readFully();
        JSObject r = new JSObject();
        if (bytes == null || bytes.length == 0) { r.put("found", false); }
        else {
          r.put("found", true);
          r.put("data", new String(bytes, StandardCharsets.UTF_8));
          r.put("savedAtWall", snap.getMetadata().getLastModifiedTimestamp());
        }
        if (snap != null) client.discardAndClose(snap);
        call.resolve(r);
      } catch (Exception e) { call.reject("read failed", e); }
    });
  }

  @PluginMethod
  public void saveSnapshot(PluginCall call) {
    String name = call.getString("name", "afterlife-main");
    String data = call.getString("data", "");
    String description = call.getString("description", "");
    SnapshotsClient client = PlayGames.getSnapshotsClient(getActivity());
    client.open(name, true, POLICY).addOnCompleteListener(t -> {
      if (!t.isSuccessful()) { call.reject("open failed", t.getException()); return; }
      Snapshot snap = t.getResult().getData();
      if (snap == null) { call.reject("no snapshot"); return; }
      snap.getSnapshotContents().writeBytes(data.getBytes(StandardCharsets.UTF_8));
      SnapshotMetadataChange change = new SnapshotMetadataChange.Builder().setDescription(description).build();
      client.commitAndClose(snap, change).addOnCompleteListener(c -> {
        if (c.isSuccessful()) call.resolve(); else call.reject("commit failed", c.getException());
      });
    });
  }
}
```

`MainActivity.java`:

```java
package com.afterlifebureaucracy.game;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(CloudSavePlugin.class);
    super.onCreate(savedInstanceState);
  }
}
```

`android/app/build.gradle` dependencies: `implementation "com.google.android.gms:play-services-games-v2:20.1.2"` (pin; game-connect's `+` resolves to the same or newer — if Gradle reports a conflict, raise the pin to the resolved version and note it in the report).

- [ ] **Step 5: Verify** — `npx vitest run src/platform` green; `cd android && ./gradlew assembleDebug` BUILD SUCCESSFUL (this proves the Java compiles against the SDK; there is no emulator step in this plan). Add a short "In-repo plugins" section to `docs/android-build.md`.

- [ ] **Step 6: Commit**

```bash
git add src/platform android/app/src/main/java android/app/build.gradle docs/android-build.md
git commit -m "feat(platform): CloudSave interface with a Play Games snapshots plugin"
git push origin main
```

---

### Task 3: Store — cloud slice, sync, overrides, onboarding actions

**Files:**
- Modify: `src/store/game.ts`, `src/store/game.test.ts` (or a new `src/store/cloud.test.ts`)

**Interfaces:**
- Consumes: `CloudSave` (Task 2) via `StoreDeps.cloudSave?: CloudSave` (default `pickCloudSave()`); `pickWinner`, `summarize`, `CloudSyncResult` (Task 1); existing `mergeRestored`, `startTimers`, the import path used by `importSaveCode`.
- Produces on `GameStore`:

```ts
cloud: { available: boolean; signedIn: boolean; syncing: boolean; lastSyncWall: number; lastResult: CloudSyncResult };
cloudNotice: { kind: 'downloaded' | 'uploaded' | 'kept-local' | 'error'; summary?: SaveSummary } | null;
signInCloud(): Promise<SignInResult>;                 // sign in, then syncCloud('signin')
syncCloud(reason: 'boot' | 'signin' | 'pause' | 'auto' | 'manual'): Promise<CloudSyncResult>;
uploadLocal(): Promise<CloudSyncResult>;               // explicit override, ignores the winner rule
restoreCloud(): Promise<CloudSyncResult>;              // explicit override, ignores the winner rule
dismissCloudNotice(): void;
markMemosSeen(): void;
advanceTraining(step: number): void;                   // sets trainingStep = max(current, step)
skipTraining(): void;                                  // trainingStep = 3
```

- Rules inside `syncCloud`: return `'unavailable'` when `!cloud.available || !signedIn`; single-flight; `load()` → if null: upload (unless `clockSuspect` or parked) → `'uploaded'`; else `deserialize` the cloud payload (through `migrate`; a corrupt cloud payload → `'error'` and never overwrites); `pickWinner(local, cloud)`: cloud → apply cloud state through the same path as `importSaveCode` (restart timers, re-run `mergeRestored` with local entitlements so purchases are never lost), stamp `cloud.lastResult='downloaded'`, set `cloudNotice`; local → upload the local save (if allowed) and `lastResult='kept-local'` — show a notice only when the cloud copy differed (different `soulsLifetime` or `savedAtWall`). Persist `state.cloud`. Training/onboarding flags travel with whichever save wins. The stamp `savedAtWall = clock.wall()` happens in `save()` before serializing.
- Wiring: `boot()` → after billing sync, `if (await cloudSave.isSignedIn()) await syncCloud('boot')` (sets `cloud.signedIn`). `pause()` → `void syncCloud('pause')` after the local save. Autosave timer → every fifth run `void syncCloud('auto')`. `stamp()` → `advanceTraining(1)` when `trainingStep === 0`; `hire()` → `advanceTraining(2)` when `trainingStep === 1`.

- [ ] **Step 1: Failing tests** with `memoryCloudSave()` injected: boot with a richer cloud snapshot downloads it and shows the notice; boot with a richer local uploads and reports `kept-local` with a notice; identical saves → `kept-local`, no notice; `clockSuspect` blocks upload; corrupt cloud payload → `'error'`, local untouched; `signInCloud` when `available:false` → `'unavailable'` and no sync; `uploadLocal`/`restoreCloud` ignore the winner rule; entitlements survive a download (`removeAds` true locally stays true); autosave fifth-tick sync (use fake timers); `advanceTraining` monotonic; `skipTraining`.

- [ ] **Step 2: Run to verify they fail; implement; run** `npm test` → green, output pristine (no unhandled promise warnings — every `void syncCloud()` catches internally).

- [ ] **Step 3: Commit**

```bash
git add src/store
git commit -m "feat(store): cloud sync with the winner rule, overrides and onboarding progress"
git push origin main
```

---

### Task 4: Title screen, cloud notice and the Settings cloud row

**Files:**
- Create: `src/ui/screens/TitleScreen.tsx`, `src/ui/screens/TitleScreen.test.tsx`, `src/ui/components/CloudNotice.tsx`, `src/ui/components/CloudNotice.test.tsx`
- Modify: `src/ui/App.tsx` (+ `App.test.tsx`), `src/ui/overlays/SettingsSheet.tsx` (+ test), `src/ui/theme.css`

**Interfaces:**
- Consumes: `cloud`, `signInCloud`, `syncCloud`, `uploadLocal`, `restoreCloud`, `cloudNotice`, `dismissCloudNotice` (Task 3); `APP_VERSION`, `PRIVACY_URL` (`src/version.ts`); `Character` for Dave/Seraphine; `formatNumber`.
- Produces: `TitleScreen({ onEnter, onGoToOdds })` — rendered by `App` while `phase === 'title'` (App state `phase: 'title' | 'game'`, set to `'game'` by `onEnter`; boot still runs first so the `ready` gate stays). Buttons: `Sign in with Google Play Games` (only when `cloud.available && !cloud.signedIn`; on tap → `signInCloud()`; `'ok'` → `onEnter()`; `'cancelled'` → status "Sign-in cancelled."; `'unavailable'` → status "Play Games is not available on this device."), `Clock in` (label `Clock in without signing in` when the sign-in button is showing), a `Clocked in with Play Games` chip when signed in, footer with `v{APP_VERSION}`, `Privacy` (link to `PRIVACY_URL`), `Odds` (calls `onGoToOdds`). `CloudNotice` renders `cloudNotice` as a dismissible `role="status"` card: `Restored your desk from the cloud · {souls} souls · FY {n} · saved {relative time}` / `This device had the newer desk; uploaded it.` / `Cloud sync failed. Your desk is safe on this device.` Settings cloud row: status line (`Not signed in` / `Synced {relative} ago` / `Sync failed` / `Not available on this platform`), buttons `Sign in` (when available and signed out), `Sync now`, `Upload this device` and `Restore from cloud` each behind a two-step confirm (same pattern as the Cosmic panel), replacing the old `Sign in to Play Games` button (keep `signInGameServices` for achievements; call it after a successful cloud sign-in as well).

- [ ] **Step 1: Failing tests** — `TitleScreen.test.tsx`: shows the sign-in button only when available and signed out; `Clock in` calls `onEnter`; sign-in `'cancelled'` shows the status and does not enter; `'ok'` enters. `CloudNotice.test.tsx`: three kinds render their copy; dismiss calls `dismissCloudNotice`. `App.test.tsx`: after boot the title screen shows first; after `Clock in` the Office renders. `SettingsSheet.test.tsx`: `Sync now` calls `syncCloud('manual')`; `Restore from cloud` needs two taps.

- [ ] **Step 2: Run to verify they fail; implement.** Title markup follows the canvas draft (`OriginalTitle` board): ruled-parchment background (`repeating-linear-gradient` in `theme.css` as `.title-paper`), the existing stamp SVG from `StampButton` (static, `.pulse`), Dave and Seraphine at 96 px flanking it, `.btn` / `.btn-primary` for the two buttons, `.sub` footer.

- [ ] **Step 3: Run** `npm test` → green; browser check at 390 px: title → clock in → Office; Settings cloud row visible (web shows `Not available on this platform`).

- [ ] **Step 4: Commit**

```bash
git add src/ui
git commit -m "feat(ui): title screen with Play Games sign-in, cloud notice and settings cloud row"
git push origin main
```

---

### Task 5: First-launch memos and training

**Files:**
- Create: `src/data/onboarding.json`, `src/ui/overlays/OnboardingMemos.tsx` (+ test), `src/ui/overlays/Training.tsx` (+ test), `src/ui/components/CoachMark.tsx` (+ test)
- Modify: `src/engine/content.ts` (zod schema + `Content.onboarding`), `src/engine/content.test.ts`, `src/ui/App.tsx`, `src/ui/components/StampButton.tsx` (`data-coach="stamp"`), `src/ui/components/StaffRow.tsx` (`data-coach="hire"` on Dave's hire button), `src/ui/theme.css`

**Interfaces:**
- Consumes: `onboarding` flags and `markMemosSeen`, `advanceTraining`, `skipTraining` (Task 3); `Character`.
- Produces: `onboarding.json`:

```json
{
  "memos": [
    { "id": "ob-decease", "form": "FORM 1-A · NOTICE OF DECEASE", "title": "You have died.", "text": "Do not be alarmed; it is quite common. Your file has been forwarded to Intake. Please proceed to the counter and wait to be called.", "character": "dave", "cta": "Proceed to Intake" },
    { "id": "ob-offer", "form": "FORM 2-C · OFFER OF EMPLOYMENT", "title": "Congratulations, Clerk.", "text": "Position: Intake Clerk (Temporary). Duties: stamp. Benefits: none. Your predecessor is currently being processed.", "character": "seraphine", "cta": "Accept position" }
  ],
  "training": [
    { "step": 0, "target": "stamp", "title": "Stamp the soul.", "text": "Then stamp the next one. Souls are the currency here." },
    { "step": 1, "target": "hire", "title": "Hire Dave.", "text": "Karma Credits pay the staff who stamp for you while you are away." },
    { "step": 2, "target": "none", "title": "That is the job.", "text": "Souls pay Karma Credits; Karma hires staff; the Backlog Report pays you when you come back." }
  ]
}
```

Schema: memos `text` ≤ 3 sentences (reuse the story rule), `character` ∈ `dave | seraphine | gary | auditor`, training `target` ∈ `stamp | hire | none`. `OnboardingMemos()` — shown when `!onboarding.memosSeen` and the app phase is `'game'`; two-step modal with the memo art, `cta` button and `Skip`; finishing or skipping calls `markMemosSeen()`. `Training()` — shown when `memosSeen && trainingStep < 3`; renders `CoachMark({ target, title, text, stepIndex, total: 3, onSkip })`; step 2 has a `Got it` button that calls `advanceTraining(3)`. `CoachMark` finds `[data-coach="<target>"]` with `getBoundingClientRect` on mount and on `resize`, draws the spotlight (`.coach-hole` with the `box-shadow: 0 0 0 9999px rgba(42,38,32,0.55)` trick and a dashed `.pulse` ring) and the card below it; with `target: 'none'` it renders the card centred. Pointer events pass through the hole (`pointer-events: none` on the overlay, `auto` on the card) so the real stamp/hire button receives the tap.

- [ ] **Step 1: Failing tests** — content schema rejects a 4-sentence memo; `OnboardingMemos` shows memo 1 then memo 2 then calls `markMemosSeen`; `Skip` on memo 1 calls it immediately; `Training` step 0 spotlights `[data-coach="stamp"]` (assert the card text) and disappears at `trainingStep 3`; `Skip` calls `skipTraining`; `CoachMark` with `target:'none'` renders centred without a hole.

- [ ] **Step 2: Run to verify they fail; implement.** `App.tsx` mounts `<OnboardingMemos />` and `<Training />` after `StoryMemo` and only when `phase === 'game'`; while the memos are open, `NotifPrompt` stays hidden (extend the existing `!settingsOpen && !saveCodeOpen` guard with `memosSeen`).

- [ ] **Step 3: Run** `npm test` → green; browser: fresh save (clear `localStorage`) → title → memos → training on the Office; stamp advances to step 1; hiring Dave advances to step 2; `Got it` ends it; reload shows none of it again.

- [ ] **Step 4: Commit**

```bash
git add src/data/onboarding.json src/engine/content.ts src/engine/content.test.ts src/ui
git commit -m "feat(ui): first-launch memos and three-step training with coach marks"
git push origin main
```

---

### Task 6: Play Games setup docs, disclosures and verification

**Files:**
- Modify: `docs/store/ids.md` (Play Games section: how to create the project, link the app, OAuth client, enable *Saved Games*, copy the APP_ID into the manifest meta-data and `res/values/games-ids.xml`, fill `gameIds.ts`), `android/app/src/main/AndroidManifest.xml` (comment updated: the same id also unlocks cloud save), `docs/privacy.html` (Play Games: sign-in identity and the saved-game snapshot stored in the player's Google account; only when the player signs in), `docs/store/listing.md` (data-safety: "App activity / game progress — collected, optional, encrypted in transit, user can request deletion by signing out and deleting the snapshot"), `docs/release.md` (checklist: Play Games ids before the closed test), `docs/android-build.md` (in-repo plugin), `src/platform/gameServices.ts` (no change unless sign-in state must be shared — verify `isSignedIn` agrees with `CloudSave.isSignedIn` and note it)
- Test: none new; `npm test`, `npm run build`, `./gradlew assembleDebug`, CI green.

- [ ] **Step 1: Write the docs** as listed; every console step phrased as what the user will see on screen (Play Console → *Grow users* → *Play Games Services* → *Setup and management* → *Configuration*).
- [ ] **Step 2: Verify** all four commands; `gh run list --limit 1` green.
- [ ] **Step 3: Commit**

```bash
git add docs android/app/src/main/AndroidManifest.xml
git commit -m "docs(play-games): saved games setup, disclosures and release checklist"
git push origin main
```

---

## Self-review

**Spec coverage:** §12 cloud save interface, snapshot name, sync points, winner rule, notices, overrides, no-upload guards → Tasks 1–4; §10 title screen → Task 4; §10 first launch (memos, three steps, Skip, persisted flags, `onboarding.json`) → Tasks 1, 3, 5; §14 v1.0 phasing and iOS no-op → Tasks 2, 6; §5/§12 save versioning → Task 1.

**Placeholder scan:** every task names files, signatures, copy and tests; the two "read it first" notes point at the existing `initialState` signature and the existing seeding helpers, which the implementer must reuse.

**Type consistency:** `CloudSyncResult`, `SaveSummary`, `pickWinner`, `summarize` (Task 1) are the names Task 3 consumes; `CloudSave`, `SignInResult`, `CloudSnapshot`, `memoryCloudSave`, `pickCloudSave` (Task 2) match Task 3's `StoreDeps.cloudSave`; the store actions in Task 3 are exactly the ones Tasks 4–5 call; `data-coach` targets `stamp | hire` match `onboarding.json`.

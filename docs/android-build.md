# Android build

- `npm run cap:sync` builds the web app and copies it into `android/`.
- `npm run cap:open` opens the project in Android Studio.
- Debug APK from the command line: `cd android && gradlew.bat assembleDebug`.
- Target SDK 36 is set in `android/variables.gradle`. Google Play rejects lower targets.
- Portrait orientation is locked in `AndroidManifest.xml`.
- Saves live in Capacitor Preferences under key `afterlife.save.v1`.

## Native plugins

`npx cap sync android` regenerates `android/capacitor.settings.gradle` and
`android/app/capacitor.build.gradle`; both are committed. The monetization plugins are:

| Plugin | Version | Wrapped by |
|---|---|---|
| `@capacitor-community/admob` | 7.2.0 | `src/platform/ads.ts` |
| `@revenuecat/purchases-capacitor` | 11.3.2 | `src/platform/billing.ts` |
| `@openforge/capacitor-game-connect` | 5.0.2 | `src/platform/gameServices.ts` |

`@openforge/capacitor-game-connect` declares a `@capacitor/core@^5` peer range and has no
Capacitor 7 release, so `package.json` carries a scoped `overrides` entry that pins the
plugin's `@capacitor/core` peer to the project's own version. The plugin's Android module is a
thin wrapper over `play-services-games-v2` and builds against Capacitor 7; drop the override if
the plugin ever widens its peer range.

## In-repo plugins

Some native code lives in this repository rather than in an npm package. It is registered in
`MainActivity.onCreate` before `super.onCreate` — a plugin registered after the bridge starts
is invisible to the web layer — and reached from TypeScript with `registerPlugin(...)`.

| Plugin | Java | Wrapped by |
|---|---|---|
| `CloudSave` | `android/app/src/main/java/com/afterlifebureaucracy/game/CloudSavePlugin.java` | `src/platform/cloudSave.ts` |

`CloudSave` is Play Games Services saved games: `isConfigured`, `isAuthenticated`, `signIn`, `loadSnapshot`
and `saveSnapshot` over a single snapshot slot named `afterlife-main`, opened with
`RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED` so the SDK resolves conflicts itself. It signs in
through the same `GamesSignInClient` as `@openforge/capacitor-game-connect`, so the player is
never prompted twice.

`gameServices.ts`'s `isSignedIn()` and `cloudSave.ts`'s `isSignedIn()` read different things but
cannot disagree in a way that matters: game-connect's flag is local-only and stays false until
its own `signIn()` resolves, while `CloudSave.isAuthenticated()` asks the shared
`GamesSignInClient` directly every time, so cloud save can only ever see a signed-in player
slightly *before* game-connect's cached flag catches up, never see one signed in when the
native client disagrees.

Saved games additionally need **Saved Games** turned on for the Play Games Services project
(Play Console → Grow users → Play Games Services → Setup and management → Properties) — sign-in
and achievements work without it, `loadSnapshot`/`saveSnapshot` do not; see `docs/store/ids.md`
for the full console walkthrough.

It calls `com.google.android.gms:play-services-games-v2` directly, so `android/app/build.gradle`
declares that dependency explicitly instead of leaning on the copy game-connect pulls in.
game-connect asks for `+`, which currently floats to `22.1.0`; the app pins the same version so
the compiled-against version is written down. A lower pin is not an error — Gradle just
upgrades it to whatever the `+` resolves to — so check with
`gradlew.bat :app:dependencies --configuration debugRuntimeClasspath` and raise the pin
whenever the resolved version moves.

Cloud save stays dark until the Play Games project exists: with `gameIds.ts` unmapped and the
`com.google.android.gms.games.APP_ID` meta-data absent from the manifest, the plugin's
`isConfigured()` answers `false`, the store records the slot as unavailable for the session
and the game runs on its local save alone. `available()` cannot answer this on its own -- it
only knows the build is Android -- so the store resolves it once at boot and every caller
reads that answer. Even once
the project exists and the meta-data is in place, cloud save specifically also needs the Saved
Games toggle above — achievements and the leaderboard do not.

## Where the ids come from

All of them are public values that ship inside the APK. `docs/store/ids.md` is the source
of truth; the code mirrors it.

- **AdMob app id** — `android/app/src/main/AndroidManifest.xml`
  (`com.google.android.gms.ads.APPLICATION_ID`) and `ADMOB_APP_ID` in
  `src/platform/adUnits.ts`. The Mobile Ads SDK crashes at startup if the meta-data is
  missing, so both must stay in step.
- **Rewarded ad units** — `PRODUCTION_REWARDED_UNITS` in `src/platform/adUnits.ts`, one per
  placement. Development builds (`import.meta.env.DEV`) request Google's official rewarded
  test unit instead; serving live ads to a debug build is an AdMob policy violation.
- **RevenueCat SDK keys** — `src/platform/billing.ts`. The `test_…` Test Store key is used
  in dev builds and the `goog_…` Play key in release builds. Secret RevenueCat keys are
  never committed.
- **IAP product ids** — `PRODUCT_IDS` in `src/platform/billing.ts`, matching the ids created
  in Play Console. Entitlements are `remove_ads` and `union`.
- **Play Games ids** — `src/platform/gameIds.ts`, still `TODO`: the Play Games project does
  not exist yet. Unmapped ids are skipped rather than sent to the SDK, and the
  `com.google.android.gms.games.APP_ID` meta-data is deliberately absent from the manifest
  (a placeholder value there crashes the app at startup).

`com.google.android.gms.permission.AD_ID` is declared in the manifest — AdMob needs it on
Android 13+, and it must be disclosed in the Play Data safety form.

# Releasing Afterlife Bureaucracy (Android)

Everything between a green `main` and a build sitting in Play Console internal testing. Android
only: the iOS project builds on a Mac and has never been compiled on the Windows machine this
repository is developed on (spec §16).

---

## One-time setup

These four steps happen once, by hand, and are not automatable from here.

### 1. Publish the privacy policy on GitHub Pages

`src/version.ts` links Settings → Privacy Policy at

```
https://mochitg45.github.io/afterlife-bureaucracy/privacy.html
```

which is `docs/privacy.html` served by GitHub Pages. To turn it on:

**GitHub → the repository → Settings → Pages → Build and deployment → Source: *Deploy from a
branch* → Branch: `main`, folder: `/docs` → Save.** Wait for the deployment, then open the URL
above and confirm the page loads.

> **The repository is currently private.** GitHub Pages cannot serve from a private repository
> on the Free plan — the Pages section will either refuse or publish nothing. Either make
> `mochitg45/afterlife-bureaucracy` public, or upgrade the account to GitHub Pro (Pages from
> private repositories is a paid feature). Until one of those happens the privacy URL 404s, and
> **Play Console rejects a submission whose privacy policy URL does not resolve.** If neither is
> acceptable, host `docs/privacy.html` anywhere else that serves static HTML over HTTPS and
> change `PRIVACY_URL` in `src/version.ts` to match.
>
> Note what "make the repo public" actually costs: the whole source tree becomes readable,
> including `docs/superpowers/` (the spec and plans) and `docs/store/ids.md`. Nothing in
> `ids.md` is a secret — AdMob unit IDs and RevenueCat *public* SDK keys ship inside the APK
> anyway — but the design documents are a separate decision from the privacy page, and
> publishing `/docs` publishes them too. Hosting the single HTML file elsewhere avoids that.

### 2. Fill in the two human-owned fields

Done: `docs/privacy.html` and `docs/store/listing.md` carry the support address
`inatasunsoft@gmail.com` and the developer name `Inata Sun`. That address receives every
refund and support request for the life of the listing; changing it later means editing both
files and the Play Console listing together.

### 3. Create the upload keystore

One keystore, for the life of the app. Losing it means never shipping an update to this package
name again, so back it up somewhere that is not this machine and not this repository.

```bash
keytool -genkeypair -v \
  -keystore /path/outside/the/repo/afterlife-upload.jks \
  -alias afterlife-upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12
```

`keytool` ships with the JDK. On Windows it is at
`"%JAVA_HOME%\bin\keytool.exe"`, or inside the JDK that Android Studio installed.

Then write `android/key.properties` — **never committed**; `.gitignore` covers it, along with
`*.jks` and `*.keystore`:

```properties
storeFile=C:/path/outside/the/repo/afterlife-upload.jks
storePassword=…
keyAlias=afterlife-upload
keyPassword=…
```

`storeFile` is resolved by Gradle relative to `android/app/`, so use an absolute path with
forward slashes. `android/app/build.gradle` reads this file if it exists and signs the release
build with it; if the file is absent, the release build still assembles, just unsigned, so a
machine without the key (and CI) is not broken by its absence.

### 4. Create the Play Console entry

- Play Console → Create app → name, default language, **Game**, **Free**.
- App content: fill every declaration from `docs/store/listing.md` (ads, data safety, content
  rating, target audience, advertising ID).
- Monetize → Products: create the six managed products and the one subscription, with exactly
  the IDs in `docs/store/ids.md`.
- Play Games Services: create the project, add the Android OAuth credential (package name +
  upload-key SHA-1) and turn on **Saved Games**, then paste its numeric app ID, the 80
  achievement IDs and the `lifetime-souls` leaderboard ID into `docs/store/ids.md` and
  `src/platform/gameIds.ts`, and add the `com.google.android.gms.games.APP_ID` meta-data to
  `AndroidManifest.xml` (it is commented out there on purpose — a placeholder value crashes the
  app at startup). Full console walkthrough in `docs/store/ids.md`; field-level checklist for
  products, RevenueCat, policy forms and the closed track in `docs/store/play-console-next.md`.

---

## Per-release checklist

### Bump the version

Three numbers, and they must move together:

| Where | What | Rule |
|---|---|---|
| `package.json` → `version` | `1.0.0` | Semver. `src/version.ts` reads it, so this is what Settings shows. |
| `android/app/build.gradle` → `versionName` | `"1.0.0"` | Must match `package.json`. |
| `android/app/build.gradle` → `versionCode` | `1` | **Integer, +1 every upload.** Play rejects a re-used `versionCode`, and it can never go down. |

### Build

From the repository root, in order:

```bash
npm ci
npm test                 # 456 tests, must be green
npm run build            # tsc --noEmit && vite build; must be clean
npx cap sync android     # copies dist/ into the Android project and syncs plugins
cd android
./gradlew bundleRelease  # or gradlew.bat bundleRelease from PowerShell
```

The artifact lands at `android/app/build/outputs/bundle/release/app-release.aab`.

Check it is actually signed before uploading — an unsigned bundle means `key.properties` was
not found:

```bash
jarsigner -verify -verbose:summary app-release.aab | head -3
```

For a device smoke test, `./gradlew assembleRelease` produces an installable APK at
`android/app/build/outputs/apk/release/app-release.apk`.

### Regenerate assets when the art changes

```bash
npm run icon          # SVG stamp seal -> assets/*.png -> android res + docs/store/icon-512.png
npm run screenshots   # builds, serves, seeds a save, shoots 5x 1080x1920 into docs/store/screenshots/
```

Both are deterministic and both are meant to be committed. `npm run screenshots` starts and
stops its own preview server; nothing is left listening.

### Upload

1. Play Console → Testing → **Internal testing** → Create new release.
2. Upload the `.aab`. The first upload is where Play asks about **Play App Signing** — accept
   it; the keystore above becomes the *upload* key, and Google holds the app signing key.
3. Release notes: the "what's new" block in `docs/store/listing.md`.
4. Add testers, roll out, install from the opt-in link, and do the manual device pass below.
5. Before promoting past internal testing: confirm the Play Games ids in `docs/store/ids.md`
   and `src/platform/gameIds.ts` are the real console values (not `TODO`), the
   `com.google.android.gms.games.APP_ID` meta-data in `AndroidManifest.xml` is uncommented with
   that id, and **Saved Games** is turned on in Play Console → Grow users → Play Games Services
   → Setup and management → Properties. Internal testers can exercise sign-in, achievements and
   cloud save against an unpublished Play Games project; closed and production testers need the
   project **Published** too (same Configuration page) — see `docs/store/ids.md`.
6. Promote internal → closed → production only after the device pass is clean.

### Manual device pass (nothing here is covered by the test suite)

- [ ] Cold start on a real device; splash and adaptive icon look right on the launcher.
- [ ] Stamp, hire, buy an upgrade, unlock the second department.
- [ ] Force-stop, wait, reopen: the Overnight Backlog Report appears with plausible numbers.
- [ ] Each of the four rewarded placements plays a real ad and pays out
      (`offline-double`, `overtime-boost`, `free-pull`, `daily-skip`).
- [ ] A test purchase of `vouchers_10` credits exactly 10 vouchers.
- [ ] Restore purchases on a fresh install returns the entitlement.
- [ ] Play Games sign-in, one achievement unlocks, the leaderboard accepts a score.
- [ ] Export the save code, reinstall, import it, progress returns.
- [ ] Settings → Privacy Policy opens the live page.
- [ ] Rotate the device: still portrait. Dark mode: legible.

### After the release

- Tag it: `git tag v1.0.0 && git push --tags`.
- Keep `docs/store/ids.md` current with anything the consoles generated.

---

## Gotchas

- **`versionCode` is forever.** Uploading `2` and then trying `1` is refused permanently.
- **`targetSdk` 36 is mandatory.** Play rejects uploads targeting 35 or lower, and Play Billing
  must be 8+ (both are already set: `android/variables.gradle`, the RevenueCat plugin).
- **Never commit the keystore or `key.properties`.** `.gitignore` covers `*.jks`, `*.keystore`
  and `android/key.properties`. If one ever lands in a commit, rotate the key before it reaches
  Play, and rewrite the history.
- **The AdMob app ID in `AndroidManifest.xml` must be real.** The Google Mobile Ads SDK crashes
  at startup if the `com.google.android.gms.ads.APPLICATION_ID` meta-data is missing or bogus.
- **The privacy URL must resolve before submission** — see step 1.
- **iOS** (`ios/`) is configured but unverified: `Info.plist` carries the SKAdNetwork list,
  `NSUserTrackingUsageDescription` and a *placeholder* `GADApplicationIdentifier` (Google's
  public sample ID). Before any TestFlight build, register a separate iOS app in AdMob, replace
  that ID, and refresh the SKAdNetwork list from
  <https://developers.google.com/admob/ios/ios14>.

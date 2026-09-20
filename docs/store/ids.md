# Store and ad identifiers

Not secrets; safe to commit. Fill the placeholders as they are created in the consoles.

## AdMob (Android)
- App ID: `ca-app-pub-5130289288594607~4830589570`
- Rewarded ad unit ids (create one per placement, names as listed):
  - offline-double: `ca-app-pub-5130289288594607/7233778673`
  - overtime-boost: `ca-app-pub-5130289288594607/2737586738`
  - free-pull: `ca-app-pub-5130289288594607/3254618178`
  - daily-skip: `ca-app-pub-5130289288594607/8562785171`

## Google Play
- Package: `com.afterlifebureaucracy.game`
- IAP product ids: vouchers_10, vouchers_55, vouchers_120, vouchers_300, remove_ads, starter_pack, union_monthly (create in Play Console → Monetize)

## RevenueCat
- Test Store public key (sandbox, dev builds): `test_KVdHDShyXRlyPVWbhZFJxMJFQLg`
- Play Store public SDK key (release builds): `goog_qrKNtlMXOEqzWLCObOPioONRTFb`
(public keys only; never commit secret keys)

## Play Games Services
- Project / app id (numeric): `1035420780939` (in `AndroidManifest.xml` as `com.google.android.gms.games.APP_ID`)
- Achievement ids: 20 of the 80 local achievements are mirrored to Play Games; the map is `PLAY_ACHIEVEMENT_IDS` in `src/platform/gameIds.ts` (re-imported with icons 2026-09-20; ids `CgkIi5ONn5EeEAIQ…`, from the console's Get resources XML)
- Leaderboard `Lifetime souls`: `CgkIi5ONn5EeEAIQAQ` (`LEADERBOARD_LIFETIME_SOULS`)
- OAuth clients: one Android client per signing fingerprint (debug, upload key, Play app-signing key); the credential on the Configuration page currently carries only one

### Console steps

Written as the screens read, in order:

1. **Play Console → Grow users → Play Games Services → Setup and management → Configuration**
   → **Create new Play Games Services project** (or **link an existing Cloud project** if one
   already backs this Google account). Name it after the game; this is a one-time, permanent
   choice for this app.
2. **Credentials** tab → **Add credential** → **Android** → package name
   `com.afterlifebureaucracy.game` and the SHA-1 of the *upload* keystore (`docs/release.md`
   step 3 creates that keystore; read the fingerprint with
   `keytool -list -v -keystore afterlife-upload.jks -alias afterlife-upload`). This is what lets
   a release APK/AAB signed with that key authenticate as this Play Games project. Add the
   debug-keystore SHA-1 too (same command against `~/.android/debug.keystore`, alias
   `androiddebugkey`) if sign-in should also work from `gradlew assembleDebug` builds.
3. **Properties** tab → turn **Saved Games** on. Sign-in and achievements work without this;
   `CloudSavePlugin`'s `loadSnapshot`/`saveSnapshot` do not.
4. **Achievements** tab → **Create achievement** for each entry in
   `src/data/achievements.json`, then copy each generated id (`CgkI…`) into
   `PLAY_ACHIEVEMENT_IDS` in `src/platform/gameIds.ts`, keyed by the local achievement id.
5. **Leaderboards** tab → **Create leaderboard** named `lifetime-souls`, then copy its
   generated id into `LEADERBOARD_LIFETIME_SOULS` in `src/platform/gameIds.ts`.
6. **Publish** the Play Games Services project (top of the Configuration page) once the above is
   done — an unpublished project only works for testers added on the project's **Testers** tab.

### Where the numeric App ID goes

The **Configuration** page shows a numeric **App ID** (different from any achievement or
leaderboard id, which look like `CgkI…`). Copy it into:

- `docs/store/ids.md` — the "Project / app id" line above.
- `AndroidManifest.xml` — uncomment the `com.google.android.gms.games.APP_ID` meta-data and set
  `android:value` to the numeric id (see the comment there for why it stays commented out until
  then).
- Alternative to hardcoding it in the manifest: create
  `android/app/src/main/res/values/games-ids.xml` (the file does not exist yet) with
  `<string name="game_services_project_id">…</string>` and point the meta-data at
  `android:value="@string/game_services_project_id"` instead. Either works; a string resource is
  easier to swap per build variant if one is ever added.

The same App ID unlocks both Play Games sign-in/achievements *and* cloud save — there is no
separate id for Saved Games, only the Properties toggle in step 3 above.

## Fill before publishing

Decisions a person has to make, not values a console generates. Both appear as
`[… — fill before publishing]` placeholders in `docs/privacy.html` and `docs/store/listing.md`.

- [x] `CONTACT_EMAIL` (inatasunsoft@gmail.com) — the support address on the Play listing and in the privacy policy. It
      receives every refund and data request, forever; pick it deliberately.
- [x] `DEVELOPER_NAME` (Inata Sun) — the developer name shown on the listing and named in the privacy policy.
- [x] Enable GitHub Pages (done 2026-09-16, repo public, source main/docs) so <https://mochitg45.github.io/afterlife-bureaucracy/privacy.html>
      resolves (`main` / `/docs`). The repo is private, so this needs a public repo or GitHub
      Pro — see `docs/release.md`.
- [ ] iOS AdMob app id — `ios/App/App/Info.plist` currently holds Google's public *sample*
      `GADApplicationIdentifier`. Register a separate iOS app in AdMob before any iOS build.

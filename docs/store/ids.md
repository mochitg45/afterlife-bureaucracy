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
- Project / app id: `TODO`
- Achievement ids: map in `src/platform/gameIds.ts` (Plan 4) — all `TODO` until the Play Games project is created
- Leaderboard `lifetime-souls`: `TODO`

## Fill before publishing

Decisions a person has to make, not values a console generates. Both appear as
`[… — fill before publishing]` placeholders in `docs/privacy.html` and `docs/store/listing.md`.

- [ ] `CONTACT_EMAIL` — the support address on the Play listing and in the privacy policy. It
      receives every refund and data request, forever; pick it deliberately.
- [ ] `DEVELOPER_NAME` — the developer name shown on the listing and named in the privacy policy.
- [ ] Enable GitHub Pages so <https://mochitg45.github.io/afterlife-bureaucracy/privacy.html>
      resolves (`main` / `/docs`). The repo is private, so this needs a public repo or GitHub
      Pro — see `docs/release.md`.
- [ ] iOS AdMob app id — `ios/App/App/Info.plist` currently holds Google's public *sample*
      `GADApplicationIdentifier`. Register a separate iOS app in AdMob before any iOS build.

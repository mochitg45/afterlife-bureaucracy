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

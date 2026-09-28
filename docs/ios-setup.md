# iOS setup — Afterlife Bureaucracy

iOS v1 ships **without ads** (like Smile, CUCO and Decant): the AdMob pod is dropped in CI and
every ad button is hidden on iOS. Purchases go through RevenueCat. No Game Center or cloud save yet.

## Already done (2026-09-27)

- Bundle ID `com.afterlifebureaucracy.game` registered (Apple Developer → Identifiers).
- App Store Connect app record **Afterlife Bureaucracy: Idle**, Apple ID **6816599024**, SKU `afterlife-ios`.
- In-app purchases, all *Ready to Submit* (prices, all 175 countries, en-US text, review screenshot):

  | Product ID | Type | US price |
  |---|---|---|
  | `vouchers_10` | Consumable | $0.99 |
  | `vouchers_55` | Consumable | $4.99 |
  | `vouchers_120` | Consumable | $9.99 |
  | `vouchers_300` | Consumable | $19.99 |
  | `starter_pack` | Non-consumable | $2.99 |
  | `union_monthly` | Auto-renewing, group *Union Membership* | $3.99 / month |

  `remove_ads` is deliberately not on iOS (there are no ads to remove).
- RevenueCat app **Afterlife Bureaucracy (App Store)** (`app1da4da36be`) in project Afterlife
  Bureaucracy, using the team's existing keys (In-App Purchase key `WP3L8R84J8`, App Store Connect
  API key `CFURK2CVZ2`) — both show *Valid credentials*.
- `codemagic.yaml` (copied from Smile's working build), iOS icons, Info.plist without ad keys,
  and the code: no ads / no Play Games on iOS, RevenueCat reads `VITE_REVENUECAT_IOS_KEY`.

## Your steps (~10 min)

### 1. RevenueCat — import products (~2 min)
Project **Afterlife Bureaucracy** → Product catalog → **Products** → section
*Afterlife Bureaucracy (App Store)* → **Import** → tick all 6 → **Import (6)**.
Then on the `union_monthly` row → **Attach** → entitlement **`union`** → Attach.
(Vouchers and starter pack need no entitlement — same as Android.)

### 2. RevenueCat — copy the public iOS key (~1 min)
Project → **API keys** → *SDK API keys* → row **Afterlife Bureaucracy (App Store)** → eye icon →
copy the `appl_…` key. Done: `appl_yKvyDEIvMqiJiosTKCLsNLHVpek` is in `codemagic.yaml`.

### 3. Codemagic — add the app (~5 min)
Codemagic → **Add application** → GitHub → `mochitg45/afterlife-bureaucracy` → it finds
`codemagic.yaml`. App settings → **Environment variables** → group **`appstore_credentials`**,
all marked *Secret* — the same four team-wide values Smile uses (files in `Documents/Claude/_secrets/apple-team/`, index in `_secrets/README.md`):

| Variable | Value |
|---|---|
| `APP_STORE_CONNECT_ISSUER_ID` | `9bb893f9-b193-4fb8-8f36-34631c5b1d58` |
| `APP_STORE_CONNECT_KEY_IDENTIFIER` | `CFURK2CVZ2` |
| `ASC_KEY_P8_B64` | contents of `_secrets/apple-team/ASC_KEY_P8_B64__CFURK2CVZ2.txt` |
| `CERT_KEY_B64` | contents of `_secrets/apple-team/CERT_KEY_B64.txt` |

(If Codemagic lets you reuse Smile's group at team level, that works too.)

### 4. First build (~15 min, unattended)
Codemagic → **Start new build** → workflow `ios-release`. It tests, builds, signs and uploads to
App Store Connect. Then App Store Connect → TestFlight → add yourself as an internal tester →
install from the TestFlight app on the iPhone. Test a purchase with a Sandbox account
(Settings → App Store → Sandbox Account).

If the build fails with a certificate-limit error: Apple allows 3 distribution certificates —
revoke an unused one in Certificates and rerun.

## Before App Store review (later)
App Store listing text (reuse `docs/store/listing.md`), screenshots (`docs/store/screenshots/ios-6.9/`
and `ios-ipad-13/`), App Privacy answers (no tracking, no data collected by the app; RevenueCat
purchase history), age rating, and attach the 6 in-app purchases to the 1.1.0 version.

## Lessons from the first port (for the next app)

- App Store Connect's web UI is unreliable for automation (clicks ignored, screenshots freeze).
  Use its REST API with a JWT signed by the team key (`_secrets/apple-team/AuthKey_CFURK2CVZ2.p8`,
  key `CFURK2CVZ2`, issuer `9bb893f9-b193-4fb8-8f36-34631c5b1d58`). It covers IAPs and subscriptions,
  prices (`inAppPurchasePriceSchedules`; `subscriptionPrices` per territory via `/equalizations`),
  availability, localizations, review screenshots, version text, subtitle, keywords, category,
  age rating, content rights, review contact, screenshots, build attach, TestFlight group/tester
  and "What to Test" notes.
- `subscriptionPrices` POSTs return random 500s (about 25 of 175). Re-list and retry the missing ones.
- IAPs stay *Missing Metadata* until each has a review screenshot of the in-game store. Hide
  products not sold on iOS in that shot, and dismiss any coach/tip overlay first.
- Keywords max 100 characters (409 if over). Don't repeat words already in the name or subtitle.
- App Privacy has no API. Fill it in the web UI (RevenueCat: Purchase History, App Functionality,
  not linked, no tracking). The final Publish click is the owner's declaration.
- RevenueCat: "Select existing key" for both keys (IAP `WP3L8R84J8`, ASC API `CFURK2CVZ2`). Its
  Products "Import" button and the public-key reveal ignored automation; the owner did those.
- Codemagic: only the owner enters the 4 secret env vars. Copying Smile's yaml built first try.
- Info.plist: with no ads on iOS, remove `GADApplicationIdentifier`, `NSUserTrackingUsageDescription`
  and `SKAdNetworkItems`. `ITSAppUsesNonExemptEncryption=false` skips export compliance.
- Icons via `@capacitor/assets generate --ios` (RGB, no alpha). Store screenshots: 1320x2868 and
  2064x2752 PNG, no alpha; bezel screen must match the capture's aspect; capture iPad at 768x1024.
- Code: hide (not disable) every ad button on iOS; skip `Purchases.configure` if the iOS key is
  empty; bump `MARKETING_VERSION` and the App Store version string every release.

# Play Console: what to do next (closed testing)

The field-level companion to `docs/release.md` step 4. Every id and name below is what
`src/platform/billing.ts` asks the store for, so the app finds them with no code change.
Package: `com.afterlifebureaucracy.game`.

## 1. In-app products (Monetize with Play → Products → One-time products)

**Create one-time product** six times. Page 1: Product ID and Name exactly as written, a
one-line Description, tax category "Digital app sales", lowest age rating. Page 2 ("Availability
and pricing"): Purchase option ID `buy`, Purchase type Buy, then **Set prices** in USD (Play
converts the rest), then **Activate**. Consumable vs non-consumable is not chosen here any more;
RevenueCat asks for it on import (voucher packs consumable, the other two non-consumable).

| Product ID | Name | Price (USD) | Type |
|---|---|---|---|
| `vouchers_10` | 100 Requisition Vouchers | 0.99 | consumable |
| `vouchers_55` | 550 Requisition Vouchers | 4.99 | consumable |
| `vouchers_120` | 1200 Requisition Vouchers | 9.99 | consumable |
| `vouchers_300` | 3000 Requisition Vouchers | 19.99 | consumable |
| `remove_ads` | Exempt From Advertising | 4.99 | one-time |
| `starter_pack` | New Clerk Starter Pack | 2.99 | one-time |

Description: reuse the Name, or the one-liners in `listing.md`. The "first purchase pays
double" bonus is app logic; nothing to set here.

## 2. Subscription (Monetize with Play → Products → Subscriptions)

- **Create subscription** → Product ID `union_monthly`, Name `Union Membership`, benefits
  "+25% output in every department", "Bonus vouchers on every daily rollover", "Daily tasks
  claim themselves".
- **Add base plan**: ID `monthly`, auto-renewing, Monthly, 7-day grace, automatic account hold,
  price 3.99 USD. Save, Activate the base plan, then Activate the subscription.

## 3. RevenueCat (app.revenuecat.com → project)

The app reads purchases through RevenueCat, so the Play products must be mirrored there.

1. **Project settings → Play Store app**: confirm the package name and upload the Play
   service-account JSON (Play Console → Setup → API access → create a service account with
   "View financial data" and "Manage orders"). Without it RevenueCat cannot validate receipts.
2. **Product catalog → Products → + New**: import from Play once the account is linked, or add
   by hand: the six ids above plus `union_monthly:monthly`.
3. **Entitlements**: create exactly these two identifiers and attach the products:
   - `remove_ads` ← product `remove_ads`
   - `union` ← product `union_monthly`
   Voucher packs and `starter_pack` get no entitlement; the app credits them from the purchase.
4. **Offerings**: unused. Leave the default empty.
5. SDK keys are already in the app (`goog_qrKN…` release, `test_…` dev). Nothing to paste.

## 4. Play Games Services (Grow users → Play Games Services → Setup and management)

- **Configuration** → **Publish**. Until then only the testers on its own Testers tab can
  sign in. Achievements, leaderboard, Saved Games and the debug/upload OAuth clients are done.
- One Android credential per signing key, three in all: debug, upload, and Play's
  app-signing key. Each needs its own OAuth client in Google Cloud (Android, the package name,
  that key's SHA-1), then Play Games → Configuration → Add credential → Android → pick it →
  Review and publish. Without the upload-key one, a locally built release APK cannot sign in;
  without the app-signing one, the copy testers install from Play cannot.
- The app-signing SHA-1 lives at **Protected with Play → Automatic protection → Manage** (the
  App signing page; the old Setup → App signing and App integrity pages redirect there). Under
  "App signing key → Classical key" the **SHA-1 certificate fingerprint** button copies it.
  The fingerprints lower on that page are the upload key.

## 5. Listing and policy forms

- **Main store listing**: title and descriptions from `listing.md`; icon
  `docs/store/icon-512.png`; feature graphic 1024×500 and phone screenshots (Claude regenerates
  both from the current build on request).
- **App content** (Policy → App content), answers for this app:
  - Privacy policy: `https://mochitg45.github.io/afterlife-bureaucracy/privacy.html`
  - Ads: **Yes** (AdMob rewarded).
  - App access: everything available without special access.
  - Content rating: IARC questionnaire; casual game, cartoon humour, no violence answers apply.
    Expect Everyone / PEGI 3.
  - Target audience: 13 and over. Do not include under-13.
  - Data safety: collects **App activity** (game progress via Play Games cloud save) and
    **Device or other IDs** (advertising ID via AdMob); encrypted in transit; deletion on
    request via the support email. Purchases are handled by Google Play, not collected.
  - Government app, Financial features, Health: No.
- **Store settings**: Game → Simulation, tags Idle and Clicker. Contact email
  `inatasunsoft@gmail.com`.

## 6. Closed testing (Test and release → Testing → Closed testing)

1. Say when steps 1–5 are done; Claude builds the signed bundle
   `android/app/build/outputs/bundle/release/app-release.aab`.
2. **Create new release** → upload the AAB → name `1.0.0 (1)` → notes "First closed test."
3. **Testers** tab: create an email list with the 12 testers. Send them the **opt-in URL**;
   they open it once, then install from Play.
4. **Review release** → **Start rollout to Closed testing**. Google's first review takes hours
   to days.
5. **License testing** is on the account-level page: All apps → Settings → Monetization →
   License testing. Add the tester emails so purchases are free for them.

## 7. Before closing the laptop

- Back up `C:\Users\mochi\Documents\Claude\afterlife-keys\` off this PC. Losing the upload key
  means a new app listing.
- Never commit `android/key.properties` or the `.jks`.

## Play Games publishing assets (already generated)

`npm run play-assets` writes `docs/store/play-games/`:

- `feature-1024x500.png`: the Play Games feature graphic (also usable as the store listing's).
- one 512×512 PNG per mirrored achievement, named by achievement id.
- `achievements.md`: the paste sheet (name, description, Play id, icon file) for the 20 rows.

Properties page: Description = the short description in `listing.md`; Game category = Simulation;
Icon = `docs/store/icon-512.png`; Feature graphic = the file above.

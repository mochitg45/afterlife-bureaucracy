# Play Console: what to do next (closed testing)

The field-level companion to `docs/release.md` step 4. Every id and name below is what
`src/platform/billing.ts` asks the store for, so the app finds them with no code change.
Package: `com.afterlifebureaucracy.game`.

## 1. In-app products (Monetize with Play → Products → In-app products)

**Create product** six times. Product ID exactly as written, Name as written, then **Set
price** in USD (Play converts the rest). Save, then **Activate** each one.

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

- **Create subscription** → Product ID `union_monthly`, Name `Union Membership`.
- **Add base plan**: ID `monthly`, auto-renewing, 1 month, 3.99 USD.
- Activate the base plan, then the subscription.

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
- After the first AAB upload (step 6) return to **Credentials** and add one more Android
  credential with the **Play app-signing** SHA-1 (Setup → App signing → "App signing key
  certificate"). Play re-signs the store build with that key, so sign-in from Play needs it.

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
5. **Setup → License testing**: add the same tester emails so purchases are free for them.

## 7. Before closing the laptop

- Back up `C:\Users\mochi\Documents\Claude\afterlife-keys\` off this PC. Losing the upload key
  means a new app listing.
- Never commit `android/key.properties` or the `.jks`.

# Google Play listing — Afterlife Bureaucracy

Everything the Play Console asks for, written out so the submission is copy-and-paste rather
than improvisation. Two fields are deliberately unfilled and must be set by a human before
submission; they are marked `[… — fill before publishing]` and tracked in `ids.md`.

- Package: `com.afterlifebureaucracy.game`
- Default language: English (United States)
- App or game: **Game** · Category: **Simulation** (secondary: Casual)
- Free, with in-app purchases and ads
- Privacy policy URL: <https://mochitg45.github.io/afterlife-bureaucracy/privacy.html>
  (served from `docs/privacy.html`; GitHub Pages must be enabled first — see `docs/release.md`)
- Developer name shown on the listing: `Inata Sun`
- Support email: `inatasunsoft@gmail.com`

---

## Title (30 characters max)

```
Afterlife Bureaucracy
```

21 characters.

## Short description (80 characters max)

```
Stamp souls. Chase quotas. Climb the org chart of the hereafter. An idle game.
```

77 characters.

## Full description (4000 characters max)

```
Death is not the end. It is an intake form.

You are the newest clerk at the Afterlife Bureau, and the queue is out of the door. Stamp
souls, hire staff who stamp for you, and discover that the celestial civil service runs on
exactly the same logic as every office you ever left.

STAMP, THEN STOP STAMPING
Tap the stamp to process souls by hand. Then hire Dave the overtime reaper, Seraphine the
temp angel and Gary the unionised demon intern to do it while you are gone. Buy upgrades
nobody approved. Watch the numbers get silly.

FIVE DEPARTMENTS, ONE ORG CHART
Intake, Limbo Records, Heaven Admissions, Hell Compliance and the Reincarnation Desk. Each
has its own staff, its own upgrades and its own opinions about the others.

FILE AN AUDIT, START AGAIN, GET FASTER
When the fiscal year closes, file an Audit: reset the office, bank Departmental Seals and
spend them in the Perk Ledger on permanent bonuses. Every year is quicker than the last.

THE PERSONNEL REQUISITION LOTTERY
Spend Overtime Vouchers on staff cards, from Temps to Executives. Duplicates promote a card
up to five stars. Equip your best and let them multiply everything. Full odds are published
in the app, on the Odds screen, and in this listing.

THE OFFICE RUNS WITHOUT YOU
Close the app and your staff keep working. Come back to the Overnight Backlog Report and a
pile of souls processed in your absence. Daily tasks, streaks and eighty achievements keep
the paperwork coming.

NO ACCOUNT, NO NONSENSE
Plays offline. No sign-up, no login, nothing collected about you. Optional rewarded ads only
- no banners, no interstitials, nothing that interrupts a stamp.
```

## Graphics checklist

| Asset | Requirement | Where it comes from |
|---|---|---|
| App icon | 512×512 PNG, 32-bit | `docs/store/icon-512.png` (`npm run icon`) |
| Feature graphic | 1024×500 PNG or JPG | **still to draw** — blocked on the visual design pass |
| Phone screenshots | 2–8, min 320 px, max 3840 px | `docs/store/screenshots/*.png`, 1080×1920 (`npm run screenshots`) |
| Tablet screenshots | optional | not planned for v1.0 (portrait phone game) |

The five committed screenshots are real frames of the real build against a seeded save
(Office, Personnel, Ledger, Tasks, Overnight Backlog Report). They are placeholders only in
that the art direction is not final; reshoot with `npm run screenshots` after any UI change.

---

## In-app products

Create each of these in Play Console → Monetize → Products, using exactly these IDs — the app
looks them up by ID through RevenueCat, and a typo means the product silently does not exist.
The prices below are the intended US tiers and the fallback strings in
`src/platform/billing.ts`; **confirm each one in Play Console**, which is the source of truth at
runtime (the app always displays the store's own localised price, never these).

### One-time products (managed products)

| Product ID | Name | Price (US, confirm in Play Console) | What the player gets |
|---|---|---|---|
| `vouchers_10` | 10 Overtime Vouchers | $0.99 | 10 vouchers, granted exactly (purchases are never multiplied) |
| `vouchers_55` | 55 Overtime Vouchers | $4.99 | 55 vouchers |
| `vouchers_120` | 120 Overtime Vouchers | $9.99 | 120 vouchers |
| `vouchers_300` | 300 Overtime Vouchers | $19.99 | 300 vouchers |
| `remove_ads` | Exempt From Advertising | $4.99 | Permanent ×2 on the Overnight Backlog Report. Nothing is ever forced on the player — the rewarded buttons stay optional either way, and there are no other ad prompts to remove |
| `starter_pack` | New Clerk Starter Pack | $2.99 | Offered once, only while days since first launch ≤ 3: 20 vouchers, the Senior Staff card Grandma Liu at 1 star, and Karma Credits equal to 30 minutes of current income |

### Subscription

| Product ID | Base plan | Price (US, confirm in Play Console) | What the player gets |
|---|---|---|---|
| `union_monthly` | Monthly, auto-renewing | $3.99 / month | +25% to all output while active, 2 vouchers on every daily rollover, and daily tasks auto-claim when finished |

Purchases are validated locally through the billing library. There is no server receipt
validation, which is a deliberate v1.0 scope decision (spec §9).

---

## Loot-box / randomised item odds

Play policy and App Store Review Guideline 3.1.1 both require the odds to be disclosed before
purchase. The numbers below are the constants in `src/engine/gacha.ts` and are the same ones
the in-app Odds screen renders (Personnel tab). If one changes, all three must.

**Personnel Requisition Lottery.** One Overtime Voucher per single draw, nine per ten-draw.
Vouchers are earned through daily tasks, streaks and achievements, and may also be bought.

| Rarity | Probability per draw |
|---|---|
| Temp | 70% |
| Full-Time | 22% |
| Senior Staff | 6.5% |
| Executive | 1.5% |

Guarantees ("pity"): **Senior Staff or better at least once in every 10 draws**, and
**Executive at least once in every 60 draws**. The counters persist across sessions and across
Audits. A draw of a card already at five stars converts to Karma Credits instead.

Copy for the store description and the IARC questionnaire:

> This game contains randomised paid items. Overtime Vouchers can be purchased and spent on the
> Personnel Requisition Lottery. The chance of each rarity is Temp 70%, Full-Time 22%,
> Senior Staff 6.5%, Executive 1.5%, with a Senior Staff or better guaranteed within every 10
> draws and an Executive within every 60.

---

## Content rating (IARC questionnaire)

Category: **Game**. Answer as follows; every answer is checked against what the build actually
does.

| Question | Answer |
|---|---|
| Violence — realistic, fantasy, or cartoon | No |
| Blood, gore, injury | No |
| Sexuality, nudity, suggestive content | No |
| Profanity or crude humour | No profanity. Mild comic references to death, office life and bureaucracy |
| Controlled substances (drugs, alcohol, tobacco) | No |
| Horror or fear-inducing content | No. Death is the setting and the joke; nothing is depicted as frightening |
| Discrimination or hate | No |
| Gambling — real money wagering or cash-out | No |
| Randomised items purchasable with real money or a purchasable currency | **Yes** — declare the Personnel Requisition Lottery and supply the odds above |
| In-app purchases | Yes |
| Advertising | Yes, rewarded video only |
| Shares user location | No |
| User interaction or user-generated content | No. No chat, no multiplayer, no social features beyond the Play Games achievements and lifetime-souls leaderboard (wired in the build; console ids pending, see `ids.md`) |
| Digital purchases / unlockable content | Yes |

Expected outcome: ESRB **Everyone**, PEGI **3** or **7**, USK **0**, with the "in-app
purchases" and "contains ads" interactive-elements flags. Re-run the questionnaire if any of
the above changes.

---

## Data safety form

Google's Data safety declaration covers what the app *and its SDKs* do, not only what the
developer sees. The app itself collects nothing; the three SDKs below do.

**Does your app collect or share any of the required user data types?** **Yes** (through the
advertising, billing and Play Games SDKs).

**Is all of the user data collected by your app encrypted in transit?** **Yes** — every SDK
uses HTTPS.

**Do you provide a way for users to request that their data is deleted?** **Yes** — the privacy
policy documents the route for each service (reset the Advertising ID, contact us for
RevenueCat records, delete Play Games data from the Google account).

**Has your app been independently validated against a global security standard?** No.

| Data type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|
| Device or other IDs (Advertising ID) | Yes | Yes | Required | Advertising or marketing; analytics (AdMob) |
| App interactions (ad impressions, clicks, rewards) | Yes | Yes | Required | Advertising or marketing; analytics (AdMob) |
| Purchase history | Yes | Yes | Required | App functionality — restoring purchases and entitlements (RevenueCat, Play Billing) |
| Other user IDs (pseudonymous RevenueCat app user ID) | Yes | Yes | Required | App functionality — restoring purchases (RevenueCat) |
| App activity / game progress (saved-game snapshot: departments, staff, cards, currencies, statistics, settings) | Yes | Yes | Optional | App functionality — cloud save backup via Play Games saved games |
| Approximate location (derived from IP by the ad SDK) | Yes | Yes | Required | Advertising or marketing (AdMob) |
| Personal info (name, email, address, phone number) | No | No | — | — |
| Photos, videos, audio, files, contacts, calendar, messages | No | No | — | — |
| Health, fitness, financial info (including payment info) | No | No | — | — |
| Precise location | No | No | — | — |
| App info and performance (crash logs, diagnostics) | No | No | — | — |

Play Games sign-in is optional and off by default. If the player signs in, their Play Games
gamer ID and their achievement and leaderboard scores go to Google; declare that under **Device
or other IDs**, marked *Optional*, purpose *App functionality*, where the console offers the
distinction. If the player also lets the game back up their save, the saved-game snapshot
itself is declared separately under **App activity**, also *Optional*, purpose *App
functionality* — it is encrypted in transit like every other SDK call, and the player can have
it deleted by signing out in Settings and deleting the snapshot from Play Games Services in
their Google account (Data & privacy → Play Games Services), the same route as any other Play
Games data.

### App content declarations

- **Ads:** yes, this app contains ads. Format: rewarded video only. Not targeted at children.
  Ad network: Google AdMob.
- **Advertising ID permission:** declared and used — `com.google.android.gms.permission.AD_ID`
  is in the manifest; purpose: **Advertising or marketing**.
- **Target audience and content:** 13+. Not designed for children; not enrolled in Designed for
  Families.
- **Government apps, financial features, health:** none.
- **News app:** no. **COVID-19 contact tracing:** no.
- **Data deletion:** no account exists, so there is no in-app account-deletion path; point the
  console at the privacy policy URL.

---

## Release notes (what's new — first release)

```
Opening day at the Afterlife Bureau. Five departments, eighty achievements, one stamp.
```

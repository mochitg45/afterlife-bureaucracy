# Invite friends and share

Android only. iOS and web hide the card and never touch Firebase. Rewards are paid in
vouchers.

- **Share** the invitation image plus a pitch and your link: 10 vouchers, once ever
  (`state.referral.shareRewarded`).
- **Invite tiers** by genuine friends: 3 -> 40, 5 -> 60, 10 -> 150 vouchers, each once
  (`state.referral.claimedTiers`). A friend is genuine once they installed from your link and
  filed their first Annual Audit.

Link: `https://play.google.com/store/apps/details?id=com.afterlifebureaucracy.game&referrer=ref%3D<CODE>`

## Model (Firebase Spark, no Cloud Functions)

Everyone is an anonymous Firebase Auth user. Firestore:

| Doc | Fields | Written by |
| --- | --- | --- |
| `/codes/{code}` | `uid` | the inviter, once. Code = 8 chars of `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, retried on collision |
| `/devices/{deviceHash}` | `uid`, `at` | the invitee, create-only; hash = SHA-256 of `ANDROID_ID` |
| `/referrals/{inviteeUid}` | `inviterUid`, `deviceHash`, `qualified`, `createdAt` | the invitee on first launch; later flips `qualified` false -> true |

Flow:

1. Inviter opens the sheet: gets (or mints) a code, shares the link.
2. Invitee installs from the link. On first launch the native `Referral` plugin reads the Play
   install referrer (`ref=CODE`) and the device hash. If the code resolves to another uid, one
   transaction creates the device doc and the referral doc. If the device doc already exists the
   create is refused and nothing is written, so a device can only ever be referred once.
3. When the invitee files their first Annual Audit (`stats.audits >= 1`) the client sets
   `qualified: true` on its own referral doc.
4. The inviter's count is `getCountFromServer` over `referrals` where `inviterUid == me` and
   `qualified == true`. Claiming a tier is a local, once-only state change.

## Anti-abuse

- App Check with Play Integrity is enforced on Firestore: requests must come from a genuine
  install of the signed app on a real device.
- Auth required everywhere; codes are `get`-only (no listing, so no enumeration).
- `devices` is create-only and unreadable: one referral per physical device, whatever the
  account. A referral can only be created together with its device doc (`getAfter` in the rule).
- A referral cannot name its own creator as inviter, and must start `qualified: false`.
- `qualified` can only go false -> true, only by the invitee, touching no other field.
- Counting is only allowed as a query filtered to the caller's own `inviterUid`.
- Known limit: the invitee's own client reports the first audit, so a determined rooted user
  could qualify early. The cost of faking is a real device plus a Play Integrity pass per
  friend; the rewards are small.

Everything is best-effort. Offline, no Play services or an App Check failure shows "Couldn't
reach the referral office, try later" and the game carries on. Unfinished steps are retried on
the next launch / audit.

## Firebase console steps (project `afterlife-bureaucracy`)

1. **Authentication** -> Sign-in method -> enable **Anonymous**.
2. **Firestore Database** -> Create database -> **Production mode** (pick a region).
3. **Firestore** -> Rules -> paste `firestore.rules` from the repo root -> **Publish**. (Or
   `firebase deploy --only firestore:rules`; `firebase.json` already points at the file.)
4. **App Check** -> Apps -> the Android app `com.afterlifebureaucracy.game` -> **Play Integrity**
   -> register. Add the app's **SHA-256** certificate fingerprints: the *Play app signing* key
   (Play Console -> Test and release -> App integrity -> App signing) and your upload key. Also
   enable the Play Integrity API for the linked Google Cloud project if prompted.
5. **App Check** -> APIs -> **Cloud Firestore** -> **Enforce**. (Also enforce Authentication
   once you have confirmed tokens arrive, if you want.)
6. **Firestore** -> Indexes: the count query is two equality filters, so no composite index is
   needed. If the console asks for one, accept it.
7. **Project settings** -> General -> Your apps -> **Add app -> Web**. Copy its config into
   `src/platform/firebaseConfig.ts` (`apiKey`, `messagingSenderId`, `appId`; the other fields are
   already set). The web API key is not a secret.
8. Build with `npm run cap:sync`, run on a real Android device with Google Play (Play Integrity
   does not pass on most emulators). For a debug build, run once with
   `FirebaseAppCheck.initialize({ debug: true })`, copy the debug token from logcat and add it
   under App Check -> Apps -> Manage debug tokens.

Test: install from a link built for a second device's account, file an Annual Audit there, then
open Invite friends on the first device: the count goes to 1.

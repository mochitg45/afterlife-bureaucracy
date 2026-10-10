# Google Ads: App campaign for Afterlife Bureaucracy

Everything needed to create the campaign in Google Ads, ready to copy and paste.
Nothing here has been created or paid for yet.

## 1. Before you create the campaign (one time)

1. **Link Firebase to Google Ads.** Firebase console → project `afterlife-bureaucracy` → Project settings → Integrations → Google Ads → Link. This lets Google count installs and in-game events.
2. **Import conversions.** Google Ads → Goals → Conversions → New → App → Google Analytics 4 (Firebase). Import:
   - `first_open` (an install that was opened). Use this as the main goal for week 1–2.
   - `tutorial_complete` (a player who finished onboarding). Switch the goal to this once it has 30+ per week. It brings players who stay, not just installs.
   - `iap_purchased` (secondary, for reporting).
3. **Link Google Play** in Google Ads → Tools → Linked accounts → Google Play (same developer account, INATA SUN).
4. **Upload the trailer and Short to the Inata Sun Soft YouTube channel**, with ads switched OFF on both. Google Ads uses YouTube links for video ads.

## 2. Campaign settings

| Setting | Value |
|---|---|
| Campaign type | App promotion → **App installs** |
| Platform | Android |
| App | Afterlife Bureaucracy: Idle (`com.afterlifebureaucracy.game`) |
| Campaign name | `GOOG_AppInstall_AndroidTest_Oct26` |
| Locations | Indonesia, Philippines (only two, so $1/day isn't spread thin; add Brazil/Mexico/Thailand when the budget grows) |
| Languages | All languages (the game ships in 9) |
| Bid strategy | Target cost per install: **$0.20** (raise to $0.30 if it barely spends) |
| Daily budget | **$1/day** (about $30 a month) |

Why these countries: installs are cheap there, and the game is already translated into Indonesian, Portuguese, Spanish and Thai. Use them to find which ads and images work, then add the US, UK, Canada, Australia and Germany with a separate campaign once the cost per `tutorial_complete` looks healthy.

At $1/day and $0.20 per install, expect about 5 installs a day. That is below the ~50 installs Google likes before it settles, so learning takes about 2–3 weeks instead of one, and results move slowly. Don't change the budget or the bid during that time. Later, raise the budget by at most 20% at a time.

## 3. Text ads

Headlines (max 30 characters):

```
Run the Afterlife Office
Stamp Souls, Earn Offline
Hire Reapers, Angels & Demons
New Events Every Weekend
Cute Idle Tycoon Game
```

Descriptions (max 90 characters):

```
Death is not the end. It is an intake form. Stamp souls and build an office empire.
Hire chibi reapers, angels and demons. Your office keeps earning while you are away.
Open Heaven and Hell, collect staff cards and climb the weekend event rankings.
A cozy, funny idle clicker. Tap, upgrade, relax. Free to play on Android.
Weekend events bring new rooms, staff and music. Win prizes for 1st, 2nd and 3rd.
```

## 4. Images (in this folder)

| File | Size | Use |
|---|---|---|
| `landscape-1200x628.png` | 1.91:1 | Landscape (required) |
| `square-1200x1200-01-intake.png` | 1:1 | Square (required) |
| `square2-1200x1200-07-halloween.png` | 1:1 | Square |
| `portrait-1200x1500-05-weekly-staff.png` | 4:5 | Portrait |
| `portrait2-1200x1500-03-requisition.png` | 4:5 | Portrait |

## 5. Videos

Add both YouTube links **from the Inata Sun Soft channel** (ads off):
- Landscape trailer (16:9)
- Vertical Short (9:16)

App campaigns without a vertical video lose most YouTube Shorts placements, so the Short matters.

## 6. What to watch (week 1–2)

| Metric | Healthy | Action if not |
|---|---|---|
| Cost per install | under $0.30 | Swap the weakest image or headline (Google marks them "Low") |
| Install → tutorial_complete | above 40% | The ad promises something the game doesn't show first; change the angle |
| Spend | reaching about $1/day | Raise the target cost per install by $0.05 |

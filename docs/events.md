# Events — design and schedule

Content: `src/data/events.json` (weekly + specials) and `src/data/event-cards.json` (24 special
and 56 weekly event-only cards). The schedule is computed in code from date rules, so it repeats every year with no update
and no server. All times are UTC.

## Schedule

| Event | Window (UTC, end exclusive) | 2026–27 dates |
|---|---|---|
| **Weekly: Overflow Weekend** | every Friday 00:00 → Monday 00:00, unless a special event is running | every weekend |
| Halloween — *Night of the Living Paperwork* | 10-23 → 11-03 | Fri 23 Oct – Mon 2 Nov 2026 |
| Christmas — *Holiday Overtime* | 12-18 → 12-29 | 18 – 28 Dec 2026 |
| New Year — *Fiscal New Year* | 12-30 → 01-06 | 30 Dec 2026 – 5 Jan 2027 |
| Valentine's — *The Soulmates Registry* | 02-11 → 02-18 | 11 – 17 Feb 2027 |
| Easter — *The Resurrection Desk* | Easter − 3 days → Easter + 4 days | 25 – 31 Mar 2027 (Easter 28 Mar) |
| Summer — *Beach Purgatory* | 07-17 → 07-28 | 17 – 27 Jul 2027 |

Weekly themes rotate one per week (weeks counted from Fri 2 Jan 2026): The Great Backlog, Tax
Season in Purgatory, Mercury Retrograde Jam, Lost Socks Amnesty, The Printer Exorcism, Casual
Friday Eternally. A weekend that overlaps a special event is skipped.

Every weekly theme (14 in all, including the Valhalla feast and the seven sins) has its own
event-only gacha banner, like a special: 4 cards per theme (temp/fulltime/senior are that theme's
three staff, `c-wk-<theme>-1/2/3`; the featured executive is `c-wk-<theme>-x`). The banner is set
per theme in `events.json` (`banner: { name, featured }`); `pullEvent` draws only cards whose
`event` is that theme id. Every special and every banner-bearing theme must have exactly one card
of each rarity (checked in `content.ts`).

Occurrence keys: `halloween-2026`, `weekly-2026-10-09` (the Friday it starts). Progress belongs to
one key; when the key changes the event state resets.

## How an event plays

- **Event department.** A temporary tab with its own currency (Candy Corn, Gift Tags, …), a stamp to
  tap, and 3 (weekly) or 5 (special) staff bought with that currency. Cost of the n-th hire:
  `baseCost × 1.15^n`. Rate: `Σ baseRate × owned × (1 + eventMult from cards)`. Tap: `1 + 5% of rate`.
  It accrues while playing and offline (same offline cap and rate as the office).
- **Reward track.** Tiers by total currency *earned* this event (spending does not lower it):
  vouchers, Seals, and for specials three event cards. Claimed with a tap; tiers reached but not
  claimed are granted automatically when the event ends.
- **Pacing.** The last tier takes the fastest card-less player (online and tapping nonstop, always
  buying the best hire) 72 hours on a special and about 60 of the weekend's 72. A player who checks in
  three times a day for half an hour finishes an 11-day special on its last day and gets 3–4 of the 6
  weekend tiers; event cards (+10–35% each, more with stars) close the gap. Guarded by the
  `event pacing` tests in `src/engine/events.test.ts`.
- **Event banner (specials only).** Pulled with vouchers at the normal price (10 / 90). Each rarity
  roll gives that event's card of the rolled rarity; pity is shared with the normal banner. The
  executive card is banner-only. Event cards never drop from the normal banner.
- **Event cards** are kept forever. Temp/full-time/senior give `eventMult` (+10/20/35% event
  currency in every future event, scaled by stars); executives give +6% all output.

## Not in v1

Remote JSON config, a per-event Play Games leaderboard, and an end-of-event recap screen. The
mockup is at https://claude.ai/artifact/F5sNNqBwEt2BZDeHjxMfep.

## Preview

Dev and test-ads builds accept `?event=<special id or weekly>` (or `localStorage['afterlife.forceEvent']`)
to run an event now.

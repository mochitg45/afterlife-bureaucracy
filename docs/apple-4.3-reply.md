Hello, and thank you for the questions. Our answers to each are below.

1. What the app does and the problem it solves

Afterlife Bureaucracy is a single-player idle management game. The player runs the office that processes newly arrived souls in the afterlife. Each soul arrives with a face, a cause of death and a request, and the player stamps it through by tapping, then hires staff (reapers, angels, demons and clerks) who keep stamping automatically, including while the app is closed. Income is spent on more staff and upgrades across six departments: Intake, Heaven, Hell, Limbo, Reincarnation and Valhalla. When progress slows, the player files an Annual Audit, which resets the office in exchange for Departmental Seals that buy permanent perks, so each run goes faster than the last. A later layer, Cosmic Restructuring, changes the rules of the game itself.

Alongside the core loop there are 30 personnel cards drawn with Requisition Vouchers (odds are shown in the app), daily tasks and streaks, 80 achievements, an Overnight Backlog Report on return, and weekend and seasonal events with their own staff and 80 event cards.

The problem it solves: idle games are often played in short gaps in the day, and many feel like a spreadsheet with no personality. Afterlife Bureaucracy gives the genre a setting and a sense of humour: 290 written soul stories, named characters and satirical office jokes. Progress is meaningful in a few minutes a day, and the game never forces the player to watch an ad.

2. Intended user

Teenagers and adults who enjoy idle, clicker and incremental games: people who like watching numbers grow, planning upgrades and coming back a few times a day for a short session. It also suits players who like gentle, dark-but-cozy humour about bureaucracy and office life, because much of the content is jokes about forms, unions, audits and red tape applied to the afterlife.

The game needs no account. It works offline, and it is designed for short sessions: a player can open it on a commute, collect the overnight report, make a few decisions and close it. Players who want longer sessions get prestige planning, card collection and events. Purchases are optional, and everything in the game can be earned by playing. The app is not designed for or directed at children under 13.

3. Need or gap it addresses

Most idle games on the App Store are themed as mining, farming, factories or fantasy battles, and their content is mostly numbers. Few treat the setting itself as content. Afterlife Bureaucracy is built around writing and characters: every soul in the queue is an individual story (pets included), every department has its own staff and visual style, and the progression systems are framed as office procedure (audits, requisitions, union rules), so the theme and the mechanics support each other.

We also wanted an idle game that respects the player's time and attention. There are no forced ads and no banners. The only ads are rewarded videos the player chooses to watch, and offline earnings have a cap, so a few visits a day are worthwhile without constant checking. Card odds are published in the app, and duplicate cards always have a use (they level a card up to five stars, and spare copies of a maxed card can be exchanged), so collecting never dead-ends. That combination of a writing-led setting, honest pacing and no forced interruptions is what we did not find in the idle games we played.

4. Beta testing and changes applied from it

We tested on Google Play before the App Store. The game has run in a Google Play closed test (the alpha track) since 20 September 2026; the build currently there is 1.1.2 (build 5). Testers received a written brief asking them to play the intro, leave the app closed and check the Overnight Backlog Report, pull and equip a card, file an Audit and watch a rewarded ad, and to report anything slow, confusing or broken. Version 1.1.4 (build 7) was sent to Google for production review on 9 October 2026. The game is now live on Google Play, and the current production build is 1.1.13 (build 16).

Changes we made after playtesting the test builds on devices, all recorded in our project history:
- We rescaled the voucher economy by ten (a pull costs 10 and a ten-pull 90) and set the rarest card tier to 0.5 percent.
- We added a card detail sheet that shows a card's current bonus and its next star before equipping it.
- We fixed a hire made with exactly enough money being refused, which also stalled the tutorial.
- We fixed the colour palette breaking on older Android WebViews.
- Achievement pop-ups now wait until any other open report closes, and every achievement shows the prize it paid.
- Daily tasks that could not be completed in some states are no longer offered.
- Events now unlock after the first 10 hires instead of from the start.
- The card reveal was rebuilt so cards are dealt face down and turned over one by one.

5. Standalone product or part of a suite

Afterlife Bureaucracy is a standalone game. It is one of several independent apps published by Inata Sun Soft, a small independent developer, but none of them depend on each other or form a suite. Each is a different kind of app:
- Afterlife Bureaucracy: Idle (this app): an idle management game about running the afterlife's office.
- CUCO Currency Converter: a currency conversion utility.
- Decant: Water Sort Puzzle: a puzzle about sorting coloured liquids into tubes.
- Mental Health: Smile: guided wellness courses and self-checks.
- Sunpane: a logic puzzle about mixing coloured stained-glass panes.
- Peek-a-Pop: a fruit matching puzzle.
- Group Snap: a puzzle about arranging cute animals into groups.
- Loomwork: Weave Puzzle: slide ribbons on a loom until the cloth matches a weave pattern.
- Topple Jam: Domino Sort Puzzle: tap a domino to start a chain and catch the falling pieces in a tray.
- Echo Deep: a one-thumb arcade game where a whale sings sonar to see in a dark trench.

Afterlife Bureaucracy is our only idle or management game. It is the only one with long-term progression (prestige, perks, card collection and events), and its setting, characters, writing and art appear in none of the others.

6. Could it be an in-app purchase or expansion of another app?

No. Our other apps are short-session puzzle and arcade games, a currency converter and a wellness app. Afterlife Bureaucracy is a long-term idle game whose save grows over weeks: a growing economy, offline earnings, prestige resets, a card collection, daily streaks and recurring events. None of that fits inside a level-based puzzle, a utility or a wellness app, and adding it to one of them would mean shipping a second, unrelated game inside the first. Players looking for an idle management game would not find it there, and that app's users would get a feature unrelated to what they installed. It has its own audience, so it is its own app.

7. Shared code, frameworks or assets with our other apps

Yes, some of our own in-house plumbing, and we want to be open about it. All of it is our own code, not a third-party product:
- Studio splash screen: our Inata Sun Soft logo and jingle. It was first written for this app and is reused at the start of some of our other games.
- Ads service: our wrapper around the Google Mobile Ads plugin, with the consent form and the App Tracking Transparency prompt. Our other ad-supported games use the same approach.
- Purchases service: our wrapper around RevenueCat for buying and restoring purchases. Our other apps with purchases use the same approach.
- Save storage: saving the game through Capacitor's standard Preferences plugin, as our other apps do.
- App shell: all our apps use Capacitor, a standard open-source framework.

Not shared, and made only for this app: the whole game engine (economy, offline earnings, prestige and Audits, perks, Cosmic Restructuring, the card system and odds, daily tasks, achievements and events), the content (290 souls, 30 personnel cards, 80 event cards, six departments, the story and every line of text), the Game Center achievements and leaderboards, and all art, music and sound.

8. Shared codebase with third-party apps

No. Beyond standard third-party frameworks and libraries (Capacitor, React, Google Mobile Ads, RevenueCat, Apple GameKit and the open-source break_infinity.js large-number library), the app uses no third-party codebase, template, SDK or content library. The game design, engine, content, art and text are our own.

9. Created for a client, partner or third party?

No. Afterlife Bureaucracy is an Inata Sun Soft app, and Inata Sun Soft is an independent developer. There is no client, partner or outside content provider. We designed the concept, setting, characters, economy, progression and events, and we direct all of the work. We use AI tools in production: an AI coding assistant for code and Google Gemini for artwork. We review, edit and integrate everything these tools produce ourselves. No commercial template or app generation service produced the app; it is our own project, built step by step in our own repository since 14 September 2026. It is submitted under our account because we are its creator and publisher.

Thank you,
Inata Sun Soft

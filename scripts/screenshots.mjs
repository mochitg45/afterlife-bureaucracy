/**
 * Store listing screenshots: builds the web bundle, serves it, seeds a save into localStorage
 * and photographs each scene for three listing sizes — Play Store (1080×1920) into
 * `docs/store/screenshots/`, iPhone 6.9" (1320×2868) into `docs/store/screenshots/ios-6.9/`,
 * and iPad 13" (2064×2752) into `docs/store/screenshots/ios-ipad-13/`. See `PLATFORMS` below.
 *
 * The server is started and stopped by this script — nothing is left listening. Run with
 * `npm run screenshots`; Chromium comes from `npx playwright install chromium`.
 *
 * These are placeholders in the sense that the art is not final, but they are real frames of
 * the real app: everything on them comes from the engine rendering a seeded save.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storeDir = path.join(root, 'docs', 'store', 'screenshots');
const rawRoot = path.join(tmpdir(), 'afterlife-shots-raw');
const fontFile = path.join(root, 'node_modules/@fontsource/special-elite/files/special-elite-latin-400-normal.woff2');
const PORT = 4317;

/**
 * Three listing image sets from the same scenes: Play Store, and the two Apple sizes (iPhone
 * 6.9" and iPad 13") so this run covers both stores at once. Each captures its own raw shot at
 * a viewport matching that device's aspect ratio — stretching the Android phone shot over the
 * taller iPhone canvas would visibly distort it — and composes into its own canvas size.
 * `frame` picks the bezel style in compose(): 'phone' draws a notch, 'tablet' does not.
 */
const PLATFORMS = [
  { id: 'android', outDir: storeDir, width: 1080, height: 1920, raw: { width: 400, height: 890, dsf: 2 }, frame: 'phone' },
  { id: 'ios-6.9', outDir: path.join(storeDir, 'ios-6.9'), width: 1320, height: 2868, raw: { width: 430, height: 932, dsf: 3 }, frame: 'phone' },
  { id: 'ios-ipad-13', outDir: path.join(storeDir, 'ios-ipad-13'), width: 2064, height: 2752, raw: { width: 768, height: 1024, dsf: 2 }, frame: 'tablet' },
];

/** TODO: set false once the skill-tree Ledger redesign lands, then re-shoot. The old list-style ledger shot must not ship. */
const SKIP_LEDGER = true;

/** Must match `src/platform/storage.ts`; the web build persists the save under this key. */
const SAVE_KEY = 'afterlife.save.v1';

/** Mirrors `dayKey` in src/engine/dailies.ts — local calendar day, not UTC. */
function dayKey(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const json = async (rel) => JSON.parse(await readFile(path.join(root, rel), 'utf8'));

/**
 * A save deep enough that every tab has something to show: four departments open, a shelf of
 * cards, perks bought, an Audit worth filing, dailies half-done.
 *
 * `deserialize` filters unknown ids, so every id here is read back out of `src/data` rather
 * than typed from memory — a renamed card would otherwise vanish from the shot in silence.
 */
async function seedSave(now) {
  const cards = await json('src/data/cards.json');
  const story = await json('src/data/story.json');
  const byRarity = (r) => cards.filter((c) => c.rarity === r).map((c) => c.id);
  const owned = [...byRarity('temp').slice(0, 5), ...byRarity('fulltime').slice(0, 4), ...byRarity('senior').slice(0, 2), ...byRarity('executive').slice(0, 1)];
  const today = dayKey(now);
  return {
    saveVersion: 10,
    // Without it the RESET_EPOCH migration wipes the seeded progress and the shots show a fresh save.
    resetEpoch: 1,
    kc: '4.82e7',
    soulsRun: '9.4e9',
    soulsLifetime: '6.1e11',
    seals: 34,
    vouchers: 12,
    voucherFraction: 0.35,
    staff: { dave: 118, seraphine: 96, gary: 71, auditor: 44, 'h-cherub': 84, 'h-gatekeeper': 52, 'h-harpist': 30, 'h-archangel': 12, 'h-seraph': 3, 'd-imp': 90, 'd-steward': 58, 'd-hr': 33, 'd-foreman': 14, 'd-duke': 4 },
    upgrades: { 'faster-stapler': 8, 'ergonomic-chairs': 4, 'night-shift': 2, 'overtime-pay': 1 },
    deptsUnlocked: ['intake', 'limbo', 'heaven', 'hell'],
    activeDept: 'intake',
    fiscalYear: 4,
    boostUntilWall: 0,
    lastSeenWallClock: now,
    uptimeAtSave: 120000,
    stats: {
      clicks: 2140, staffHired: 329, upgradesBought: 15, audits: 3, pulls: 41,
      equips: 6, dailiesClaimed: 19, adsWatched: 12, perksBought: 7, cosmics: 0, purchases: 0,
    },
    perks: ['throughput-1', 'throughput-2', 'overtime-1', 'stapler-1', 'requisition-1'],
    cards: Object.fromEntries(owned.map((id, i) => [id, (i % 4) + 1])),
    equipped: owned.slice(0, 3),
    pity: { senior: 6, executive: 23 },
    rngSeed: 987654321,
    dailies: {
      date: today,
      tasks: [{ id: 'd-clicks-1', claimed: true }, { id: 'd-hire-1', claimed: false }, { id: 'd-rate-1', claimed: false }],
      skipped: [],
      streak: 6,
      bestStreak: 9,
      skipTokens: 1,
      lastTokenDate: today,
      baseline: { clicks: 2080, staffHired: 310, upgradesBought: 14, equips: 6, audits: 3, perksBought: 7, pulls: 41 },
      completedToday: false,
      soulsPerSecSnapshot: '1.4e7',
    },
    achievements: (await json('src/data/achievements.json')).slice(0, 22).map((a) => a.id),
    storySeen: story.map((s) => s.id),
    // 'yes' keeps the notification prompt off the shot; it is an OS dialog, not a feature.
    settings: { notifOptIn: 'yes', notifDate: today, notifsSent: 3 },
    firstSeenWallClock: now - 14 * 86400_000,
    entitlements: { removeAds: false, unionUntilWall: 0, starterPackBought: false },
    adState: { freePullDate: '', dailySkipDate: '', boostCooldownUntilWall: 0 },
    cosmicPoints: 0,
    cosmicClauses: [],
    branchesUnlocked: [],
    processId: 'screenshot',
    // Intro, training and every first-time tip are marked done: none of them belongs on a store frame.
    onboarding: { memosSeen: true, trainingStep: 3, tipsSeen: (await json('src/data/onboarding.json')).tips.map((t) => t.id) },
    event: null,
  };
}

/** Freeze the stamp slam, the ticker and every transition so frames are reproducible. */
const STILL_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
  /*
   * The seeded save clears achievements it has not "seen", so the first tick fires a toast
   * that parks itself over the memo ticker. It is real UI, just not what any of these frames
   * is about, and which badge wins the race varies run to run.
   */
  .toast, .coach-overlay { display: none !important; }
  /* The composed frame draws a notch over the top ~48px: keep headings and event headers clear of it. */
  * { scroll-margin-top: 56px; }
  .event-screen { padding-top: 48px !important; }
`;

/**
 * The queue line is picked with `Math.random()` (see `pick()` in src/store/game.ts), so which
 * soul — and whether it is a pet — shows on the "Now serving" card varies run to run. Pinning
 * `Math.random` to a constant makes `pick` deterministic; 0.88 was picked by checking the three
 * department queues these shots use (see src/data/departments/{intake,heaven,hell}.json) and
 * happens to land on a pet line in all three, so the office shots always show a pet face without
 * hand-picking an index per department. Nothing else on these screens reads `Math.random`
 * except inaudible noise generation in src/platform/audio.ts and a stamp-tap float's x-jitter,
 * which these shots never trigger.
 */
const PIN_RANDOM = () => { window.Math.random = () => 0.88; };

async function shoot(browser, url, rawDir, platform, { file, save, tab, waitFor, stopAtTitle, drawTen, scrollInto, clock, openEvent, eventTab }) {
  const context = await browser.newContext({
    // The platform's own device-shaped viewport, so the app lays out as it does on that real
    // handset or tablet instead of stretching one shot over every listing's canvas.
    viewport: { width: platform.raw.width, height: platform.raw.height },
    deviceScaleFactor: platform.raw.dsf,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(PIN_RANDOM);
  // Pinning the wall clock puts a weekly or seasonal event inside its window; no test-ads build needed.
  if (clock) await context.clock.install({ time: clock });
  if (save) {
    // Re-stamped to "now" at shoot time, not left at whatever `now` main() captured before the
    // build: this pipeline shoots three platforms end to end, and by the second or third one
    // enough real time has passed that the original timestamp reads as an offline gap over
    // MIN_OFFLINE_SECONDS (60s) — which pops an uninvited Backlog Report over every office shot.
    const freshSave = { ...save, lastSeenWallClock: clock ?? Date.now() };
    await context.addInitScript(
      ([key, value]) => {
        try { window.localStorage.setItem(key, value); } catch { /* seeding is best-effort */ }
      },
      [SAVE_KEY, JSON.stringify(freshSave)],
    );
  }
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.addStyleTag({ content: STILL_CSS });
  // STILL_CSS also freezes the splash, whose animationend never fires; a tap skips it.
  await page.getByTestId('splash').click({ timeout: 5000 }).catch(() => {});
  if (!stopAtTitle) {
    // Every cold boot opens on the title screen, so the office is one tap behind it.
    await page.getByRole('button', { name: 'Clock in' }).click();
    if (tab) await page.getByRole('tab', { name: tab }).click();
    if (drawTen) await page.getByRole('button', { name: 'Draw ten requisitions' }).click();
    if (openEvent) {
      await page.locator('.event-banner button').click();
      if (eventTab) await page.getByRole('tab', { name: eventTab }).click();
    }
  }
  await page.waitForSelector(waitFor, { state: 'visible', timeout: 15000 });
  if (scrollInto) await page.locator(scrollInto.selector).nth(scrollInto.index ?? 0).evaluate((el, block) => el.scrollIntoView({ block }), scrollInto.block ?? 'start');
  // The store's tick writes numbers a frame or two after mount; one settle beats a flaky race.
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(rawDir, file) });
  await context.close();
}

/**
 * The marketing frame: the raw shot inside a device bezel on ruled parchment, under a headline.
 * The bezel is drawn, so there is no device art to license. Every pixel value below was tuned
 * against the Android canvas (1080×1920) and then scaled by the platform's own width, so the
 * same layout holds proportion on the taller iPhone canvas and the squarer iPad one.
 *
 * The page background is opaque parchment with no transparent layer anywhere in the composed
 * DOM, and PNG screenshots only carry alpha where the source had it — so these come out with no
 * alpha channel, which the App Store requires.
 */
async function compose(browser, rawDir, platform, { file, headline, sub, chips, exec }) {
  const { width: W, height: H, frame } = platform;
  const s = W / 1080; // scale factor against the tuned-for-Android baseline
  const font = (await readFile(fontFile)).toString('base64');
  const shot = (await readFile(path.join(rawDir, file))).toString('base64');
  const bezelW = 620 * s;
  const charImg = (await readFile(path.join(root, 'docs', 'store', 'characters', `${exec.char}.png`))).toString('base64');
  const right = exec.side === 'right';
  // Character box: ~40% of canvas height, capped by width so the squarer iPad does not overflow.
  const charSize = Math.min(690 * s, 0.42 * H);
  // The screen inside the bezel has exactly the capture's aspect, so object-fit never crops the
  // app's left and right edges.
  const pad = 26 * s;
  const bezelH = (bezelW - 2 * pad) * (platform.raw.height / platform.raw.width) + 2 * pad;
  const notch = frame === 'phone'
    ? `<span class="notch" style="position:absolute;top:${44 * s}px;left:50%;transform:translateX(-50%);width:${130 * s}px;height:${34 * s}px;border-radius:${17 * s}px;background:#2A2620;"></span>`
    : '';
  const html = `<!doctype html><style>
    @font-face { font-family: 'Special Elite'; src: url('data:font/woff2;base64,${font}') format('woff2'); }
    html, body { margin: 0; } body { width: ${W}px; height: ${H}px; overflow: hidden; background: #EDE7D4;
      background-image: repeating-linear-gradient(to bottom, transparent 0 ${59 * s}px, #C9BFA6 ${59 * s}px ${60 * s}px); font-family: 'Special Elite', serif; color: #1F3B33; text-align: center; }
    h1 { font-size: ${66 * s}px; line-height: 1.1; margin: 0; padding: ${96 * s}px ${70 * s}px 0; text-wrap: balance; }
    p { font-size: ${32 * s}px; margin: ${18 * s}px ${80 * s}px 0; color: #2A2620; opacity: .75; }
    .chips { display: flex; justify-content: center; flex-wrap: wrap; gap: ${14 * s}px; margin: ${30 * s}px ${60 * s}px 0; }
    .chip { font-size: ${26 * s}px; padding: ${12 * s}px ${24 * s}px; border: ${3 * s}px solid #1F3B33; border-radius: 999px; background: #F7F2E4; color: #1F3B33; white-space: nowrap; }
    .chip.red { border-color: #A6402B; color: #A6402B; }
    .phone { position: absolute; ${right ? 'left' : 'right'}: ${44 * s}px; bottom: ${-260 * s}px; width: ${bezelW}px; height: ${bezelH}px; border-radius: ${(frame === 'phone' ? 96 : 48) * s}px; background: #2A2620; padding: ${pad}px; box-sizing: border-box; box-shadow: 0 ${40 * s}px ${80 * s}px rgba(42,38,32,.35); }
    .phone img { width: 100%; height: 100%; object-fit: cover; object-position: top; border-radius: ${(frame === 'phone' ? 72 : 30) * s}px; display: block; }
    .exec { position: absolute; bottom: ${10 * s}px; ${right ? 'right' : 'left'}: ${-90 * s}px; width: ${charSize}px; height: ${charSize}px; filter: drop-shadow(${8 * s}px ${14 * s}px ${14 * s}px rgba(42,38,32,.4)); ${right ? '' : 'transform: scaleX(-1);'} }
    .bubble { position: absolute; max-width: ${400 * s}px; padding: ${22 * s}px ${30 * s}px; background: #FFFDF4; border: ${5 * s}px solid #1F3B33; border-radius: ${34 * s}px; font-size: ${44 * s}px; line-height: 1.15; color: #1F3B33; box-shadow: ${6 * s}px ${8 * s}px 0 rgba(31,59,51,.25); transform: rotate(${right ? 3 : -3}deg); }
    .bubble::after { content: ''; position: absolute; bottom: ${-26 * s}px; ${right ? 'right' : 'left'}: ${70 * s}px; width: ${40 * s}px; height: ${40 * s}px; background: #FFFDF4; border: solid #1F3B33; border-width: 0 ${5 * s}px ${5 * s}px 0; transform: rotate(${right ? 55 : 35}deg) skew(${right ? -10 : 10}deg); }
  </style><body><h1>${headline}</h1><p>${sub}</p>
  <div class="chips">${chips.map((c, i) => `<span class="chip${i === 0 ? ' red' : ''}">${c}</span>`).join('')}</div>
  <div class="phone"><img src="data:image/png;base64,${shot}">${notch}</div>
  <img class="exec" src="data:image/png;base64,${charImg}"><div class="bubble">${exec.say}</div></body>`;
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  // A headline that wraps pushes its subtitle and chips down; the device must start below the
  // last line of text, never over it. It may run further off the bottom edge instead.
  await page.evaluate(({ gap, W: cw, H: ch, k, pad: pd, ratio, floorW }) => {
    const phone = document.querySelector('.phone');
    const textBottom = Math.max(...[...document.querySelectorAll('h1, p, .chips')].map((e) => e.getBoundingClientRect().bottom));
    const top = textBottom + gap;
    // Taller canvases (iPhone 6.9") have room to grow the device so it reaches the bottom edge; width is capped so the character still fits beside it.
    const w = Math.max(floorW, Math.min(0.64 * cw, (ch - top + 260 * k - 2 * pd) / ratio + 2 * pd));
    const h = (w - 2 * pd) * ratio + 2 * pd;
    Object.assign(phone.style, { top: `${top}px`, bottom: 'auto', width: `${w}px`, height: `${h}px` });
    // The character stands on the device's bottom edge, or the canvas edge when the device bleeds off it.
    document.querySelector('.exec').style.bottom = `${Math.max(10 * k, ch - (top + h) - 60 * k)}px`;
  }, { gap: 44 * s, W, H, k: s, pad, ratio: platform.raw.height / platform.raw.width, floorW: bezelW });
  // Bubble sits just above the character's head (the sprite's top ~10% is empty margin), on the outer side.
  await page.evaluate(({ size, right: r, s: k }) => {
    const b = document.querySelector('.bubble');
    const c = document.querySelector('.exec').getBoundingClientRect();
    b.style.top = `${c.top + size * 0.10 - b.offsetHeight - 30 * k}px`;
    b.style[r ? 'right' : 'left'] = `${28 * k}px`;
  }, { size: charSize, right, s });
  await page.screenshot({ path: path.join(platform.outDir, file) });
  await page.close();
  console.log(`  [${platform.id}] ${file}`);
}

async function main() {
  for (const platform of PLATFORMS) await mkdir(platform.outDir, { recursive: true });
  console.log('Building…');
  await build({ root, logLevel: 'warn' });

  const server = await preview({ root, preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
  const url = server.resolvedUrls?.local?.[0] ?? `http://localhost:${PORT}/`;
  const browser = await chromium.launch();
  try {
    const now = Date.now();
    const base = await seedSave(now);
    // Pinned clocks: a Friday inside the Valhalla weekly window, and a Wednesday inside Halloween.
    const VALHALLA = Date.UTC(2026, 11, 4, 12); // weekly-2026-12-04, "The Feast of Valhalla"
    const HALLOWEEN = Date.UTC(2026, 9, 28, 12); // halloween-2026, Haunted Records Annex
    const weeklySave = {
      ...base,
      lastSeenWallClock: VALHALLA,
      event: { key: 'weekly-2026-12-04', points: '2.4e6', earned: '3.1e7', staff: { 'w-temp': 48, 'w-stapler': 21, 'w-imp': 7 }, claimed: [0, 1] },
    };
    const haunted = {
      ...base,
      lastSeenWallClock: HALLOWEEN,
      event: { key: 'halloween-2026', points: '4.2e5', earned: '6.8e6', staff: { 'hw-ghost': 52, 'hw-mummy': 24, 'hw-pumpkin': 9 }, claimed: [0] },
    };
    const allShots = [
      {
        file: '01-intake.png',
        exec: { char: 'vassago', side: 'right', say: 'Stamp faster!' },
        save: base,
        waitFor: '.tabbar',
        headline: 'Stamp souls.<br>Meet quota.',
        sub: 'Every soul is a face and a form. Every form needs a stamp.',
        chips: ['Tap to stamp', 'Staff earn while you tap', 'Pets welcome'],
      },
      {
        file: '02-personnel.png',
        exec: { char: 'bodhisattva', side: 'left', say: 'Hire weirder!' },
        save: base,
        tab: 'Personnel',
        waitFor: '.tabbar',
        headline: 'Hire the damned<br>and the blessed.',
        sub: 'Collectible staff cards, each starring up to five stars.',
        chips: ['30+ collectible cards', 'Star up with duplicates', 'Free daily pull'],
      },
      {
        file: '03-requisition.png',
        exec: { char: 'seraph-board', side: 'right', say: 'Pull for legends!' },
        save: { ...base, vouchers: 120 },
        tab: 'Personnel',
        drawTen: true,
        waitFor: '[role="dialog"]',
        headline: 'Pull ten.<br>Reveal them all.',
        sub: 'A requisition never comes back empty-handed.',
        chips: ['Gacha pulls', 'Pity timers included', 'Duplicates bank as shards'],
      },
      {
        file: '04-ledger.png',
        exec: { char: 'keeper', side: 'left', say: 'Grow the tree!' },
        save: base,
        tab: 'Ledger',
        waitFor: '.perk-tree',
        scrollInto: { selector: '.perk-branch', index: 0 },
        headline: 'Grow a perk tree<br>nobody can audit.',
        sub: 'Spend Seals on permanent upgrades that survive every reset.',
        chips: ['40 permanent perks', 'Skill tree branches', 'Prestige by audit'],
      },
      {
        file: '05-weekly-staff.png',
        exec: { char: 'allfather', side: 'right', say: 'New theme every weekend!' },
        save: weeklySave,
        clock: VALHALLA,
        openEvent: true,
        eventTab: 'Staff',
        waitFor: '.event-screen',
        scrollInto: { selector: '.event-tabs' },
        headline: 'A new theme<br>every weekend.',
        sub: 'Limited-time staff, fresh art and prizes, Friday to Sunday.',
        chips: ['Weekly events', 'New staff every week', 'Free rewards'],
      },
      {
        file: '06-weekly-gacha.png',
        exec: { char: 'greed-toad', side: 'left', say: 'Rare executives!' },
        save: weeklySave,
        clock: VALHALLA,
        openEvent: true,
        eventTab: 'Gacha',
        waitFor: '.event-screen',
        scrollInto: { selector: '.event-tabs' },
        headline: 'Chase the featured<br>weekend executive.',
        sub: 'Every theme has its own event-only banner.',
        chips: ['Event-only banner', 'Featured executive', 'Limited time'],
      },
      {
        file: '07-halloween.png',
        exec: { char: 'pumpkin-cfo', side: 'right', say: 'Spooky season!' },
        save: haunted,
        clock: HALLOWEEN,
        openEvent: true,
        eventTab: 'Staff',
        waitFor: '.event-screen',
        headline: 'Seasonal specials.<br>Halloween is haunted.',
        sub: 'Holiday rooms, holiday staff, holiday prizes.',
        chips: ['Halloween', 'Christmas', 'Easter and more'],
      },
    ];
    const shots = allShots.filter((sh) => !(SKIP_LEDGER && sh.file === '04-ledger.png'));
    for (const platform of PLATFORMS) {
      const rawDir = path.join(rawRoot, platform.id);
      await mkdir(rawDir, { recursive: true });
      console.log(`Shooting [${platform.id}]…`);
      for (const shot of shots) await shoot(browser, url, rawDir, platform, shot);
      console.log(`Composing [${platform.id}]…`);
      for (const shot of shots) await compose(browser, rawDir, platform, shot);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(`Done — ${storeDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

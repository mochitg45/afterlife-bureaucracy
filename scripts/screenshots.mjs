/**
 * Apple store listing screenshots: serves the app with the Vite dev server (so scenes can reach the
 * store via `import('/src/store/game.ts')`), seeds a save into localStorage and photographs each
 * scene for iPhone 6.9" (1320x2868) into `docs/store/screenshots/ios-6.9/`, iPad 13" (2064x2752)
 * into `docs/store/screenshots/ios-ipad-13/`, then cover-crops the iPhone set to 1206x2622 into
 * `docs/store/screenshots/ios-6.3/`. The older Play Store set directly in `docs/store/screenshots/`
 * is left alone.
 *
 * The server is started and stopped by this script. Run with `npm run screenshots`; Chromium
 * comes from `npx playwright install chromium`. Everything on the frames is the real app
 * rendering a seeded save.
 */
import { mkdir, readFile, readdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storeDir = path.join(root, 'docs', 'store', 'screenshots');
const ios63Dir = path.join(storeDir, 'ios-6.3');
const rawRoot = path.join(tmpdir(), 'afterlife-shots-raw');
const fontFile = path.join(root, 'node_modules/@fontsource/special-elite/files/special-elite-latin-400-normal.woff2');
const PORT = 4317;

/**
 * The two Apple device sets. Each captures its own raw shot at a viewport matching that device's
 * aspect ratio and composes into its own canvas size. `frame` picks the bezel style in compose():
 * 'phone' draws a notch, 'tablet' does not. The 6.3" iPhone set is cropped from the 6.9" one.
 */
const PLATFORMS = [
  { id: 'ios-6.9', outDir: path.join(storeDir, 'ios-6.9'), width: 1320, height: 2868, raw: { width: 430, height: 932, dsf: 3 }, frame: 'phone' },
  { id: 'ios-ipad-13', outDir: path.join(storeDir, 'ios-ipad-13'), width: 2064, height: 2752, raw: { width: 768, height: 1024, dsf: 2 }, frame: 'tablet' },
];

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
 * A save deep enough that every tab has something to show: every department open, a shelf of
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
    staff: {
      dave: 118, seraphine: 96, gary: 71, auditor: 44,
      'h-cherub': 84, 'h-gatekeeper': 52, 'h-harpist': 30, 'h-archangel': 12, 'h-seraph': 3,
      'd-imp': 90, 'd-steward': 58, 'd-hr': 33, 'd-foreman': 14, 'd-duke': 4,
      'l-archivist': 40, 'l-lost-found': 22, 'l-forgotten': 9,
      'r-accountant': 36, 'r-placement': 18, 'r-actuary': 7,
    },
    upgrades: { 'faster-stapler': 8, 'ergonomic-chairs': 4, 'night-shift': 2, 'overtime-pay': 1 },
    deptsUnlocked: ['intake', 'limbo', 'heaven', 'hell', 'reincarnation'],
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
    login: { day: 3, lastDate: today },
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
  .toast, .coach-overlay, .checkin-pop, .offer, .milestone { display: none !important; }
  /* The composed frame draws a notch over the top ~48px: keep headings and event headers clear of it. */
  * { scroll-margin-top: 56px; }
  .event-screen { padding-top: 48px !important; }
  /* A real iPhone reports a top safe-area inset; the browser does not, so give the app the notch's room. */
  .app { box-sizing: border-box; padding-top: 44px; }
  .rush { padding-top: 52px !important; }
  .rush-pile { justify-content: center !important; }
`;

/**
 * The queue line is picked with `Math.random()` (see `pick()` in src/store/game.ts), so which
 * soul — and whether it is a pet — shows on the "Now serving" card varies run to run. Pinning
 * `Math.random` to a constant makes `pick` deterministic. Stamp Rush also reads it for the form
 * kinds, so that scene restores the real one first (see `playRush`).
 */
const PIN_RANDOM = () => { window.Math.random = () => 0.88; };

/** Reach the live store (same module instance the app uses) from the page; dev server only. */
const storeCall = (page, fn, arg) =>
  page.evaluate(async ({ src, arg: a }) => {
    const { useGame } = await import('/src/store/game.ts');
    // eslint-disable-next-line no-new-func
    return new Function('useGame', 'arg', `return (${src})(useGame, arg)`)(useGame, a);
  }, { src: fn.toString(), arg });

/** Two office incidents on the floor, one already half-fixed (memory-only state in the store). */
const injectIncidents = (page) =>
  storeCall(page, (useGame) => {
    const t0 = performance.now();
    useGame.setState({
      incidents: [
        { id: 9001, kind: 'printer', x: 64, y: 14, spawnedMono: t0, taps: 2, need: 4 },
        { id: 9002, kind: 'coffee', x: 18, y: 40, spawnedMono: t0, taps: 0, need: 3 },
      ],
    });
  });

/**
 * Plays Stamp Rush for real: opens the office card, starts the round and clears forms the way a
 * player would (tap, hold red ones, swipe gold ones) until a combo is on the meter, then stops
 * mid-round with forms still on the pile.
 */
async function playRush(page) {
  await page.evaluate(() => { window.Math.random = () => 0.6; }); // a mix of normal, red and gold forms
  await page.locator('.rush-entry .btn').click();
  await page.locator('.rush-go').click();
  await page.waitForSelector('.rush-doc', { timeout: 5000 });
  let done = 0;
  for (let i = 0; i < 80 && done < 11; i++) {
    const doc = page.locator('.rush-doc').first();
    const box = await doc.boundingBox().catch(() => null);
    if (!box) { await page.waitForTimeout(80); continue; }
    const kind = await doc.getAttribute('class').catch(() => '');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    try {
      if (kind.includes('flag')) {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.waitForTimeout(470);
        await page.mouse.up();
      } else if (kind.includes('special')) {
        await page.mouse.move(x - 40, y);
        await page.mouse.down();
        await page.mouse.move(x + 90, y, { steps: 6 });
        await page.mouse.up();
      } else {
        await page.mouse.click(x, y);
      }
      done++;
    } catch { /* the form expired under the pointer: next one */ }
    await page.waitForTimeout(120);
  }
  // Stop acting and let the pile fill (forms live ~3.8 s, so the combo survives) before the frame.
  await page.waitForFunction(() => document.querySelectorAll('.rush-doc').length >= 3, null, { timeout: 4000 });
}

async function shoot(browser, url, rawDir, platform, { file, save, tab, subTab, waitFor, drawTen, scrollInto, clock, openEvent, eventTab, clickTestId, run }) {
  const context = await browser.newContext({
    // The platform's own device-shaped viewport, so the app lays out as it does on that real device.
    viewport: { width: platform.raw.width, height: platform.raw.height },
    deviceScaleFactor: platform.raw.dsf,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(PIN_RANDOM);
  // The once-per-version "What's new" pop-up is marked seen; it is not what these frames show.
  const { version } = await json('package.json');
  await context.addInitScript((v) => { try { window.localStorage.setItem('whatsNewSeen', v); } catch { /* best-effort */ } }, version);
  // Pinning the wall clock puts a weekly or seasonal event inside its window; no test-ads build needed.
  if (clock) await context.clock.install({ time: clock });
  if (save) {
    // Re-stamped to "now" at shoot time: otherwise the gap since seeding reads as an offline absence
    // over MIN_OFFLINE_SECONDS (60s) and pops an uninvited Backlog Report over the shot.
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
  // Every cold boot opens on the title screen, so the office is one tap behind it.
  await page.getByRole('button', { name: 'Clock in' }).click();
  if (tab) await page.getByRole('tab', { name: tab }).click();
  if (subTab) await page.getByRole('tab', { name: subTab }).click();
  if (clickTestId) await page.getByTestId(clickTestId).click();
  if (drawTen) await page.getByRole('button', { name: 'Draw ten requisitions' }).click();
  if (openEvent) {
    await page.locator('.event-banner button').click();
    if (eventTab) await page.getByRole('tab', { name: eventTab }).click();
  }
  if (run) await run(page);
  await page.waitForSelector(waitFor, { state: 'visible', timeout: 15000 });
  if (scrollInto) await page.locator(scrollInto.selector).nth(scrollInto.index ?? 0).evaluate((el, block) => el.scrollIntoView({ block }), scrollInto.block ?? 'start');
  // The store's tick writes numbers a frame or two after mount; one settle beats a flaky race.
  // (Stamp Rush is live and must be photographed at once.)
  await page.waitForTimeout(file.includes('rush') ? 0 : 600);
  await page.screenshot({ path: path.join(rawDir, file) });
  await context.close();
}

/**
 * The marketing frame: the raw shot inside a device bezel on ruled parchment, under a headline.
 * The bezel is drawn, so there is no device art to license. Every pixel value below was tuned
 * against a 1080-wide canvas and then scaled by the platform's own width.
 *
 * The page background is opaque parchment with no transparent layer anywhere in the composed
 * DOM, so these come out with no alpha channel, which the App Store requires.
 */
async function compose(browser, rawDir, platform, { file, headline, sub, chips, exec }) {
  const { width: W, height: H, frame } = platform;
  const s = W / 1080; // scale factor against the tuned-for baseline
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
    // Taller canvases have room to grow the device so it reaches the bottom edge; width is capped so the character still fits beside it.
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

/** iPhone 6.3" (1206x2622) from the 6.9" frames: same aspect to within a pixel, so cover-crop. */
async function cropIphone63(browser, from, to, files) {
  await mkdir(to, { recursive: true });
  for (const f of await readdir(to)) if (f.endsWith('.png')) await unlink(path.join(to, f));
  const page = await browser.newPage({ viewport: { width: 1206, height: 2622 }, deviceScaleFactor: 1 });
  for (const file of files) {
    const b64 = (await readFile(path.join(from, file))).toString('base64');
    await page.setContent(`<body style="margin:0;background:#EDE7D4"><img src="data:image/png;base64,${b64}" style="display:block;width:1206px;height:2622px;object-fit:cover;object-position:center"></body>`);
    await page.waitForFunction(() => document.images[0].complete);
    await page.screenshot({ path: path.join(to, file) });
    console.log(`  [ios-6.3] ${file}`);
  }
  await page.close();
}

async function main() {
  for (const platform of PLATFORMS) {
    await mkdir(platform.outDir, { recursive: true });
    // Retire the previous set so no stale frames sit next to the new ones.
    for (const f of await readdir(platform.outDir)) if (f.endsWith('.png')) await unlink(path.join(platform.outDir, f));
  }

  const server = await createServer({ root, server: { port: PORT, strictPort: true }, logLevel: 'warn' });
  await server.listen();
  const url = `http://localhost:${PORT}/`;
  const browser = await chromium.launch();
  try {
    // Warm the dev server: first load optimizes dependencies and can reload the page once.
    const warm = await browser.newPage();
    await warm.goto(url, { waitUntil: 'networkidle' });
    await warm.waitForTimeout(1500);
    await warm.goto(url, { waitUntil: 'networkidle' });
    await warm.close();

    const now = Date.now();
    const base = await seedSave(now);
    const sets = await json('src/data/sets.json');
    const cards = await json('src/data/cards.json');
    // Collection Sets: the first set finished, the rest at different stages of progress.
    const progress = [6, 3, 2, 4, 1, 2];
    const setCards = { ...base.cards };
    sets.forEach((set, i) => set.cards.slice(0, progress[i] ?? 1).forEach((id, k) => { setCards[id] = (k % 3) + 1; }));
    const setsSave = { ...base, cards: setCards };
    // Departments: every one open, Hell on duty, the Valhalla branch unlocked too.
    const deptSave = {
      ...base,
      activeDept: 'hell',
      branchesUnlocked: ['valhalla'],
      deptsUnlocked: [...base.deptsUnlocked, 'valhalla'],
      staff: { ...base.staff, 'v-shieldmaiden': 30, 'v-skald': 14, 'v-quartermaster': 5 },
    };
    // Pinned clock: a Wednesday inside Halloween.
    const HALLOWEEN = Date.UTC(2026, 9, 28, 12); // halloween-2026, Haunted Records Annex
    const haunted = {
      ...base,
      lastSeenWallClock: HALLOWEEN,
      event: { key: 'halloween-2026', points: '4.2e5', earned: '6.8e6', staff: { 'hw-ghost': 52, 'hw-mummy': 24, 'hw-pumpkin': 9 }, claimed: [0] },
    };
    void cards;
    const shots = [
      {
        file: '01-office.png',
        exec: { char: 'vassago', side: 'right', say: 'Stamp faster!' },
        save: base,
        waitFor: '.tabbar',
        headline: 'Stamp souls.<br>Meet quota.',
        sub: 'Every soul is a face and a form. Every form needs a stamp.',
        chips: ['Tap to stamp', 'Staff earn while you tap', 'Pets welcome'],
      },
      {
        file: '02-stamp-rush.png',
        exec: { char: 'keeper', side: 'right', say: 'Keep the combo!' },
        save: base,
        run: playRush,
        waitFor: '.rush-doc',
        headline: 'Stamp Rush.<br>40 seconds. No mercy.',
        sub: 'Tap, hold and swipe the paperwork. Chain a combo for a bigger payout.',
        chips: ['Tap, hold, swipe', 'Combo up to 3x', 'Pays in souls'],
      },
      {
        file: '03-incidents.png',
        exec: { char: 'greed-toad', side: 'right', say: 'The printer is jammed again!' },
        save: base,
        run: injectIncidents,
        waitFor: '.oi-item',
        headline: 'The office fights back.<br>Fix it. Get paid.',
        sub: 'Jams, spills and lines pop up while you work. Tap them to clear the mess.',
        chips: ['Live office incidents', 'Quick fixes pay a bonus', 'Five kinds of chaos'],
      },
      {
        file: '04-sets.png',
        exec: { char: 'bodhisattva', side: 'right', say: 'Complete the set!' },
        save: setsSave,
        tab: 'Personnel',
        subTab: 'Sets',
        waitFor: '.sets-panel',
        scrollInto: { selector: '.personnel-tabs' },
        headline: 'Collect sets.<br>Earn permanent bonuses.',
        sub: 'Finish a staff set and its bonus switches on for good.',
        chips: ['Collection sets', 'Permanent bonuses', 'Silhouettes to chase'],
      },
      {
        file: '05-requisition.png',
        exec: { char: 'seraph-board', side: 'right', say: 'Pull for legends!' },
        save: { ...base, vouchers: 120 },
        tab: 'Personnel',
        drawTen: true,
        waitFor: '[role="dialog"]',
        headline: 'Pull ten.<br>Reveal them all.',
        sub: 'A requisition never comes back empty-handed.',
        chips: ['Collectible staff cards', 'Pity timers included', 'Duplicates bank as shards'],
      },
      {
        file: '06-departments.png',
        exec: { char: 'allfather', side: 'left', say: 'Heaven or Hell?' },
        save: deptSave,
        waitFor: '.dept-chips',
        headline: 'Heaven. Hell. Limbo.<br>Run every department.',
        sub: 'Each wing has its own staff, queue, upgrades and bureaucracy.',
        chips: ['Six departments', 'Unique staff in each', 'Unlock as you grow'],
      },
      {
        file: '07-ledger.png',
        exec: { char: 'keeper', side: 'right', say: 'Grow the tree!' },
        save: base,
        tab: 'Ledger',
        clickTestId: 'perk-branch-throughput',
        waitFor: '.pt-tree',
        scrollInto: { selector: '.pt-tree', index: 0 },
        headline: 'Grow a perk tree<br>nobody can audit.',
        sub: 'Spend Seals on permanent upgrades that survive every reset.',
        chips: ['40 permanent perks', 'Skill tree branches', 'Prestige by audit'],
      },
      {
        file: '08-halloween.png',
        exec: { char: 'pumpkin-cfo', side: 'right', say: 'Spooky season!' },
        save: haunted,
        clock: HALLOWEEN,
        openEvent: true,
        eventTab: 'Staff',
        waitFor: '.event-screen',
        headline: 'Seasonal specials.<br>Halloween is haunted.',
        sub: 'Holiday rooms, holiday staff, holiday prizes.',
        chips: ['Halloween', 'Weekend events', 'Free rewards'],
      },
    ];
    for (const platform of PLATFORMS) {
      const rawDir = path.join(rawRoot, platform.id);
      await mkdir(rawDir, { recursive: true });
      console.log(`Shooting [${platform.id}]…`);
      for (const shot of shots) await shoot(browser, url, rawDir, platform, shot);
      console.log(`Composing [${platform.id}]…`);
      for (const shot of shots) await compose(browser, rawDir, platform, shot);
    }
    console.log('Cropping [ios-6.3]…');
    await cropIphone63(browser, PLATFORMS[0].outDir, ios63Dir, shots.map((sh) => sh.file));
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

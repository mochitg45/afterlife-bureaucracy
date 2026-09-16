/**
 * Play Store screenshots: builds the web bundle, serves it, seeds a save into localStorage and
 * photographs five 1080×1920 frames into `docs/store/screenshots/`.
 *
 * The server is started and stopped by this script — nothing is left listening. Run with
 * `npm run screenshots`; Chromium comes from `npx playwright install chromium`.
 *
 * These are placeholders in the sense that the art is not final, but they are real frames of
 * the real app: everything on them comes from the engine rendering a seeded save.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'store', 'screenshots');
const PORT = 4317;
const WIDTH = 1080;
const HEIGHT = 1920;

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
    saveVersion: 6,
    kc: '4.82e7',
    soulsRun: '9.4e9',
    soulsLifetime: '6.1e11',
    seals: 34,
    vouchers: 12,
    voucherFraction: 0.35,
    staff: { dave: 118, seraphine: 96, gary: 71, auditor: 44 },
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
    perks: ['throughput-1', 'throughput-2', 'throughput-3', 'overtime-1', 'overtime-2', 'stapler-1'],
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
  .toast { display: none !important; }
`;

async function shoot(browser, url, { file, save, tab, waitFor }) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(
    ([key, value]) => {
      try { window.localStorage.setItem(key, value); } catch { /* seeding is best-effort */ }
    },
    [SAVE_KEY, JSON.stringify(save)],
  );
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.addStyleTag({ content: STILL_CSS });
  // Every cold boot opens on the title screen, so the office is one tap behind it.
  await page.getByRole('button', { name: 'Clock in' }).click();
  if (tab) await page.getByRole('tab', { name: tab }).click();
  await page.waitForSelector(waitFor, { state: 'visible', timeout: 15000 });
  // The store's tick writes numbers a frame or two after mount; one settle beats a flaky race.
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, file) });
  await context.close();
  console.log('  ' + file);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  console.log('Building…');
  await build({ root, logLevel: 'warn' });

  const server = await preview({ root, preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
  const url = server.resolvedUrls?.local?.[0] ?? `http://localhost:${PORT}/`;
  const browser = await chromium.launch();
  try {
    const now = Date.now();
    const base = await seedSave(now);
    console.log('Shooting…');
    const shots = [
      { file: '01-office.png', save: base, tab: 'Office', waitFor: '.tabbar' },
      { file: '02-personnel.png', save: base, tab: 'Personnel', waitFor: '.tabbar' },
      { file: '03-ledger.png', save: base, tab: 'Ledger', waitFor: '.tabbar' },
      { file: '04-tasks.png', save: base, tab: 'Tasks', waitFor: '.tabbar' },
      {
        file: '05-backlog-report.png',
        // Seven hours of absence: enough to fill the in-tray and raise the report on boot.
        save: { ...base, lastSeenWallClock: now - 7 * 3600_000 },
        waitFor: '[role="dialog"]',
      },
    ];
    for (const shot of shots) await shoot(browser, url, shot);
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(`Done — ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

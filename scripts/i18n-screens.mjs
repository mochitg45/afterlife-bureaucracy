/**
 * Localization check: builds the app, seeds a save, and photographs Office, Personnel, Ledger,
 * an event screen and Settings at 400x890 in each language (default id, ja-JP, th, de-DE; pass
 * codes as args to change). Raw shots go to a temp dir; a labelled contact sheet is written to
 * docs/i18n/screens-check.png.  Run: node scripts/i18n-screens.mjs [lang ...]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(tmpdir(), 'afterlife-i18n-shots');
const PORT = 4318;
const SAVE_KEY = 'afterlife.save.v1';
const LANG_KEY = 'afterlife.lang';
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ['id', 'ja-JP', 'th', 'de-DE'];

const { SAVE_VERSION } = await import('../src/engine/migrations.ts').catch(async () => {
  // plain node cannot load .ts: read the constant out of the source instead
  const src = await readFile(path.join(root, 'src/engine/migrations.ts'), 'utf8');
  return { SAVE_VERSION: Number(/SAVE_VERSION = (\d+)/.exec(src)[1]) };
});

const dayKey = (ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const json = async (rel) => JSON.parse(await readFile(path.join(root, rel), 'utf8'));

async function seedSave(now) {
  const cards = await json('src/data/cards.json');
  const story = await json('src/data/story.json');
  const byRarity = (r) => cards.filter((c) => c.rarity === r).map((c) => c.id);
  const owned = [...byRarity('temp').slice(0, 5), ...byRarity('fulltime').slice(0, 4), ...byRarity('senior').slice(0, 2), ...byRarity('executive').slice(0, 1)];
  const today = dayKey(now);
  return {
    saveVersion: SAVE_VERSION, resetEpoch: 1, kc: '4.82e7', soulsRun: '9.4e9', soulsLifetime: '6.1e11', seals: 34, vouchers: 12, voucherFraction: 0.35,
    staff: { dave: 118, seraphine: 96, gary: 71, auditor: 44, 'h-cherub': 84, 'h-gatekeeper': 52, 'h-harpist': 30, 'd-imp': 90, 'd-steward': 58, 'd-hr': 33 },
    upgrades: { 'faster-stapler': 8, 'ergonomic-chairs': 4, 'night-shift': 2, 'overtime-pay': 1 },
    deptsUnlocked: ['intake', 'limbo', 'heaven', 'hell'], activeDept: 'intake', fiscalYear: 4, boostUntilWall: 0, lastSeenWallClock: now, uptimeAtSave: 120000,
    stats: { clicks: 2140, staffHired: 329, upgradesBought: 15, audits: 3, pulls: 41, equips: 6, dailiesClaimed: 19, adsWatched: 12, perksBought: 7, cosmics: 0, purchases: 0 },
    perks: ['throughput-1', 'throughput-2', 'overtime-1', 'stapler-1', 'requisition-1'],
    cards: Object.fromEntries(owned.map((id, i) => [id, (i % 4) + 1])), equipped: owned.slice(0, 3), pity: { senior: 6, executive: 23 }, rngSeed: 987654321,
    dailies: { date: today, tasks: [{ id: 'd-clicks-1', claimed: true }, { id: 'd-hire-1', claimed: false }, { id: 'd-rate-1', claimed: false }], skipped: [], streak: 6, bestStreak: 9, skipTokens: 1, lastTokenDate: today,
      baseline: { clicks: 2080, staffHired: 310, upgradesBought: 14, equips: 6, audits: 3, perksBought: 7, pulls: 41 }, completedToday: false, soulsPerSecSnapshot: '1.4e7' },
    achievements: (await json('src/data/achievements.json')).slice(0, 22).map((a) => a.id), storySeen: story.map((s) => s.id),
    settings: { notifOptIn: 'yes', notifDate: today, notifsSent: 3 }, firstSeenWallClock: now - 14 * 86400_000,
    entitlements: { removeAds: false, unionUntilWall: 0, starterPackBought: false }, adState: { freePullDate: '', dailySkipDate: '', boostCooldownUntilWall: 0 },
    cosmicPoints: 0, cosmicClauses: [], branchesUnlocked: [], processId: 'screenshot',
    onboarding: { memosSeen: true, trainingStep: 3, tipsSeen: (await json('src/data/onboarding.json')).tips.map((t) => t.id) }, event: null,
  };
}

const STILL = `*, *::before, *::after { animation: none !important; transition: none !important; } .toast, .coach-overlay { display: none !important; }`;
const VALHALLA = Date.UTC(2026, 11, 4, 12);

async function shoot(browser, url, lang, scene, save, clock) {
  const context = await browser.newContext({ viewport: { width: 400, height: 890 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce', locale: lang });
  await context.addInitScript(() => { window.Math.random = () => 0.88; });
  if (clock) await context.clock.install({ time: clock });
  await context.addInitScript(([k, v, lk, lv]) => { try { localStorage.setItem(k, v); localStorage.setItem(lk, lv); } catch { /* best effort */ } },
    [SAVE_KEY, JSON.stringify({ ...save, lastSeenWallClock: clock ?? Date.now() }), LANG_KEY, lang]);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.addStyleTag({ content: STILL });
  await page.getByTestId('splash').click({ timeout: 5000 }).catch(() => {});
  await page.locator('.title-actions button').last().click(); // Clock in (label is translated)
  await page.waitForSelector('.tabbar');
  const tab = (i) => page.locator('.tabbar [role=tab]').nth(i).click();
  if (scene === 'personnel') await tab(1);
  if (scene === 'ledger') { await tab(2); await page.locator('[data-testid^=perk-branch-]').first().click().catch(() => {}); await page.waitForSelector('.pt-tree'); }
  if (scene === 'event') { await page.locator('.event-banner button').click(); await page.waitForSelector('.event-screen'); }
  if (scene === 'settings') await page.locator('.gear-btn, [data-testid=settings]').first().click();
  await page.waitForTimeout(700);
  await page.addStyleTag({ content: '.toast, .coach-overlay { display: none !important; }' });
  const file = path.join(rawDir, `${lang}-${scene}.png`);
  await page.screenshot({ path: file });
  // flag horizontal overflow so clipping is caught even where it is hard to see
  const over = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'visible' && e.clientWidth > 0 && e.children.length === 0).slice(0, 5).map((e) => e.className + ':' + (e.textContent || '').slice(0, 30)));
  if (over.length) console.log(`  overflow ${lang}/${scene}:`, over.join(' | '));
  await context.close();
  return file;
}

await mkdir(rawDir, { recursive: true });
console.log('Building…');
await build({ root, logLevel: 'warn' });
const server = await preview({ root, preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
const url = server.resolvedUrls?.local?.[0] ?? `http://localhost:${PORT}/`;
const browser = await chromium.launch();
try {
  const base = await seedSave(Date.now());
  const weekly = { ...base, lastSeenWallClock: VALHALLA, event: { key: 'weekly-2026-12-04', points: '2.4e6', earned: '3.1e7', staff: { 'w-temp': 48, 'w-stapler': 21, 'w-imp': 7 }, claimed: [0, 1] } };
  const scenes = [['office', base], ['personnel', base], ['ledger', base], ['event', weekly, VALHALLA], ['settings', base]];
  const files = {};
  for (const lang of LANGS) for (const [scene, save, clock] of scenes) { files[`${lang}/${scene}`] = await shoot(browser, url, lang, scene, save, clock); console.log('shot', lang, scene); }
  // contact sheet
  const cells = [];
  for (const lang of LANGS) {
    cells.push(`<div class="row"><b>${lang}</b>${scenes.map(([s]) => `<img src="data:image/png;base64,${''}" data-f="${files[`${lang}/${s}`]}">`).join('')}</div>`);
  }
  const html = `<!doctype html><style>body{margin:0;background:#222;color:#fff;font:14px sans-serif}.row{display:flex;gap:6px;padding:6px;align-items:flex-start}b{writing-mode:vertical-rl;padding:4px}img{width:300px;height:667px}</style>${cells.join('')}`;
  const sheet = await browser.newPage({ viewport: { width: 5 * 306 + 40, height: LANGS.length * 679 } });
  await sheet.setContent(html);
  for (const img of await sheet.locator('img').all()) {
    const f = await img.getAttribute('data-f');
    const b64 = (await readFile(f)).toString('base64');
    await img.evaluate((el, d) => { el.src = 'data:image/png;base64,' + d; }, b64);
  }
  await sheet.waitForTimeout(500);
  await mkdir(path.join(root, 'docs/i18n'), { recursive: true });
  await sheet.screenshot({ path: path.join(root, 'docs/i18n/screens-check.png'), fullPage: true });
  await writeFile(path.join(rawDir, 'index.json'), JSON.stringify(files, null, 1));
  console.log('Raw shots in', rawDir);
} finally {
  await browser.close();
  await server.close();
}

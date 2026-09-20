/**
 * Play Games Services publishing assets: the 1024×500 feature graphic and one 512×512 icon per
 * mirrored achievement, into `docs/store/play-games/`. Rendered in Chromium so the real
 * Special Elite face is used (librsvg would substitute a system font). `npm run play-assets`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'store', 'play-games');
// Inlined: a file:// url does not load from the about:blank page setContent renders into.
const fontFile = path.join(root, 'node_modules/@fontsource/special-elite/files/special-elite-latin-400-normal.woff2');

const PAPER = '#EDE7D4', LINE = '#C9BFA6', INK = '#2A2620', RED = '#A6402B', GREEN = '#1F3B33', TEAL = '#3E9C93', BRASS = '#A8823C', CREAM = '#F7F2E4';
const TIER = { 1: LINE, 2: TEAL, 3: BRASS, 4: RED };

/** Same paths as src/ui/components/Badge.tsx, with hex colours. */
const GLYPH = {
  stamp: `<g stroke="${INK}" stroke-width="2.5" stroke-linecap="round" fill="none"><rect x="20" y="21" width="24" height="16" rx="3"/><path d="M24 29 h16"/></g>`,
  trophy: `<g stroke="${INK}" stroke-width="2.5" stroke-linecap="round" fill="none"><path d="M23 18 h18 v9 a9 9 0 0 1 -18 0 Z"/><path d="M23 20 C17 20 17 28 23 28"/><path d="M41 20 C47 20 47 28 41 28"/><path d="M32 36 v5"/><path d="M26 43 h12"/></g>`,
  star: `<path d="M32 16 L35.8 26.2 L46.5 26.2 L37.9 32.6 L41.2 43.4 L32 36.8 L22.8 43.4 L26.1 32.6 L17.5 26.2 L28.2 26.2 Z" fill="${INK}"/>`,
  scroll: `<g stroke="${INK}" stroke-width="2.5" stroke-linecap="round" fill="none"><rect x="21" y="20" width="22" height="17" rx="1"/><circle cx="21" cy="20" r="3"/><circle cx="21" cy="37" r="3"/><path d="M27 26 h11 M27 31 h11"/></g>`,
  flame: `<path d="M32 16 C25 25 23 30 25 36 C26.5 41 30 43 32 43 C34 43 37.5 41 39 36 C41 30 39 25 32 16 Z M32 30 C29 34 29 38 32 39 C35 38 35 34 32 30 Z" fill="${INK}"/>`,
  gear: `<g stroke="${INK}" stroke-width="2.5" stroke-linecap="round" fill="none"><circle cx="32" cy="29" r="8"/><path d="M40 29 L45 29 M36 35.9 L38.5 40.3 M28 35.9 L25.5 40.3 M24 29 L19 29 M28 22.1 L25.5 17.7 M36 22.1 L38.5 17.7"/></g>`,
};

function badgeSvg(kind, tier) {
  // Play crops achievement icons to a circle, so the shield sits inside a parchment disc.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">
    <circle cx="32" cy="32" r="32" fill="${PAPER}"/>
    <circle cx="32" cy="32" r="29" fill="none" stroke="${LINE}" stroke-width="1"/>
    <path d="M32 4 L54 13 L54 34 C54 50 32 60 32 60 C32 60 10 50 10 34 L10 13 Z" fill="${TIER[tier]}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    ${GLYPH[kind]}
  </svg>`;
}

function seal(size) {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" style="transform:rotate(-8deg)">
    <circle cx="50" cy="50" r="46" fill="${RED}" stroke="${INK}" stroke-width="4"/>
    <circle cx="50" cy="50" r="36" fill="none" stroke="${CREAM}" stroke-width="2.5" stroke-dasharray="6 4"/>
    <text x="50" y="47" text-anchor="middle" font-family="Special Elite" font-size="15" fill="${CREAM}">PROCESSED</text>
    <text x="50" y="62" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="${CREAM}">FORM 7-B</text>
  </svg>`;
}

const feature = (font) => `<!doctype html><style>
@font-face { font-family: 'Special Elite'; src: url('data:font/woff2;base64,${font}') format('woff2'); }
html, body { margin: 0; } body { width: 1024px; height: 500px; overflow: hidden; background: ${PAPER};
  background-image: repeating-linear-gradient(to bottom, transparent 0 39px, ${LINE} 39px 40px); font-family: 'Special Elite', serif; color: ${GREEN}; }
.wrap { position: relative; display: flex; align-items: center; gap: 48px; padding: 0 72px; height: 100%; }
h1 { font-size: 64px; line-height: 1.05; margin: 0; letter-spacing: 1px; }
p { font-size: 26px; margin: 18px 0 0; color: ${INK}; opacity: .8; }
.dev { position: absolute; right: 40px; bottom: 22px; font-size: 16px; color: ${INK}; opacity: .6; letter-spacing: 3px; }
</style><body><div class="wrap">${seal(300)}<div><h1>Afterlife<br>Bureaucracy Inc.</h1><p>Please take a number.</p></div><span class="dev">INATA SUN SOFT</span></div></body>`;

async function main() {
  await mkdir(outDir, { recursive: true });
  const all = JSON.parse(await readFile(path.join(root, 'src/data/achievements.json'), 'utf8'));
  const idsSrc = await readFile(path.join(root, 'src/platform/gameIds.ts'), 'utf8');
  const mirrored = [...idsSrc.matchAll(/'(a-[\w-]+)':\s*'(Cgk\w+)'/g)].map(([, id, play]) => ({ ...all.find((a) => a.id === id), play }));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await page.setContent(feature((await readFile(fontFile)).toString('base64')));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, 'feature-1024x500.png') });
  const icon = await browser.newPage({ viewport: { width: 512, height: 512 } });
  const rows = ['| # | Achievement | Description | Play id | Icon |', '|---|---|---|---|---|'];
  for (const [i, a] of mirrored.entries()) {
    await icon.setContent(`<style>html,body{margin:0;background:transparent}</style>${badgeSvg(a.badge, a.tier)}`);
    const file = `${a.id}.png`;
    await icon.screenshot({ path: path.join(outDir, file), omitBackground: true });
    rows.push(`| ${i + 1} | ${a.name} | ${a.desc} | \`${a.play}\` | \`${file}\` |`);
  }
  await browser.close();
  await writeFile(path.join(outDir, 'achievements.md'), `# Play Games achievements: paste sheet\n\nOne row per mirrored achievement; upload the icon and paste the description on each row's edit page (Grow users → Play Games Services → Achievements).\n\n${rows.join('\n')}\n`);
  console.log(`Wrote ${outDir}: feature graphic, ${mirrored.length} icons, achievements.md`);
}

main().catch((e) => { console.error(e); process.exit(1); });

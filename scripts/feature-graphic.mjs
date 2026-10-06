/**
 * Play Store feature graphic (1024x500): a lineup of staff in front of event-room art, the game
 * title and a weekly-events tagline. Rendered from HTML with Playwright, from the same sprites and
 * room paintings the app ships, so a new theme or character swap is a one-line change below.
 *
 * Run: `node scripts/feature-graphic.mjs`. Writes docs/store/feature-graphic.png and
 * docs/art/feature-v3/feature.png. Layout keeps everything that matters inside the central 80% of
 * the canvas, because Play may crop the edges on some surfaces.
 */
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const art = (rel) => pathToFileURL(path.join(root, 'public', 'art', rel)).href;
const font = pathToFileURL(path.join(root, 'node_modules/@fontsource/special-elite/files/special-elite-latin-400-normal.woff2')).href;

/** Four event rooms side by side: Halloween, Valhalla (weekly), Christmas, Greed (weekly). */
const ROOMS = ['events/halloween.webp', 'events/weekly-valhalla-feast.webp', 'events/christmas.webp', 'events/weekly-sin-greed.webp'];

/**
 * Left to right. `h` is the drawn sprite height in px (the 256px source is never scaled up by
 * more than ~1.2x), `x` the horizontal centre. Back-to-front order follows array order, so the
 * hero goes last among the equals.
 */
const LINEUP = [
  { id: 'c-hw-pumpkin-cfo', x: 185, h: 200 },
  { id: 'wk-valhalla-feast-x', x: 292, h: 205 },
  { id: 'seraphine', x: 395, h: 205 },
  { id: 'gary', x: 630, h: 205 },
  { id: 'c-xm-krampus-exec', x: 738, h: 205 },
  { id: 'wk-sin-greed-x', x: 842, h: 200 },
  { id: 'dave', x: 512, h: 232 },
];

const html = `<!doctype html><meta charset="utf-8"><style>
  @font-face { font-family: 'Special Elite'; src: url('${font}') format('woff2'); }
  html, body { margin: 0; }
  body { width: 1024px; height: 500px; position: relative; overflow: hidden; background: #1c1712; font-family: 'Special Elite', serif; }
  .rooms { position: absolute; inset: 0; display: flex; }
  .rooms div { flex: 1; background-size: auto 100%; background-position: center; filter: saturate(1.15) contrast(1.05); }
  .shade { position: absolute; inset: 0; background:
    linear-gradient(to bottom, rgba(18,12,8,.82) 0%, rgba(18,12,8,.55) 42%, rgba(18,12,8,.05) 62%, rgba(18,12,8,.45) 100%),
    radial-gradient(ellipse at 50% 85%, rgba(255,210,140,.28), transparent 60%); }
  .seam { position: absolute; top: 0; bottom: 0; width: 3px; background: rgba(18,12,8,.55); }
  .chars img { position: absolute; transform: translateX(-50%); bottom: 55px; filter: drop-shadow(0 6px 5px rgba(0,0,0,.55)); }
  .title { position: absolute; left: 0; right: 0; top: 54px; text-align: center; color: #F7F2E4; line-height: .86; letter-spacing: 2px;
    -webkit-text-stroke: 9px #1d130c; paint-order: stroke fill; text-shadow: 0 7px 0 #A6402B, 0 10px 18px rgba(0,0,0,.6); }
  .title .a { font-size: 100px; display: block; }
  .title .b { font-size: 94px; display: block; margin-top: 6px; }
  .counter { position: absolute; left: 0; right: 0; bottom: 0; height: 84px; background: linear-gradient(#7a4a2a, #4b2b17); border-top: 6px solid #c98f55;
    box-shadow: 0 -8px 20px rgba(0,0,0,.45); }
  .tag { position: absolute; left: 0; right: 0; bottom: 56px; text-align: center; }
  .tag span { display: inline-block; font-size: 33px; color: #F7F2E4; background: #A6402B; padding: 6px 26px 4px; border: 4px solid #F7F2E4; border-radius: 8px;
    transform: rotate(-1.2deg); box-shadow: 0 5px 0 rgba(0,0,0,.35); letter-spacing: .5px; }
</style><body>
  <div class="rooms">${ROOMS.map((r) => `<div style="background-image:url('${art(r)}')"></div>`).join('')}</div>
  <div class="shade"></div>
  ${[25, 50, 75].map((p) => `<div class="seam" style="left:calc(${p}% - 1px)"></div>`).join('')}
  <div class="chars">${LINEUP.map((c) => `<img src="${art('chars/' + c.id + '.webp')}" style="left:${c.x}px;height:${c.h}px;width:${c.h}px">`).join('')}</div>
  <div class="counter"></div>
  <div class="tag"><span>New themed events every weekend!</span></div>
  <div class="title"><span class="a">AFTERLIFE</span><span class="b">BUREAUCRACY</span></div>
</body>`;

const tmp = path.join(tmpdir(), 'afterlife-feature.html');
await writeFile(tmp, html);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await mkdir(path.join(root, 'docs/art/feature-v3'), { recursive: true });
  const out = path.join(root, 'docs/store/feature-graphic.png');
  await page.screenshot({ path: out });
  await copyFile(out, path.join(root, 'docs/art/feature-v3/feature.png'));
  console.log('wrote', out);
} finally {
  await browser.close();
}

/**
 * The invitation picture attached when a player shares the game (1080x1350, Instagram/WhatsApp
 * portrait). Same sprites and rooms the app ships, rendered from HTML with Playwright.
 *
 * Run: `node scripts/invite-image.mjs`. Writes public/art/share/invite.png.
 */
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const art = (rel) => pathToFileURL(path.join(root, 'public', 'art', rel)).href;
const font = pathToFileURL(path.join(root, 'node_modules/@fontsource/special-elite/files/special-elite-latin-400-normal.woff2')).href;

/** Back row then front row; x is the centre in px, h the drawn size. */
const BACK = [
  { id: 'wk-valhalla-feast-x', x: 170, h: 250 }, { id: 'c-hw-pumpkin-cfo', x: 380, h: 250 },
  { id: 'c-xm-krampus-exec', x: 700, h: 250 }, { id: 'wk-sin-greed-x', x: 910, h: 250 },
];
const FRONT = [
  { id: 'seraphine', x: 250, h: 300 }, { id: 'gary', x: 830, h: 300 }, { id: 'dave', x: 540, h: 360 },
];
const img = (c, bottom) => `<img src="${art('chars/' + c.id + '.webp')}" style="left:${c.x}px;bottom:${bottom}px;height:${c.h}px;width:${c.h}px">`;

const html = `<!doctype html><meta charset="utf-8"><style>
  @font-face { font-family: 'Special Elite'; src: url('${font}') format('woff2'); }
  html, body { margin: 0; }
  body { width: 1080px; height: 1350px; position: relative; overflow: hidden; background: #1c1712; font-family: 'Special Elite', serif; color: #F7F2E4; }
  .room { position: absolute; inset: 0; background: url('${art('events/halloween.webp')}') center/cover; filter: saturate(1.1); }
  .shade { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(18,12,8,.88) 0%, rgba(18,12,8,.55) 30%, rgba(18,12,8,.15) 52%, rgba(18,12,8,.75) 82%, rgba(18,12,8,.95) 100%); }
  .hire { position: absolute; top: 70px; left: 0; right: 0; text-align: center; }
  .hire span { display: inline-block; font-size: 46px; background: #A6402B; padding: 10px 34px 6px; border: 5px solid #F7F2E4; border-radius: 10px; transform: rotate(-2deg); box-shadow: 0 6px 0 rgba(0,0,0,.4); }
  .title { position: absolute; left: 0; right: 0; top: 190px; text-align: center; line-height: .86; -webkit-text-stroke: 10px #1d130c; paint-order: stroke fill; text-shadow: 0 8px 0 #A6402B, 0 12px 22px rgba(0,0,0,.6); }
  .title .a { font-size: 132px; display: block; } .title .b { font-size: 122px; display: block; margin-top: 8px; }
  .chars img { position: absolute; transform: translateX(-50%); filter: drop-shadow(0 8px 6px rgba(0,0,0,.6)); }
  .pitch { position: absolute; left: 60px; right: 60px; bottom: 210px; text-align: center; font-size: 40px; line-height: 1.35; text-shadow: 0 3px 6px rgba(0,0,0,.8); }
  .cta { position: absolute; left: 0; right: 0; bottom: 70px; text-align: center; }
  .cta span { display: inline-block; font-size: 52px; color: #1d130c; background: #E8C164; padding: 16px 46px 10px; border-radius: 999px; border: 5px solid #F7F2E4; box-shadow: 0 7px 0 rgba(0,0,0,.45); }
</style><body>
  <div class="room"></div><div class="shade"></div>
  <div class="hire"><span>You're hired!</span></div>
  <div class="title"><span class="a">AFTERLIFE</span><span class="b">BUREAUCRACY</span></div>
  <div class="chars">${BACK.map((c) => img(c, 420)).join('')}${FRONT.map((c) => img(c, 330)).join('')}</div>
  <div class="pitch">Stamp souls, hire very strange staff<br>and play a new event every weekend.</div>
  <div class="cta"><span>Free on Google Play</span></div>
</body>`;

const tmp = path.join(tmpdir(), 'afterlife-invite.html');
await writeFile(tmp, html);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  const out = path.join(root, 'public/art/share/invite.png');
  await page.screenshot({ path: out });
  console.log('wrote', out);
} finally {
  await browser.close();
}

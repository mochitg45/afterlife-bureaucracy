/**
 * App icon v3: full-bleed. Dave's face and hood fill the square edge to edge on a golden sunburst,
 * with a red PROCESSED stamp across his chest. No frame, no padding, no small character floating
 * in empty space — the old icon was hard to read at launcher size.
 *
 * Source art: docs/art/icon-v3/dave-cutout.png (from scripts/cut-dave-icon.py, itself cut from the
 * 1024px card in docs/art/characters-v2/b8-dave.jpg).
 *
 * Writes:
 *   assets/icon.png, icon-foreground.png, icon-background.png  (1024, inputs for @capacitor/assets)
 *   android mipmaps (ic_launcher, _round, _foreground, _background) via `@capacitor/assets`
 *   docs/store/icon-512.png                                    (512, 32-bit RGBA PNG for Play)
 *   docs/store/ios/app-store-icon-1024.png and the appiconset  (1024, RGB, no alpha)
 *   docs/art/icon-v3/icon.png                                  (1024 master)
 *
 * Run: `npm run icon` (needs `npx playwright install chromium`).
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (...p) => path.join(root, ...p);
const font = pathToFileURL(at('node_modules/@fontsource/special-elite/files/special-elite-latin-400-normal.woff2')).href;
const dave = pathToFileURL(at('docs/art/icon-v3/dave-cutout.png')).href;

/**
 * The art is ~900x912; at ~1.09x the hood spans ~82% of the canvas and the robe runs off the bottom
 * edge. Inside Android's adaptive mask (the layer is inset to the 72dp window) the hood is ~59dp,
 * inside the 66dp safe zone.
 */
const html = (layers) => `<!doctype html><style>
  @font-face { font-family: 'Special Elite'; src: url('${font}') format('woff2'); }
  html, body { margin: 0; } body { width: 1024px; height: 1024px; position: relative; overflow: hidden; background: transparent; }
  .bg { position: absolute; inset: 0; display: ${layers.bg ? 'block' : 'none'};
    background:
      radial-gradient(circle at 50% 46%, rgba(255,247,200,.9) 0, rgba(255,222,110,0) 52%),
      repeating-conic-gradient(from 0deg at 50% 46%, #FFC93A 0 7.5deg, #FFB41F 7.5deg 15deg);
  }
  .bg::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 50% 46%, transparent 45%, rgba(214,104,14,.55) 100%); }
  .dave { position: absolute; left: 20px; top: 64px; width: 984px; height: auto; display: ${layers.fg ? 'block' : 'none'};
    filter: drop-shadow(0 14px 0 rgba(120,50,10,.28)); }
  .stamp { position: absolute; left: 512px; top: 892px; width: 640px; height: 150px; box-sizing: border-box; transform: translate(-50%, -50%) rotate(-8deg);
    display: ${layers.fg ? 'flex' : 'none'}; align-items: center; justify-content: center;
    background: #FFF6DC; border: 14px solid #D1271B; border-radius: 16px; outline: 5px solid #FFF6DC;
    font: 400 92px/1 'Special Elite', serif; letter-spacing: 3px; color: #D1271B; box-shadow: 0 12px 0 rgba(90,20,10,.35); }
</style><body><div class="bg"></div><img class="dave" src="${dave}"><div class="stamp">PROCESSED</div></body>`;

const tmp = path.join(tmpdir(), 'afterlife-icon.html');
async function render(page, layers, transparent) {
  await writeFile(tmp, html(layers));
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  return page.screenshot({ omitBackground: transparent });
}

const browser = await chromium.launch();
let full, fg, bg;
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  full = await render(page, { bg: true, fg: true }, false);
  fg = await render(page, { bg: false, fg: true }, true);
  bg = await render(page, { bg: true, fg: false }, false);
} finally {
  await browser.close();
}

const png = (buf) => sharp(buf).png({ compressionLevel: 9 });
await mkdir(at('docs/art/icon-v3'), { recursive: true });
await png(full).removeAlpha().toFile(at('docs/art/icon-v3/icon.png'));
await png(full).removeAlpha().toFile(at('assets/icon.png'));
await png(fg).toFile(at('assets/icon-foreground.png'));
await png(bg).removeAlpha().toFile(at('assets/icon-background.png'));

// Play Store: 512x512, 32-bit (RGBA) PNG. Fully opaque; Play applies its own corner mask.
await sharp(full).resize(512, 512, { kernel: 'lanczos3' }).ensureAlpha().png({ compressionLevel: 9 }).toFile(at('docs/store/icon-512.png'));
// iOS: 1024, RGB, no alpha channel (App Store rejects icons with transparency).
for (const f of ['docs/store/ios/app-store-icon-1024.png', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png']) {
  await png(full).removeAlpha().toFile(at(f));
}

// Android mipmaps. Run the CLI's entry script with this node binary: spawning the `.cmd` shim on
// Windows fails with EINVAL on Node 20+.
const cli = at('node_modules/@capacitor/assets/bin/capacitor-assets');
execFileSync(process.execPath, [cli, 'generate', '--android'], { cwd: root, stdio: 'inherit' });

// The background layer is a flat gradient, so let it fill the whole 108dp adaptive canvas (no 16.7%
// inset): parallax and zoom animations in launchers never reveal an empty edge. The foreground keeps
// its inset, which maps the 1024 art onto the 72dp window.
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  const f = at('android/app/src/main/res/mipmap-anydpi-v26', name);
  let x = await readFile(f, 'utf8');
  x = x.replace(/<background>\s*<inset android:drawable="@mipmap\/ic_launcher_background"[^>]*\/>\s*<\/background>/, '<background android:drawable="@mipmap/ic_launcher_background" />');
  await writeFile(f, x);
}
console.log('Icon v3 written.');

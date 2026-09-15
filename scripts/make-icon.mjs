/**
 * Draws the app icon — a rubber-stamp seal in the game's parchment palette — and hands the
 * results to `@capacitor/assets`, which writes the Android mipmaps and splash drawables.
 *
 * Everything is generated from SVG so there is no binary source art to keep in sync: edit the
 * builders below, run `npm run icon`, commit what lands in `assets/` and `android/app/src/main/res/`.
 *
 * Deliberately font-free. librsvg (what sharp rasterises SVG with) resolves `font-family`
 * against the *system* fonts, so a `<text>` element would render differently on every machine
 * and silently fall back to something that is not Special Elite. Every glyph here is geometry.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(root, 'assets');
const storeDir = path.join(root, 'docs', 'store');

/** src/ui/theme.css, light theme. */
const PAPER = '#EDE7D4';
const LINE = '#C9BFA6';
const INK_RED = '#A6402B';
const INK = '#2A2620';

/**
 * The seal itself: two rings with a serrated band between them and an approval check in the
 * middle, tilted like a stamp pressed by a bored hand. `r` is the outer radius.
 */
function seal(cx, cy, r, color = INK_RED) {
  const ticks = [];
  const TICK_COUNT = 24;
  for (let i = 0; i < TICK_COUNT; i++) {
    const a = (i / TICK_COUNT) * Math.PI * 2;
    const x1 = cx + Math.cos(a) * r * 0.745;
    const y1 = cy + Math.sin(a) * r * 0.745;
    const x2 = cx + Math.cos(a) * r * 0.845;
    const y2 = cy + Math.sin(a) * r * 0.845;
    ticks.push(`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" />`);
  }
  // Fixed, not random: the icon must be byte-reproducible across runs so a rebuild is an
  // empty diff rather than noise. These are the dry patches of a tired stamp pad.
  const flecks = [
    [-0.52, -0.46, 0.09], [0.44, -0.58, 0.07], [0.62, 0.34, 0.1],
    [-0.36, 0.64, 0.08], [-0.7, 0.14, 0.06], [0.16, 0.74, 0.05],
  ];
  const fleckMarks = flecks
    .map(([dx, dy, rr]) => `<circle cx="${(cx + dx * r).toFixed(2)}" cy="${(cy + dy * r).toFixed(2)}" r="${(rr * r).toFixed(2)}" />`)
    .join('');

  return `
  <g transform="rotate(-14 ${cx} ${cy})">
    <g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="${cx}" cy="${cy}" r="${(r * 0.93).toFixed(2)}" stroke-width="${(r * 0.1).toFixed(2)}" />
      <circle cx="${cx}" cy="${cy}" r="${(r * 0.7).toFixed(2)}" stroke-width="${(r * 0.035).toFixed(2)}" />
      <g stroke-width="${(r * 0.05).toFixed(2)}">${ticks.join('')}</g>
      <path d="M ${(cx - r * 0.3).toFixed(2)} ${(cy + r * 0.02).toFixed(2)}
               L ${(cx - r * 0.08).toFixed(2)} ${(cy + r * 0.26).toFixed(2)}
               L ${(cx + r * 0.34).toFixed(2)} ${(cy - r * 0.3).toFixed(2)}"
            stroke-width="${(r * 0.2).toFixed(2)}" />
    </g>
    <g fill="${PAPER}" opacity="0.55">${fleckMarks}</g>
  </g>`;
}

/** Parchment with the faint ruling of a form nobody reads. */
function parchment(size, { dark = false } = {}) {
  const base = dark ? '#1B1915' : PAPER;
  const rule = dark ? '#4A4238' : LINE;
  const step = size / 16;
  const lines = [];
  for (let y = step; y < size; y += step) {
    lines.push(`<line x1="0" y1="${y.toFixed(2)}" x2="${size}" y2="${y.toFixed(2)}" />`);
  }
  return `<rect width="${size}" height="${size}" fill="${base}" />
    <g stroke="${rule}" stroke-width="${(size / 512).toFixed(2)}" opacity="0.35">${lines.join('')}</g>`;
}

const svg = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;

const png = (size, body, file) =>
  sharp(Buffer.from(svg(size, body))).png({ compressionLevel: 9 }).toFile(file);

async function main() {
  await mkdir(assetsDir, { recursive: true });
  await mkdir(storeDir, { recursive: true });

  const S = 1024;
  // Square icon: the seal fills the tile, the way a stamp lands on a form.
  const square = parchment(S) + seal(S / 2, S / 2, S * 0.4);
  // Adaptive foreground: `@capacitor/assets` writes the XML with `android:inset="16.7%"`, so
  // this whole square is scaled down into the 72dp safe zone for us. The art therefore fills
  // its own canvas edge to edge — shrinking it here too would inset it twice and leave a
  // postage stamp floating in the middle of the launcher tile.
  const foreground = seal(S / 2, S / 2, S * 0.47);
  const background = parchment(S);

  await png(S, square, path.join(assetsDir, 'icon.png'));
  await png(S, foreground, path.join(assetsDir, 'icon-foreground.png'));
  await png(S, background, path.join(assetsDir, 'icon-background.png'));

  // Splash is square and generously oversized: Capacitor centre-crops it to every orientation.
  const SP = 2732;
  await png(SP, parchment(SP) + seal(SP / 2, SP / 2, SP * 0.14), path.join(assetsDir, 'splash.png'));
  await png(SP, parchment(SP, { dark: true }) + seal(SP / 2, SP / 2, SP * 0.14, '#D9634A'), path.join(assetsDir, 'splash-dark.png'));

  // Play Console wants a 512×512 PNG for the listing; it is uploaded by hand, not packaged.
  await sharp(Buffer.from(svg(S, square))).resize(512, 512).png({ compressionLevel: 9 }).toFile(path.join(storeDir, 'icon-512.png'));

  console.log('Wrote assets/ icon + splash sources and docs/store/icon-512.png');

  // Run the CLI's entry script with this same node binary rather than shelling out to
  // `npx`: on Windows, spawning a `.cmd` without a shell fails outright (EINVAL) on Node 20+.
  const cli = path.join(root, 'node_modules', '@capacitor', 'assets', 'bin', 'capacitor-assets');
  execFileSync(process.execPath, [cli, 'generate', '--android'], { cwd: root, stdio: 'inherit' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

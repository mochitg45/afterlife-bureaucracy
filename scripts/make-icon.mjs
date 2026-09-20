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
/** Dave's palette (src/ui/characters/Character.tsx): hood green + cream face. */
const DAVE_GREEN = '#1F3B33';
const DAVE_CREAM = '#F7F2E4';

/**
 * The seal itself: two rings with a serrated band between them and an approval check in the
 * middle, tilted like a stamp pressed by a bored hand. `r` is the outer radius.
 *
 * `opts.backing`, when given a color, fills the outer ring's disc solidly before drawing the
 * rings — used to occlude whatever is drawn behind the seal (Dave's head) instead of letting it
 * show through the transparent middle. `opts.check = false` drops the approval checkmark, used
 * by candidate C to make room for a face in the centre.
 */
function seal(cx, cy, r, color = INK_RED, opts = {}) {
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

  const backing = opts.backing
    ? `<circle cx="${cx}" cy="${cy}" r="${(r * 0.93).toFixed(2)}" fill="${opts.backing}" />`
    : '';
  const check = opts.check === false ? '' : `
      <path d="M ${(cx - r * 0.3).toFixed(2)} ${(cy + r * 0.02).toFixed(2)}
               L ${(cx - r * 0.08).toFixed(2)} ${(cy + r * 0.26).toFixed(2)}
               L ${(cx + r * 0.34).toFixed(2)} ${(cy - r * 0.3).toFixed(2)}"
            stroke-width="${(r * 0.2).toFixed(2)}" />`;

  return `
  <g transform="rotate(-14 ${cx} ${cy})">
    ${backing}
    <g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="${cx}" cy="${cy}" r="${(r * 0.93).toFixed(2)}" stroke-width="${(r * 0.1).toFixed(2)}" />
      <circle cx="${cx}" cy="${cy}" r="${(r * 0.7).toFixed(2)}" stroke-width="${(r * 0.035).toFixed(2)}" />
      <g stroke-width="${(r * 0.05).toFixed(2)}">${ticks.join('')}</g>${check}
    </g>
    <g fill="${PAPER}" opacity="0.55">${fleckMarks}</g>
  </g>`;
}

/**
 * Dave's head — hood + face only, no body/scythe — at icon scale. `s` is grid-to-pixel scale
 * (Dave's source art is a 64-unit grid; see src/ui/characters/Character.tsx `Dave`), `(cx, cy)`
 * is where grid point (32, 28) — the head's centre — lands. `S` is the overall canvas size, used
 * to hold the ink outline at a fixed 5px-at-1024 regardless of how big the head itself is drawn.
 */
function daveHead(cx, cy, s, S) {
  const sw = (5 * (S / 1024)) / s;
  const tx = (cx - 32 * s).toFixed(2);
  const ty = (cy - 28 * s).toFixed(2);
  return `
  <g transform="translate(${tx} ${ty}) scale(${s.toFixed(4)})">
    <path d="M32 6 C18 6 14 20 14 30 L14 50 L50 50 L50 30 C50 20 46 6 32 6 Z"
          fill="${DAVE_GREEN}" stroke="${INK}" stroke-width="${sw.toFixed(3)}" stroke-linejoin="round" />
    <circle cx="32" cy="27" r="11" fill="${DAVE_CREAM}" stroke="${INK}" stroke-width="${sw.toFixed(3)}" />
  </g>`;
}

/**
 * The chosen mark: Dave's hood and face peeking over the seal's top edge, seal drawn on top with
 * an opaque backing so his chin disappears behind it instead of showing through the rings.
 * Positioning is proportional to `r` so it holds at any canvas/seal size (icon vs. foreground).
 */
function sealWithDave(S, cx, cy, r, backing = PAPER) {
  const s = 0.01397 * r;
  const headCy = cy - 1.024 * r;
  return daveHead(cx, headCy, s, S) + seal(cx, cy, r, INK_RED, { backing });
}

/** Candidate C: Dave's face centred inside the seal, in place of the checkmark. */
function sealFaceInside(S, cx, cy, r, backing = PAPER) {
  const s = r * 0.025;
  return seal(cx, cy, r, INK_RED, { backing, check: false }) + daveHead(cx, cy - s, s, S);
}

/** Parchment with the faint ruling of a form nobody reads (`ruled: false` for a flat fill). */
function parchment(size, { dark = false, ruled = true } = {}) {
  const base = dark ? '#1B1915' : PAPER;
  if (!ruled) return `<rect width="${size}" height="${size}" fill="${base}" />`;
  const rule = dark ? '#4A4238' : LINE;
  const step = size / 16;
  const lines = [];
  for (let y = step; y < size; y += step) {
    lines.push(`<line x1="0" y1="${y.toFixed(2)}" x2="${size}" y2="${y.toFixed(2)}" />`);
  }
  return `<rect width="${size}" height="${size}" fill="${base}" />
    <g stroke="${rule}" stroke-width="${(size / 512).toFixed(2)}" opacity="0.35">${lines.join('')}</g>`;
}

/**
 * The in-game stamp seal (src/ui/components/StampButton.tsx `StampSeal`): a solid red disc with
 * an ink outline and a cream dashed ring inside, tilted like a stamp pressed by a bored hand.
 * `R` is the outer radius; the ink outline is held at a fixed 5px-at-1024 (like the seal itself
 * on the button, which doesn't get thicker just because the icon canvas is bigger), the dashed
 * ring scales with `R` to match the button's own 54:42:3 ratio.
 */
function stampSeal(cx, cy, R, S, tilt = -8) {
  const outlineSW = 5 * (S / 1024);
  const ringR = R * (42 / 54);
  const ringSW = R * (3 / 54);
  const dashOn = (R * (6 / 54)).toFixed(2);
  const dashOff = (R * (5 / 54)).toFixed(2);
  return `
  <g transform="rotate(${tilt} ${cx} ${cy})">
    <circle cx="${cx}" cy="${cy}" r="${R.toFixed(2)}" fill="${INK_RED}" stroke="${INK}" stroke-width="${outlineSW.toFixed(3)}" />
    <circle cx="${cx}" cy="${cy}" r="${ringR.toFixed(2)}" fill="none" stroke="${DAVE_CREAM}" stroke-width="${ringSW.toFixed(3)}" stroke-dasharray="${dashOn} ${dashOff}" />
  </g>`;
}

/**
 * Full Dave (src/ui/characters/Character.tsx `Dave` + `Face` mood 'ok'): hood, cream face, eyes
 * and a smile — everything except the scythe/collar, which don't read at icon scale. `s` is
 * grid-to-pixel scale (Dave's source art is a 64-unit grid) and outlines stay at the source's own
 * 2.5/64 ratio, scaled up by the group transform exactly like the shipped component does.
 * `(faceCx, faceCy)` is where the face circle's centre — grid (32, 27) — lands.
 */
function daveIcon(faceCx, faceCy, s) {
  const headCy = faceCy + s; // face sits 1 grid unit above the hood's own (32, 28) origin
  const tx = (faceCx - 32 * s).toFixed(2);
  const ty = (headCy - 28 * s).toFixed(2);
  return `
  <g transform="translate(${tx} ${ty}) scale(${s.toFixed(4)})">
    <path d="M32 6 C18 6 14 20 14 30 L14 50 L50 50 L50 30 C50 20 46 6 32 6 Z"
          fill="${DAVE_GREEN}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" />
    <circle cx="32" cy="27" r="11" fill="${DAVE_CREAM}" stroke="${INK}" stroke-width="2.5" />
    <g stroke="${INK}" stroke-width="2.5" stroke-linecap="round" fill="${INK}">
      <circle cx="27" cy="26" r="1.6" />
      <circle cx="37" cy="26" r="1.6" />
      <path d="M28 33 Q32 36 36 33" fill="none" />
    </g>
  </g>`;
}

/** The chosen mark: Dave centred inside the stamp seal, face at ~35% of the canvas. */
function daveOnSeal(S, cx, cy, R) {
  const faceR = R * 0.4375; // R*0.4375 = 0.35*S/2 when R = 0.4*S (seal at 80% canvas)
  const s = faceR / 11;
  return stampSeal(cx, cy, R, S) + daveIcon(cx, cy, s);
}

const svg = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;

const png = (size, body, file) =>
  sharp(Buffer.from(svg(size, body))).png({ compressionLevel: 9 }).toFile(file);

const candidatesDir = path.join(storeDir, 'icon-candidates');

async function main() {
  await mkdir(assetsDir, { recursive: true });
  await mkdir(storeDir, { recursive: true });
  await mkdir(candidatesDir, { recursive: true });

  const S = 1024;

  // Three candidates at 512px, plus a 48px downsample of each so the controller can compare
  // the small-size read without eyeballing a shrunk browser tab.
  const CS = 512;
  const candidates = {
    A: parchment(CS) + seal(CS / 2, CS / 2, CS * 0.35),
    B: parchment(CS) + sealWithDave(CS, CS / 2, CS / 2, CS * 0.35),
    C: parchment(CS, { ruled: false }) + daveOnSeal(CS, CS / 2, CS / 2, CS * 0.4),
  };
  for (const [name, body] of Object.entries(candidates)) {
    const buf = Buffer.from(svg(CS, body));
    await sharp(buf).resize(CS, CS).png({ compressionLevel: 9 }).toFile(path.join(candidatesDir, `${name}.png`));
    await sharp(buf).resize(48, 48).png({ compressionLevel: 9 }).toFile(path.join(candidatesDir, `${name}-48.png`));
  }

  // Pick: C — Dave centred inside the in-game stamp seal. Square icon: the seal fills the tile,
  // the way a stamp lands on a form.
  const square = parchment(S, { ruled: false }) + daveOnSeal(S, S / 2, S / 2, S * 0.4);
  // Adaptive foreground: `@capacitor/assets` writes the XML with `android:inset="16.7%"`, so
  // this whole square is scaled down into the 72dp safe zone for us. The art therefore fills
  // its own canvas edge to edge — shrinking it here too would inset it twice and leave a
  // postage stamp floating in the middle of the launcher tile.
  const foreground = daveOnSeal(S, S / 2, S / 2, S * 0.47);
  const background = parchment(S, { ruled: false });

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

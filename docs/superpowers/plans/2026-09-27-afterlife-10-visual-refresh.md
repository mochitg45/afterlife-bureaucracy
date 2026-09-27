# Visual refresh (Plan 10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the new chibi art into the game: character sprites on staff rows and cards, a painted department scene behind the stamp, Adventure Capitalist-style staff bars, a chibi animated title screen, and the four painted story scenes in the intro.

**Architecture:** One Python script cuts the Gemini sheets into transparent WebP sprites under `public/art/`. A single lookup table `ART` (id → file) in `src/ui/characters/art.ts` decides whether an id has a sprite; `Character` renders an `<img>` when it does and the existing SVG otherwise, so every call site keeps working. Staff rows and cards pass their own ids (not the shared `character` codes, which repeat across departments). All motion is CSS keyframes; `prefers-reduced-motion` turns it off.

**Tech Stack:** Python 3.12 + Pillow 12 (offline asset script), React 18, CSS, vitest + Testing Library, Vite `public/` assets served under `import.meta.env.BASE_URL`.

**Spec:** `docs/superpowers/specs/2026-09-14-afterlife-bureaucracy-design.md` §10 (visual style). User feedback (2026-09-27): chibi sticker style from the approved "row 1" sheet; title screen chibi with a little animation; Intake/Heaven/Hell each with their own background; staff card milestone bar at the top and a speed bar at the bottom "like Adventure Capitalist"; a square background behind the stamp showing the place; change the staff art.

## Global Constraints

- Source art (do not regenerate in this plan): `docs/art/characters-v2/b1..b7*.jpg`, `docs/art/depts-v2/*.jpg`, `docs/art/story-v2/scene1..4*.jpg`. All six departments have a background, including `valhalla.jpg`; any unknown department id falls back to Intake's.
- Sprites: transparent WebP, 256×256, character centred with 8 px margin, no name text, no card frame. Department backgrounds: WebP 768×768, quality 82. Story scenes: WebP 768×1376, quality 82. Total added assets ≤ 6 MB.
- Paths at runtime: `${import.meta.env.BASE_URL}art/...` (works for web and Capacitor).
- `Character` keeps its current API and SVG fallback; new optional prop only.
- No engine or save changes. `npm test` and `npm run build` green before every commit; commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push after each commit.
- Motion honours `prefers-reduced-motion: reduce` (no animation, static frame).
- Style: smallest diff, reuse existing helpers and class names, one behavioural test per item.

---

### Task 1: Sprite and background cutter

**Files:**
- Create: `scripts/cut-art.py`
- Create: `public/art/chars/*.webp`, `public/art/depts/*.webp`, `public/art/story/*.webp` (generated, committed)
- Modify: `package.json` (script `"art": "python scripts/cut-art.py"`)

**Interfaces:**
- Produces: sprite files named exactly as the keys below (e.g. `public/art/chars/dave.webp`), department files `public/art/depts/{intake,heaven,hell,reincarnation,limbo,valhalla}.webp`, story files `public/art/story/{in-decease,in-queue,in-offer,in-stamp}.webp`.

Sheet layouts (row-major; 3 columns × 2 rows unless noted). Each card is a rounded cream panel with the name printed in its bottom ~20%:

```
b1-temps.jpg              choir-cherub, qa-imp, karma-clerk, dust-archivist, temp-stapler, petty-cash
b2-fulltime.jpg           petra, malphas, pemberton, ferro, auditor-fine, melodia
b3-fulltime2.jpg          lilith, nadia, forgot, night-temp, bev, grax
b4-senior-exec.jpg        wheel-tech, obroin, grandma-liu, seraph-board, vassago, bodhisattva
b5-intake-exec.jpg        dave, seraphine, gary, auditor, keeper, auditor-true
b6-variants-valhalla.jpg  (skip), (skip), sigrun, ottar, hjalti, brynhildr
b7-reroll-dave-gary.jpg   2 columns × 1 row: dave-cooked, gary-break
```

That is 36 sprites. Story mapping: scene1-notice → in-decease, scene2-intake → in-queue, scene3-offer → in-offer, scene4-desk → in-stamp.

- [ ] **Step 1: Write the script.** For each sheet: detect the card panels (the sheet background is slightly darker than the cream panels; find panel boxes by thresholding and connected components, or fall back to an even grid split with a 3% inset if detection finds the wrong count), take each panel, drop the bottom 22% (name text), then remove the flat cream panel background with a flood fill from the panel's edge pixels (tolerance ~18 in RGB distance) so only the character and its outline and soft ground shadow remain; keep interior cream pixels that are not connected to the edge. Trim to the alpha bounding box, pad 8 px, fit into 256×256 preserving aspect, save WebP (quality 90, with alpha). Department and story images: resize and save WebP quality 82.
- [ ] **Step 2: Run it** (`python scripts/cut-art.py`), build a contact sheet PNG of all sprites on a checkerboard at `%TEMP%/art-contact.png` and look at it: every sprite must be the whole character, no name text, no leftover cream box, no chopped heads or props. Fix thresholds until clean. Report file count (36 sprites, 6 depts, 4 story) and total bytes.
- [ ] **Step 3: Commit** `feat(art): cut chibi sprites, department and story images into public/art` with the script and outputs.

---

### Task 2: Character sprites on staff rows and cards

**Files:**
- Create: `src/ui/characters/art.ts`
- Modify: `src/ui/characters/Character.tsx` (optional `art?: string` prop)
- Modify: `src/ui/components/StaffRow.tsx`, `src/ui/components/CardTile.tsx`, `src/ui/overlays/CardSheet.tsx`
- Test: `src/ui/characters/Character.test.tsx`

**Interfaces:**
- Produces: `export const ART: Record<string, string>` (staff id or card id → sprite name) and `export function artUrl(key: string): string | null`.

`ART` contents (exact):

```ts
export const ART: Record<string, string> = {
  // staff ids
  dave: 'dave', seraphine: 'seraphine', gary: 'gary', auditor: 'auditor',
  'h-cherub': 'choir-cherub', 'h-gatekeeper': 'petra', 'h-harpist': 'melodia', 'h-archangel': 'bev', 'h-seraph': 'seraph-board',
  'd-imp': 'qa-imp', 'd-steward': 'malphas', 'd-hr': 'lilith', 'd-foreman': 'grax', 'd-duke': 'vassago',
  'l-archivist': 'dust-archivist', 'l-lost-found': 'ferro', 'l-forgotten': 'forgot', 'l-registrar': 'obroin', 'l-keeper': 'keeper',
  'r-accountant': 'karma-clerk', 'r-placement': 'pemberton', 'r-actuary': 'nadia', 'r-wheel': 'wheel-tech', 'r-bodhisattva': 'bodhisattva',
  'v-shieldmaiden': 'sigrun', 'v-skald': 'ottar', 'v-quartermaster': 'hjalti', 'v-valkyrie': 'brynhildr',
  // card ids
  'c-dave-overtime': 'dave', 'c-seraphine-chipper': 'seraphine', 'c-gary-break': 'gary-break',
  'c-cherub-choir': 'choir-cherub', 'c-imp-qa': 'qa-imp', 'c-clerk-karma': 'karma-clerk', 'c-archivist-dust': 'dust-archivist',
  'c-temp-stapler': 'temp-stapler', 'c-temp-voucher': 'petty-cash', 'c-temp-night': 'night-temp',
  'c-petra-keys': 'petra', 'c-malphas-forks': 'malphas', 'c-pemberton': 'pemberton', 'c-ferro': 'ferro',
  'c-auditor-fruit': 'auditor-fine', 'c-harpist-hold': 'melodia', 'c-lilith-culture': 'lilith', 'c-nadia-odds': 'nadia', 'c-forgot': 'forgot',
  'c-bev-wings': 'bev', 'c-grax-fire': 'grax', 'c-wheel-tech': 'wheel-tech', 'c-obroin': 'obroin', 'c-dave-cooked': 'dave-cooked', 'c-grandma-liu': 'grandma-liu',
  'c-seraph-board': 'seraph-board', 'c-duke-vassago': 'vassago', 'c-bodhisattva': 'bodhisattva', 'c-keeper': 'keeper', 'c-auditor-true': 'auditor-true',
};
export function artUrl(key: string): string | null {
  const name = ART[key];
  return name ? `${import.meta.env.BASE_URL}art/chars/${name}.webp` : null;
}
```

(`v-einherjar` deliberately has no sprite: it keeps the SVG.)

- [ ] **Step 1: Failing tests** in `Character.test.tsx`: `render(<Character id="angel:0" art="h-cherub" mood="ok" size={52} />)` renders an `img` with `src` ending `art/chars/choir-cherub.webp`, `alt=""`, width/height 52; `render(<Character id="angel:3" art="v-einherjar" mood="ok" />)` renders the SVG (no img); without `art` it renders the SVG as today. Also a test that every value in `ART` is one of the 36 sprite names from Task 1 (hard-code the list in the test).
- [ ] **Step 2: Implement**: in `Character`, if `art` is given and `artUrl(art)` is not null, return `<img className="char-sprite" src={url} alt="" width={size} height={size} data-character={id} data-mood={mood} loading="lazy" decoding="async" />`; when `mood === 'cooked'` add class `cooked` (CSS: slight desaturation and a 2 px droop via `transform: translateY(2px)`, no animation). Call sites: `StaffRow` passes `art={staff.id}`; `CardTile` passes `art={owned ? card.id : undefined}`; `CardSheet` passes `art={card.id}`. CSS `.char-sprite { object-fit: contain; }`.
- [ ] **Step 3:** `npm test && npm run build`, commit `feat(ui): chibi sprites on staff rows and personnel cards`.

---

### Task 3: Department scene behind the stamp

**Files:**
- Modify: `src/ui/components/StampButton.tsx` (wrap the stamp area; do not change the button behaviour)
- Modify: `src/ui/theme.css`
- Test: `src/ui/components/StampButton.test.tsx` (create if missing)

**Interfaces:**
- Consumes: `useGame((s) => s.state.activeDept)`.

- [ ] **Step 1: Failing test**: rendering the stamp area with `activeDept: 'hell'` shows an element with `data-testid="stamp-scene"` whose inline `backgroundImage` contains `art/depts/hell.webp`; with `activeDept: 'valhalla'` it contains `art/depts/valhalla.webp`; with an unknown id it contains `art/depts/intake.webp` (fallback).
- [ ] **Step 2: Implement**: wrap the existing stamp and its "+N per stamp" line in a `div.stamp-scene` (`data-testid="stamp-scene"`, inline `backgroundImage: url(${BASE_URL}art/depts/${file}.webp)`) where `file` is the department id if it is one of `intake, heaven, hell, reincarnation, limbo, valhalla`, else `intake`. CSS: a square card (`aspect-ratio: 1 / 1; width: 100%; max-width: 420px; margin: 0 auto 12px; border-radius: var(--radius); background-size: cover; background-position: center; box-shadow: var(--shadow); border: 1.5px solid var(--line); display: grid; place-items: center;`); the "+N per stamp" label sits on a small translucent cream pill at the bottom of the square so it stays readable on dark scenes (Hell).
- [ ] **Step 3:** tests, build, commit `feat(ui): painted department scene behind the stamp`.

---

### Task 4: Adventure Capitalist staff bars

**Files:**
- Modify: `src/ui/components/StaffRow.tsx`, `src/ui/screens/OfficeScreen.tsx` (pass the index)
- Modify: `src/ui/theme.css`
- Test: `src/ui/components/StaffRow.test.tsx`

**Interfaces:**
- Consumes: `nextMilestone`, `prevMilestone`, `milestoneMult` from `src/engine/economy.ts`; `rates.byStaff[id]`.

Ruling for this plan: the game pays continuously, so the speed bar is visual. Each staff row gets a cycle period `period = BASE[index] / milestoneMult(owned)` seconds, `BASE = [0.6, 1.2, 2.4, 4.8, 9.6]` by the staff's position in its department (index 0..4, clamp to the last), floored at 0.15 s. The bar loops with a CSS animation of that duration and shows the yield per cycle `rate × period` inside it (e.g. "+1.2K / 2.4s"). Below 0.25 s the bar stops animating and shows full with the label "+X / s (max speed)", like Adventure Capitalist. With 0 owned the bar is empty and still. The milestone progress bar moves to the TOP of the row as a thin bar labelled "×2 at {next}".

- [ ] **Step 1: Failing tests**: (a) the row renders the milestone bar before the name (DOM order: `.milestone-bar` precedes `.staff-name`) with text "×2 at 200" for 152 owned; (b) the speed bar `.speed-bar` has `style.animationDuration` equal to `0.3s` for a staff at index 1 with 25 owned (milestoneMult 4 → 1.2/4); (c) with 0 owned `.speed-bar` has class `idle`; (d) at 400 owned for index 0 (0.6/64 < 0.25) it has class `max` and a label containing "max speed".
- [ ] **Step 2: Implement** in `StaffRow` (new prop `index`, passed from `OfficeScreen`'s `dept.staff.map((s, i) => ...)`); keyframe `@keyframes speed-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }` on the fill with `transform-origin: left`, `animation: speed-fill var(--period) linear infinite`; reduced motion shows a static full bar.
- [ ] **Step 3:** tests, build, commit `feat(ui): staff milestone bar on top, looping speed bar below`.

---

### Task 5: Chibi title screen and painted intro

**Files:**
- Modify: `src/ui/screens/TitleScreen.tsx`, `src/ui/overlays/Intro.tsx`, `src/ui/theme.css`
- Test: `src/ui/screens/TitleScreen.test.tsx`, `src/ui/overlays/Intro.test.tsx`

- [ ] **Step 1: Title**: the cast shows `dave`, `seraphine` and `gary` sprites (via `Character` with `art`) around the stamp seal; each sprite has a gentle idle bob (`@keyframes bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }`, 2.4 s ease-in-out infinite, staggered 0 / 0.4 / 0.8 s); the seal keeps its pulse; the Intake department image sits behind the parchment at 18% opacity. Test: the title renders three `img.char-sprite` elements inside `.title-cast`.
- [ ] **Step 2: Intro**: replace the four SVG scene bodies with a full-bleed `<img className="intro-scene-img" src={`${BASE_URL}art/story/${scene.id}.webp`} alt="" />` (object-fit cover, top-aligned) and keep the caption, CTA, pacer and advance logic untouched; the caption sits in a cream dialogue box over the bottom third (the art leaves that area quiet). Slow drift on the image (`scale(1) → scale(1.06)` over the scene's pacer duration), none under reduced motion. Test: each scene renders an `img.intro-scene-img` whose src ends with `art/story/<scene id>.webp`; existing intro tests stay green.
- [ ] **Step 3:** tests, build, commit `feat(ui): chibi animated title screen and painted story intro`.

---

## Self-review

- Every user ask has a task: title chibi + animation (T5), per-department backgrounds behind a square stamp area (T3), milestone bar on top + AdCap speed bar at the bottom (T4), staff art (T1, T2), story in chibi (T5, art from story-v2).
- Placeholders: none.
- Types: `ART`/`artUrl` (T2) are the only new exports; T3 and T5 use `BASE_URL` paths with names produced by T1.

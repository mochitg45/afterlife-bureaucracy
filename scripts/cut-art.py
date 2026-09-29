"""Cut chibi character sprites, department art, and story art from the
docs/art/*-v2 source sheets into public/art/{chars,depts,story} as WebP.

ponytail: even-grid cell split + edge-seeded chain flood fill, tuned by eye
against the contact sheet. No CC/contour detection — the source sheets are a
regular grid, so that would be solving a harder problem than we have.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from scipy import ndimage
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_CHARS = ROOT / "docs/art/characters-v2"
SRC_DEPTS = ROOT / "docs/art/depts-v2"
SRC_STORY = ROOT / "docs/art/story-v2"
OUT_CHARS = ROOT / "public/art/chars"
OUT_DEPTS = ROOT / "public/art/depts"
OUT_STORY = ROOT / "public/art/story"
SRC_SOULS = ROOT / "docs/art/souls-v2"
OUT_SOULS = ROOT / "public/art/souls"

# Soul face sheets: 4x4, no card frames or names. One letter per cell, row-major:
# f = female, m = male, a = pet (pet lines tag their face, e.g. "a-07|..."). Output is {letter}-{NN}.webp, numbered per letter.
SOUL_SHEETS: list[tuple[str, str]] = [
    ("s1-women.jpg", "fffffffmfffmfffm"),
    ("s2-men.jpg", "mmmmmmmmmfmmmmmm"),
    ("s3-women.jpg", "fffffffffmffffff"),
    ("s4-men.jpg", "mmmmmmmmmmmmmmfm"),
    ("s5-pets.jpg", "aaaaaaaaaaaaaaaa"),
]
SOUL_SIZE = 128
# Cells whose pale body runs off the cell and floods through: fill their convex hull instead.
HULL_CELLS = {("s5-pets.jpg", 3)}  # the hamster

# (sheet file, cols, rows, names row-major; None = skip that cell)
SHEETS = [
    ("b1-temps.jpg", 3, 2, ["choir-cherub", "qa-imp", "karma-clerk", "dust-archivist", "temp-stapler", "petty-cash"]),
    ("b2-fulltime.jpg", 3, 2, ["petra", "malphas", "pemberton", "ferro", "auditor-fine", "melodia"]),
    ("b3-fulltime2.jpg", 3, 2, ["lilith", "nadia", "forgot", "night-temp", "bev", "grax"]),
    ("b4-senior-exec.jpg", 3, 2, ["wheel-tech", "obroin", "grandma-liu", "seraph-board", "vassago", "bodhisattva"]),
    # dave: None here -- public/art/chars/dave.webp is hand-cut from docs/art/characters-v2/b8-dave.jpg,
    # do not let this sheet's auto-cut overwrite it.
    ("b5-intake-exec.jpg", 3, 2, [None, "seraphine", "gary", "auditor", "keeper", "auditor-true"]),
    ("b6-variants-valhalla.jpg", 3, 2, [None, None, "sigrun", "ottar", "hjalti", "brynhildr"]),
    ("b7-reroll-dave-gary.jpg", 2, 1, ["dave-cooked", "gary-break"]),
]

DEPTS = ["intake", "heaven", "hell", "reincarnation", "limbo", "valhalla"]

STORY = {
    "scene1-notice.jpg": "in-decease",
    "scene2-intake.jpg": "in-queue",
    "scene3-offer.jpg": "in-offer",
    "scene4-desk.jpg": "in-stamp",
}

CELL_INSET = 0.0  # fraction of cell trimmed off each side before flood fill (clears the card's border stroke)
BG_SAT_MAX = 0.24  # HSV saturation ceiling for "flat cream panel/page" pixels
BG_VAL_MIN = 0.72  # HSV value floor for same
SPRITE_SIZE = 256
SPRITE_MARGIN = 8
DEPT_SIZE = 768
STORY_SIZE = (768, 1376)


def flood_background(rgb: np.ndarray, sat_max: float, val_min: float) -> np.ndarray:
    """Classify every pixel as background-ish (flat, low-saturation, bright
    cream -- the panel fill and the page behind it are the same family of
    color) then flood-fill that per-pixel candidate mask inward from the
    image border. Interior cream pixels not connected to the edge (e.g. a
    white sticker highlight) survive; the character's saturated/dark outline
    blocks the flood. Returns a bool mask, True = background."""
    h, w, _ = rgb.shape
    rgb_f = rgb.astype(np.float32)
    cmax = rgb_f.max(axis=2)
    cmin = rgb_f.min(axis=2)
    val = cmax / 255.0
    sat = np.where(cmax > 0, (cmax - cmin) / np.maximum(cmax, 1e-6), 0.0)
    candidate = (sat <= sat_max) & (val >= val_min)

    bg = np.zeros((h, w), dtype=bool)
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            if candidate[y, x] and not bg[y, x]:
                bg[y, x] = True
                stack.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if candidate[y, x] and not bg[y, x]:
                bg[y, x] = True
                stack.append((y, x))
    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and candidate[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                stack.append((ny, nx))
    return bg


TEXT_GAP_ROWS = 10  # empty rows separating the character (and its shadow) from the name text below
MIN_BLOB_FRAC = 0.015  # drop foreground islands smaller than this fraction of the biggest one


def cutout_sprite(cell: Image.Image, drop_edge: bool = False, tight_bg: bool = False, hull: bool = False) -> Image.Image:
    """Flood the page, card fill and card border away from the cell edges,
    cut the name text off at the lowest empty-row gap, and drop tiny islands."""
    rgb = np.array(cell.convert("RGB"))
    fg = ~flood_background(rgb, BG_SAT_MAX, BG_VAL_MIN)
    if tight_bg:
        # pale pets: white fur is as bright as the page, so only flood pixels that match the
        # page colour itself (sampled from the corners), keeping fur, sticker rim and glow.
        page = np.median(np.concatenate([rgb[:4, :4].reshape(-1, 3), rgb[-4:, -4:].reshape(-1, 3)]), axis=0)
        near = np.abs(rgb.astype(np.int16) - page).max(axis=2) <= 10
        lab_bg, _ = ndimage.label(near)
        edge = np.unique(np.concatenate([lab_bg[0], lab_bg[:, 0], lab_bg[:, -1]]))  # not the bottom: busts end there
        fg = ~np.isin(lab_bg, edge[edge > 0])
        fg |= ndimage.binary_fill_holes(ndimage.binary_closing(fg, iterations=4))  # seal pinholes in the ink
    if hull:
        from scipy.spatial import ConvexHull
        from PIL import ImageDraw
        pts = np.argwhere(fg)[:, ::-1]
        poly = Image.new("L", (fg.shape[1], fg.shape[0]), 0)
        ImageDraw.Draw(poly).polygon([tuple(p) for p in pts[ConvexHull(pts).vertices]], fill=1)
        fg |= np.array(poly, dtype=bool)

    # name text: walk up from the bottom; after the first inked row, the first
    # run of TEXT_GAP_ROWS empty rows is the gap above the name.
    rows = fg.sum(axis=1) > 0
    h = len(rows)
    y, seen, gap = h - 1, False, 0
    cut = h
    while y >= 0:
        if rows[y]:
            seen, gap = True, 0
        elif seen:
            gap += 1
            if gap >= TEXT_GAP_ROWS:
                cut = y + gap
                break
        y -= 1
    if cut < h * 0.6:  # no plausible text gap found; keep everything
        cut = h
    fg[cut:] = False

    lab, n = ndimage.label(fg)
    if n:
        sizes = ndimage.sum(fg, lab, range(1, n + 1))
        keep_ids = 1 + np.flatnonzero(sizes >= sizes.max() * MIN_BLOB_FRAC)
        if drop_edge:  # frameless sheets: islands on the cell edge are a neighbour's overhang
            big = 1 + int(np.argmax(sizes))
            edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
            keep_ids = [i for i in keep_ids if i == big or i not in edge]
        fg &= np.isin(lab, keep_ids)

    alpha = np.where(fg, 255, 0).astype(np.uint8)
    out = Image.fromarray(np.dstack([rgb, alpha]), mode="RGBA")

    bbox = out.getbbox()
    if bbox is None:
        return out
    out = out.crop(bbox)

    ow, oh = out.size
    canvas_w, canvas_h = ow + 2 * SPRITE_MARGIN, oh + 2 * SPRITE_MARGIN
    padded = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    padded.paste(out, (SPRITE_MARGIN, SPRITE_MARGIN), out)

    scale = min(SPRITE_SIZE / canvas_w, SPRITE_SIZE / canvas_h)
    new_w, new_h = max(1, round(canvas_w * scale)), max(1, round(canvas_h * scale))
    resized = padded.resize((new_w, new_h), Image.LANCZOS)

    final = Image.new("RGBA", (SPRITE_SIZE, SPRITE_SIZE), (0, 0, 0, 0))
    final.paste(resized, ((SPRITE_SIZE - new_w) // 2, (SPRITE_SIZE - new_h) // 2), resized)
    return final


def cut_sheet(path: Path, cols: int, rows: int, names: list[str | None], drop_edge: bool = False, tight_bg: bool = False) -> list[tuple[str, Image.Image]]:
    idx = -1
    sheet = Image.open(path).convert("RGB")
    w, h = sheet.size
    cw, ch = w / cols, h / rows
    out = []
    i = 0
    for r in range(rows):
        for c in range(cols):
            name = names[i]
            i += 1
            idx = i - 1
            if name is None:
                continue
            x0, y0 = c * cw, r * ch
            ix, iy = cw * CELL_INSET, ch * CELL_INSET
            cell = sheet.crop((round(x0 + ix), round(y0 + iy), round(x0 + cw - ix), round(y0 + ch - iy)))
            out.append((name, cutout_sprite(cell, drop_edge, tight_bg, (path.name, idx) in HULL_CELLS)))
    return out


def cut_souls() -> dict[str, int]:
    """Cut every soul sheet into 128px faces; returns the count per kind letter."""
    OUT_SOULS.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    for sheet_name, kinds in SOUL_SHEETS:
        assert len(kinds) == 16, sheet_name
        cells = cut_sheet(SRC_SOULS / sheet_name, 4, 4, list(kinds), drop_edge=True, tight_bg="a" in kinds)
        for kind, sprite in cells:
            counts[kind] = counts.get(kind, 0) + 1
            sprite.resize((SOUL_SIZE, SOUL_SIZE), Image.LANCZOS).save(
                OUT_SOULS / f"{kind}-{counts[kind]:02d}.webp", format="WEBP", quality=88)
    import json
    full = {k: counts.get(k, 0) for k in "fmax"}
    (ROOT / "src/data/soul-faces.json").write_text(json.dumps(full) + "\n", encoding="utf-8")
    return counts


SRC_FLYERS = ROOT / "docs/art/flyers"
OUT_FLYERS = ROOT / "public/art/flyers"
FLYER_FRAMES = 4
FLYER_HEIGHT = 160


def cut_strip(name: str) -> int:
    """Cut a 1-row animation strip ({name}-strip.jpg, flat page colour) into
    {name}-N.webp frames. Every frame gets the same box and scale, so the body
    stays put and only the wings move (per-frame fitting would make it wobble)."""
    rgb = np.array(Image.open(SRC_FLYERS / f"{name}-strip.jpg").convert("RGB"))
    page = np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), axis=0)
    near = np.abs(rgb.astype(np.int16) - page).max(axis=2) <= 14
    lab, _ = ndimage.label(near)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    fg = ~np.isin(lab, edge[edge > 0])
    lab, n = ndimage.label(fg)  # drop JPEG speckle
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    fg &= np.isin(lab, 1 + np.flatnonzero(sizes >= sizes.max() * MIN_BLOB_FRAC))

    w = rgb.shape[1]
    cw = w // FLYER_FRAMES
    ys, xs = np.nonzero(fg)
    top, bot = ys.min() - SPRITE_MARGIN, ys.max() + 1 + SPRITE_MARGIN
    # widest frame sets the shared width; each frame centres on its own ink
    spans = [np.nonzero(fg[:, i * cw:(i + 1) * cw].any(axis=0))[0] + i * cw for i in range(FLYER_FRAMES)]
    bw = max(s[-1] - s[0] + 1 for s in spans) + 2 * SPRITE_MARGIN
    rgba = np.dstack([rgb, np.where(fg, 255, 0).astype(np.uint8)])
    OUT_FLYERS.mkdir(parents=True, exist_ok=True)
    scale = FLYER_HEIGHT / (bot - top)
    size = (round(bw * scale), FLYER_HEIGHT)
    for i, s in enumerate(spans):
        frame = np.zeros((bot - top, bw, 4), np.uint8)
        x0 = s[0] - SPRITE_MARGIN
        src = rgba[top:bot, max(x0, 0):min(x0 + bw, (i + 1) * cw)]
        frame[:, max(-x0, 0):max(-x0, 0) + src.shape[1]] = src
        Image.fromarray(frame).resize(size, Image.LANCZOS).save(
            OUT_FLYERS / f"{name}-{i + 1}.webp", format="WEBP", quality=90)
    return FLYER_FRAMES


def cover_crop(im: Image.Image, target: tuple[int, int]) -> Image.Image:
    tw, th = target
    w, h = im.size
    scale = max(tw / w, th / h)
    nw, nh = round(w * scale), round(h * scale)
    im = im.resize((nw, nh), Image.LANCZOS)
    # crop from the top (per brief), centered horizontally
    left = (nw - tw) // 2
    return im.crop((left, 0, left + tw, th))


def main() -> None:
    for d in (OUT_CHARS, OUT_DEPTS, OUT_STORY):
        d.mkdir(parents=True, exist_ok=True)

    sprite_count = 0
    for sheet_name, cols, rows, names in SHEETS:
        for name, sprite in cut_sheet(SRC_CHARS / sheet_name, cols, rows, names):
            sprite.save(OUT_CHARS / f"{name}.webp", format="WEBP", quality=90, lossless=False)
            sprite_count += 1

    dept_count = 0
    for dept in DEPTS:
        im = Image.open(SRC_DEPTS / f"{dept}.jpg").convert("RGB")
        im = im.resize((DEPT_SIZE, DEPT_SIZE), Image.LANCZOS)
        im.save(OUT_DEPTS / f"{dept}.webp", format="WEBP", quality=82)
        dept_count += 1

    story_count = 0
    for src_name, out_name in STORY.items():
        im = Image.open(SRC_STORY / src_name).convert("RGB")
        if im.size != STORY_SIZE:
            im = cover_crop(im, STORY_SIZE)
        im.save(OUT_STORY / f"{out_name}.webp", format="WEBP", quality=82)
        story_count += 1

    souls = cut_souls()
    print(f"sprites={sprite_count} depts={dept_count} story={story_count} souls={souls}")


if __name__ == "__main__":
    if sys.argv[1:2] == ["strip"]:  # python scripts/cut-art.py strip pip
        print(f"{sys.argv[2]}: {cut_strip(sys.argv[2])} frames")
    else:
        sys.exit(main())

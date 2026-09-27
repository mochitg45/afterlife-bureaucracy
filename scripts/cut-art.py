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
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_CHARS = ROOT / "docs/art/characters-v2"
SRC_DEPTS = ROOT / "docs/art/depts-v2"
SRC_STORY = ROOT / "docs/art/story-v2"
OUT_CHARS = ROOT / "public/art/chars"
OUT_DEPTS = ROOT / "public/art/depts"
OUT_STORY = ROOT / "public/art/story"

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

CELL_INSET = 0.08  # fraction of cell trimmed off each side before flood fill (clears the card's border stroke)
BOTTOM_TEXT_FRAC = 0.22  # bottom slice dropped (name text)
BG_SAT_MAX = 0.15  # HSV saturation ceiling for "flat cream panel/page" pixels
BG_VAL_MIN = 0.75  # HSV value floor for same
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


def cutout_sprite(cell: Image.Image) -> Image.Image:
    cell = cell.convert("RGB")
    w, h = cell.size
    cell = cell.crop((0, 0, w, int(h * (1 - BOTTOM_TEXT_FRAC))))
    rgb = np.array(cell)
    bg = flood_background(rgb, BG_SAT_MAX, BG_VAL_MIN)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])
    out = Image.fromarray(rgba, mode="RGBA")

    bbox = out.getbbox()
    if bbox is None:
        return out
    out = out.crop(bbox)

    # pad 8px transparent margin, then fit into 256x256 preserving aspect
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


def cut_sheet(path: Path, cols: int, rows: int, names: list[str | None]) -> list[tuple[str, Image.Image]]:
    sheet = Image.open(path).convert("RGB")
    w, h = sheet.size
    cw, ch = w / cols, h / rows
    out = []
    i = 0
    for r in range(rows):
        for c in range(cols):
            name = names[i]
            i += 1
            if name is None:
                continue
            x0, y0 = c * cw, r * ch
            ix, iy = cw * CELL_INSET, ch * CELL_INSET
            cell = sheet.crop((round(x0 + ix), round(y0 + iy), round(x0 + cw - ix), round(y0 + ch - iy)))
            out.append((name, cutout_sprite(cell)))
    return out


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

    print(f"sprites={sprite_count} depts={dept_count} story={story_count}")


if __name__ == "__main__":
    sys.exit(main())

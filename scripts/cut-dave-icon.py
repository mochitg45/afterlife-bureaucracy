"""
Cuts Dave's head and hood out of the 1024px Gemini card (docs/art/characters-v2/b8-dave.jpg) and
upscales it 3x with LANCZOS, for the full-bleed app icon (scripts/make-icon-v3.mjs). The 256px game
sprite is far too small to fill a 1024px icon, so the card is the source.

Output: docs/art/icon-v3/dave-cutout.png (RGBA). Run: python scripts/cut-dave-icon.py
"""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = 'docs/art/characters-v2/b8-dave.jpg'
OUT = 'docs/art/icon-v3/dave-cutout.png'
BOX = (362, 252, 662, 556)  # hood, face and the top of the robe; below this the clipboard and scythe hand start
SCALE = 3

img = Image.open(SRC).convert('RGB').crop(BOX)
a = np.asarray(img).astype(int)

# Background = light, low-contrast pixels reachable from the crop border. The face is the same
# cream as the card but sits inside the dark hood outline, so the flood never reaches it.
light = a.min(axis=2) > 170
lab, _ = ndimage.label(light)
border_labels = set(np.unique(np.concatenate([lab[0], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border_labels))
# The crop's bottom edge cuts through the robe, which is purple, so it is never "bg".
fg = ~bg
fg = ndimage.binary_opening(fg, iterations=1)
fg = ndimage.binary_fill_holes(fg)
# Keep only the biggest piece (drops JPEG specks).
lab, n = ndimage.label(fg)
sizes = ndimage.sum(fg, lab, range(1, n + 1))
fg = lab == (1 + int(np.argmax(sizes)))
# Shave the half-light fringe that anti-aliasing leaves outside the outline.
fg = ndimage.binary_erosion(fg, iterations=1)

mask = Image.fromarray((fg * 255).astype('uint8'))
rgb = img.resize((img.width * SCALE, img.height * SCALE), Image.LANCZOS)
rgb = rgb.filter(ImageFilter.UnsharpMask(radius=2.2, percent=90, threshold=2))
# Upscale the mask smoothly, then sharpen its edge back so the outline stays crisp.
m = mask.resize(rgb.size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.6))
m = m.point(lambda v: 0 if v < 118 else (255 if v > 138 else int((v - 118) * 255 / 20)))
rgba = rgb.convert('RGBA')
rgba.putalpha(m)
# Re-draw the outline outside the (eroded, slightly ragged) silhouette: a clean dark plate, one
# dilation wide, under the figure. Reads as a sticker edge and survives downsizing to 48px.
plate_a = m.filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.GaussianBlur(1.4))
plate_a = plate_a.point(lambda v: 0 if v < 110 else (255 if v > 150 else int((v - 110) * 255 / 40)))
plate = Image.new('RGBA', rgba.size, (44, 27, 40, 255))
plate.putalpha(plate_a)
plate.alpha_composite(rgba)
rgba = plate
import os
os.makedirs('docs/art/icon-v3', exist_ok=True)
rgba.save(OUT)
print(rgba.size)

import sys, numpy as np
from PIL import Image
from scipy import ndimage
src, out, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
# green-key strength: how much green exceeds the other channels
key = g - np.maximum(r, b)
alpha = np.clip(1 - (key - 40) / 80, 0, 1)            # soft edge between 40..120
# despill: pull green down toward max(r,b) on the edge pixels
g2 = np.minimum(g, np.maximum(r, b) + 10)
rgb = np.stack([r, g2, b], -1)
fg = alpha > 0.5
# Slot cut lines at the emptiest columns; each slot's interior (away from the cut lines) seeds
# that sprite, and every foreground pixel joins the nearest seed, so a blade tip touching a
# neighbour stays with its owner instead of merging the two sprites.
col = np.convolve(fg.sum(0), np.ones(15) / 15, 'same')
W = fg.shape[1]
cuts = []
for k in range(1, n):
    g0 = int(W * k / n); lo, hi = g0 - int(W / n / 2.5), g0 + int(W / n / 2.5)
    cuts.append(lo + int(np.argmin(col[lo:hi])))
edges = [0] + cuts + [W]
seeds = np.zeros(fg.shape, np.int32)
for k in range(n):
    a0, a1 = edges[k] + (60 if k else 0), edges[k + 1] - (60 if k < n - 1 else 0)
    seeds[:, a0:a1] = np.where(fg[:, a0:a1], k + 1, 0)
# geodesic-ish: nearest seed (euclidean) restricted to foreground
_, idx = ndimage.distance_transform_edt(seeds == 0, return_indices=True)
nearest = np.where(fg, seeds[idx[0], idx[1]], 0)
# a component that lies within one sprite's reach is kept whole (a blade tip crossing the cut
# line stays with its sprite); only components that really join two sprites are divided
clab, ccnt = ndimage.label(fg)
lab = nearest.copy()
for ci in range(1, ccnt + 1):
    m = clab == ci
    owners = np.unique(seeds[m]); owners = owners[owners > 0]
    if len(owners) == 1:
        lab[m] = owners[0]
    elif len(owners) == 0:
        xs = np.where(m)[1]; lab[m] = np.searchsorted(cuts, xs.mean()) + 1
groups = [[(0, k + 1, 0)] for k in range(n)]
print('cuts', cuts)
frames = []
for gi, grp in enumerate(groups):
    mask = np.isin(lab, [c[1] for c in grp])
    ys, xs = np.where(mask)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    a = (alpha * mask)[y0:y1 + 1, x0:x1 + 1]
    c = rgb[y0:y1 + 1, x0:x1 + 1]
    # remove the ground shadow oval: light, low-saturation pixels in the bottom band
    hh = a.shape[0]
    band = np.zeros_like(a, bool); band[int(hh * 0.86):] = True
    cc = c
    sat = cc.max(-1) - cc.min(-1)
    luma = cc.mean(-1)
    shadow = band & (luma > 140) & (sat < 70)
    a = np.where(shadow, 0, a)
    # drop small pieces not connected to the sprite (neighbour blade tips, specks)
    sl, sc = ndimage.label(a > 0.3)
    if sc > 1:
        ss = ndimage.sum(a > 0.3, sl, range(1, sc + 1))
        keepl = [i + 1 for i, v in enumerate(ss) if v >= 0.04 * ss.max()]
        a = np.where(np.isin(sl, keepl) | (a <= 0.3) & ndimage.binary_dilation(np.isin(sl, keepl), iterations=2), a, 0)
    rgba = np.concatenate([c, (a * 255)[..., None]], -1).astype(np.uint8)
    frames.append((rgba, y0, y1, x0, x1))
# shared scale: tallest sprite height -> 150 px; canvas 192, feet baseline at y=180
# one scale per sheet, set by sprite 1 (always the standing reference pose): every sheet's
# standing pose comes out the same height, so frames from different sheets match
ref = Image.fromarray(frames[0][0], 'RGBA'); H = ref.crop(ref.getbbox()).size[1]
s = float(sys.argv[4]) if len(sys.argv) > 4 else 128 / H
print('scale', s)
for i, (rgba, y0, y1, x0, x1) in enumerate(frames):
    img = Image.fromarray(rgba, 'RGBA')
    bb = img.getbbox(); img = img.crop(bb)
    w, h = img.size
    img = img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    arr = np.asarray(img)
    # lower-body alpha centroid for x alignment (bottom 30% of sprite)
    lo = arr[int(arr.shape[0] * 0.7):, :, 3].astype(float)
    cx = (lo.sum(0) * np.arange(lo.shape[1])).sum() / max(lo.sum(), 1)
    canvas = Image.new('RGBA', (192, 192), (0, 0, 0, 0))
    canvas.alpha_composite(img, (int(round(96 - cx)), 180 - img.size[1]))
    canvas.save(f'{out}_{i + 1}.png')
print('saved', len(frames))

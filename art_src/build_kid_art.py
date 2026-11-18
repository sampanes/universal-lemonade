"""Build the game-size paper-doll kid layers from the big sources in art_src/kid/.

Sources (transparent PNGs, dark plum outline on everything):
    kid_base.png    bald, blank face; skin in gray, shirt in pure blue, apron in pure green
    hair_<id>.png   hair only, in gray, with the face area left see-through
    face_<id>.png   eyes, brows, mouth and blush in their real colors

Every layer is placed on one shared canvas (the base plus headroom for buns and ponytails),
so the game just stacks them. A recolorable layer is split in two:
    <layer>_fixed.png  the parts that never change color (outline, eyes), see-through elsewhere
    <layer>_shade.png  the recolorable parts: R = lightness, G = region id * 60, A = coverage
The game turns lightness into the picked color: darker than the region's middle tone scales
the color down, lighter blends it toward white (the shine). kid.json holds each region's
middle tone, the layer lists and the head box used for small head pictures.

Faces are lined up by their blush cheeks; hair by its face opening. FIT tunes one hair.

Run from the repo root:
    py -3.11 -I art_src/build_kid_art.py
"""
import json
import os

import numpy as np
from PIL import Image, ImageFilter

SRC = os.path.join('art_src', 'kid')
DST = os.path.join('public', 'sprites', 'kid')
OUT_W = 480            # canvas width in the game (about 2x the biggest kid on the MSI)
PAD_TOP, PAD_SIDE = 300, 300   # headroom on the source canvas for buns, ponytails, spikes

# Order shown in the mirror. Saves store the index, so add new styles at the end.
HAIRS = ['swoop', 'curly', 'bob', 'ponytail', 'buns',
         'braids', 'pigtails', 'wavy', 'sidepart', 'afro', 'topknot']
FACES = ['happy', 'cheer', 'soldout', 'calm', 'sleepy', 'wink']
# hole = face-opening width / head width; bang = bang line as a share of head height.
FIT = {
    'curly': dict(hole=0.78, bang=0.30),
    'ponytail': dict(hole=0.78, bang=0.30),
    'bob': dict(hole=0.74, bang=0.32),
    'buns': dict(hole=0.80, bang=0.30),
    'swoop': dict(hole=0.80, bang=0.28),
    # head = (center x, chin y, width) of the head the hair was drawn on, in the source's
    # pixels (measured from the same sheet drawn with chin lines).
    'braids': dict(head=(213, 368, 254)),
    'pigtails': dict(head=(254, 357, 255)),
    'wavy': dict(head=(261, 361, 260)),
    'sidepart': dict(head=(211, 390, 269)),
    'afro': dict(head=(260, 427, 253)),
    'topknot': dict(head=(228, 444, 262)),
}
HEAD_W, CHIN_Y = 1.02, 0.97        # the kid's head width and inner chin line, as shares of the head box
CHEEK_SPAN, CHEEK_Y = 0.60, 0.66   # face: cheeks apart / cheek height, as shares of the head
REGION_IDS = {'skin': 1, 'shirt': 2, 'apron': 3, 'hair': 4}
# Dark skin: a thin edge under the dark face lines, tinted in the game to a shade lighter
# than the skin (a white mask here), so lines stay readable without a pale halo.
RIM_SIZE, RIM_ALPHA = 5, 0.7       # edge width (game pixels, odd) and strength


def load(path):
    a = np.asarray(Image.open(path).convert('RGBA')).astype(float) / 255
    rgb = a[..., :3]
    mx, mn = rgb.max(-1), rgb.min(-1)
    return a, mx - mn, (mx + mn) / 2


def hue_of(rgb, s):
    mx = rgb.max(-1)
    d = np.where(s == 0, 1, s)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60


def label(a, s, L, keyed):
    """Region id per pixel (0 = fixed color). Edge blends join the nearest region."""
    vis = a[..., 3] > 0.02
    outline = vis & (L < 0.26)
    lab = np.zeros(L.shape, int)
    if keyed:
        h = hue_of(a[..., :3], s)
        lab[vis & ~outline & (s < 0.12)] = REGION_IDS['skin']
        lab[vis & ~outline & (s >= 0.12) & (h >= 170) & (h < 260)] = REGION_IDS['shirt']
        lab[vis & ~outline & (s >= 0.12) & (h >= 60) & (h < 170)] = REGION_IDS['apron']
    else:
        lab[vis & ~outline & (s < 0.12)] = REGION_IDS['hair']
    left = vis & ~outline & (lab == 0)
    for _ in range(4):
        if not left.any():
            break
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nb = np.roll(np.roll(lab, dy, 0), dx, 1)
            fill = left & (lab == 0) & (nb > 0)
            lab[fill] = nb[fill]
        left = vis & ~outline & (lab == 0)
    return lab


def head_box(a):
    vis = a[..., 3] > 0.5
    rows = np.where(vis.any(1))[0]
    top, bottom = rows[0], rows[-1]
    widths = vis.sum(1)
    lo, hi = top + int((bottom - top) * 0.35), top + int((bottom - top) * 0.62)
    neck = lo + int(np.argmin(widths[lo:hi]))
    xs = np.where(vis[top:top + int((neck - top) * 0.3)].any(0))[0]
    return top, neck, xs[0], xs[-1]


def hole_box(a):
    alpha = a[..., 3] > 0.3
    H, W = alpha.shape
    cols = np.where(alpha.any(0))[0]
    cx = (cols[0] + cols[-1]) // 2
    hair_rows = np.where(alpha[:, cx])[0]
    bang = hair_rows[hair_rows < H * 0.8].max()
    y = min(H - 1, bang + int(H * 0.08))
    row = alpha[y]
    left, right = np.where(row[:cx])[0], np.where(row[cx:])[0]
    lx = left[-1] if len(left) else 0
    rx = cx + right[0] if len(right) else W - 1
    return bang, lx, rx


def cheeks(a, s):
    rgb = a[..., :3]
    h = hue_of(rgb, s)
    pink = (a[..., 3] > 0.8) & (s > 0.25) & ((h > 330) | (h < 15)) & (rgb.max(-1) > 0.75)
    ys, xs = np.where(pink)
    lm, rm = xs < xs.min() + 110, xs > xs.max() - 110
    return (xs[lm].mean(), ys[lm].mean()), (xs[rm].mean(), ys[rm].mean())


def place(img, k, x, y, size):
    """Scale a float RGBA array by k and paste it at (x, y) on an empty canvas of size."""
    im = Image.fromarray((img * 255).round().astype(np.uint8), 'RGBA')
    im = im.convert('RGBa').resize((round(im.width * k), round(im.height * k)), Image.LANCZOS).convert('RGBA')
    canvas = Image.new('RGBA', size, (0, 0, 0, 0))
    canvas.alpha_composite(im, (round(x), round(y)))
    return np.asarray(canvas).astype(float) / 255


def shrink_rgba(a, size):
    im = Image.fromarray((a * 255).round().astype(np.uint8), 'RGBA')
    return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def shrink_f(x, size):
    return np.asarray(Image.fromarray(x.astype(np.float32), 'F').resize(size, Image.BOX))


def write_layer(name, a, lab, size, L0s):
    """Split a placed full-size layer into _fixed and (if it has regions) _shade files."""
    s_ = a[..., :3].max(-1) - a[..., :3].min(-1)
    L = (a[..., :3].max(-1) + a[..., :3].min(-1)) / 2
    fixed = a.copy()
    fixed[lab > 0, 3] = 0
    shrink_rgba(fixed, size).save(os.path.join(DST, f'{name}_fixed.png'), optimize=True)
    if not (lab > 0).any():
        return
    cov = np.where(lab > 0, a[..., 3], 0)
    c_small = shrink_f(cov, size)
    l_small = shrink_f(L * cov, size) / np.maximum(c_small, 1e-6)
    ids = sorted(set(np.unique(lab)) - {0})
    best = np.zeros(c_small.shape, int)
    best_cov = np.zeros(c_small.shape)
    for rid in ids:
        rc = shrink_f(np.where(lab == rid, a[..., 3], 0), size)
        take = rc > best_cov
        best[take], best_cov[take] = rid, rc[take]
        m = (lab == rid) & (L > 0.3)
        L0s[rid] = round(float(np.median(L[m])), 4)
    out = np.zeros(c_small.shape + (4,), np.uint8)
    out[..., 0] = np.clip(l_small * 255, 0, 255).round()
    out[..., 1] = best * 60
    out[..., 3] = np.clip(c_small * 255, 0, 255).round()
    Image.fromarray(out, 'RGBA').save(os.path.join(DST, f'{name}_shade.png'), optimize=True)


def main():
    os.makedirs(DST, exist_ok=True)
    base, bs, bL = load(os.path.join(SRC, 'kid_base.png'))
    H0, W0 = base.shape[:2]
    CW, CH = W0 + 2 * PAD_SIDE, H0 + PAD_TOP
    full = (CW, CH)
    k_out = OUT_W / CW
    size = (OUT_W, round(CH * k_out))
    top, neck, hx0, hx1 = head_box(base)
    hw, hh = hx1 - hx0, neck - top
    hcx = PAD_SIDE + (hx0 + hx1) / 2
    htop = PAD_TOP + top
    L0s = {}

    # Body
    body = place(base, 1.0, PAD_SIDE, PAD_TOP, full)
    write_layer('body', body, label(*load_arr(body), True), size, L0s)

    # Hair
    hair_L0 = {}
    for hid in HAIRS:
        a, s, L = load(os.path.join(SRC, f'hair_{hid}.png'))
        f = FIT[hid]
        if 'head' in f:
            cx, chin, w = f['head']
            k = HEAD_W * hw / w
            placed = place(a, k, hcx - cx * k, htop + CHIN_Y * hh - chin * k, full)
        else:
            bang, lx, rx = hole_box(a)
            k = f['hole'] * hw / max(1, rx - lx)
            placed = place(a, k, hcx - (lx + rx) / 2 * k, htop + f['bang'] * hh - bang * k, full)
        tmp = {}
        write_layer(f'hair_{hid}', placed, label(*load_arr(placed), False), size, tmp)
        hair_L0[hid] = tmp[REGION_IDS['hair']]

    # Faces (+ a light rim under the dark lines, used on dark skin)
    for fid in FACES:
        a, s, L = load(os.path.join(SRC, f'face_{fid}.png'))
        (lx, ly), (rx, ry) = cheeks(a, s)
        k = CHEEK_SPAN * hw / (rx - lx)
        placed = place(a, k, hcx - (lx + rx) / 2 * k, htop + CHEEK_Y * hh - (ly + ry) / 2 * k, full)
        small = shrink_rgba(placed, size)
        small.save(os.path.join(DST, f'face_{fid}.png'), optimize=True)
        f = np.asarray(small).astype(float) / 255
        fL = (f[..., :3].max(-1) + f[..., :3].min(-1)) / 2
        dark = ((f[..., 3] > 0.5) & (fL < 0.4)).astype(np.uint8) * 255
        grown = Image.fromarray(dark, 'L').filter(ImageFilter.MaxFilter(RIM_SIZE)).filter(ImageFilter.GaussianBlur(0.6))
        rim = np.zeros(f.shape, np.uint8)
        rim[..., :3] = 255
        rim[..., 3] = (np.asarray(grown).astype(float) * RIM_ALPHA).round()
        Image.fromarray(rim, 'RGBA').save(os.path.join(DST, f'face_{fid}_rim.png'), optimize=True)

    # Square head box (for the small head pictures), in game canvas pixels.
    side = 1.55 * hw
    cy = htop + 0.42 * hh
    head = [round((hcx - side / 2) * k_out), round((cy - side / 2) * k_out), round(side * k_out), round(side * k_out)]
    manifest = {
        'w': size[0], 'h': size[1],
        'L0': {name: L0s[rid] for name, rid in REGION_IDS.items() if rid in L0s},
        'hairs': [{'id': h, 'L0': hair_L0[h]} for h in HAIRS],
        'faces': FACES,
        'head': head,
    }
    with open(os.path.join(DST, 'kid.json'), 'w', encoding='ascii') as fh:
        json.dump(manifest, fh, indent=1)
    print('[OK]', size, manifest['L0'], 'head', head)


def load_arr(a):
    rgb = a[..., :3]
    mx, mn = rgb.max(-1), rgb.min(-1)
    return a, mx - mn, (mx + mn) / 2


if __name__ == '__main__':
    main()

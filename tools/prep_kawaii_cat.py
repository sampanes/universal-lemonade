# tools/prep_kawaii_cat.py -- import step for the kawaii cat sprite drop.
#
# Usage (from the repo root, needs Pillow + numpy):
#   py -3.11 tools/prep_kawaii_cat.py art_src/kawaii_cat public/sprites/kawaii_cat cat0.png cat1.png ...
#
# Raw cuts live in art_src/ (not deployed). This writes web-ready copies into public/:
# cleaned up so they sit on light cards, and palette-quantized (about 5x smaller).
#
# The sprites were keyed off a flat dark purple sheet, which looks fine on dark backgrounds
# but leaves two kinds of dirt that show on light ones:
#   1. pockets of sheet color the key missed (e.g. between the spark lines over a cat's head)
#   2. a 1-2 px rim of opaque pixels that are part art, part sheet color (a dark halo)
# Step 1 flood-fills from the transparent area through sheet-colored pixels. Step 2 treats
# each rim pixel as  C = t*F + (1-t)*KEY, where F is the clean art color just inside it,
# and stores color F with alpha scaled by t.
import sys, os
import numpy as np
from PIL import Image

KEY = np.array([48, 16, 70], dtype=np.float64)   # sheet background (#301046)


def dilate(mask):
    """8-neighborhood dilation of a boolean mask."""
    h, w = mask.shape
    pad = np.pad(mask, 1)
    out = np.zeros_like(mask)
    for dy in (0, 1, 2):
        for dx in (0, 1, 2):
            out |= pad[dy:dy + h, dx:dx + w]
    return out


def neighbors_mean(rgb, weight):
    """Mean color of the 8 neighbors, weighted by `weight` (H x W). Returns (mean, total_weight)."""
    acc = np.zeros_like(rgb)
    tot = np.zeros(weight.shape)
    pr = np.pad(rgb * weight[..., None], ((1, 1), (1, 1), (0, 0)))
    pw = np.pad(weight, 1)
    h, w = weight.shape
    for dy in (0, 1, 2):
        for dx in (0, 1, 2):
            if dy == 1 and dx == 1:
                continue
            acc += pr[dy:dy + h, dx:dx + w]
            tot += pw[dy:dy + h, dx:dx + w]
    return acc / np.maximum(tot, 1e-9)[..., None], tot


def defringe(im):
    px = np.asarray(im.convert('RGBA'), dtype=np.float64)
    rgb, a = px[..., :3].copy(), px[..., 3] / 255.0
    key_dist2 = ((rgb - KEY) ** 2).sum(-1)

    # 1. Flood in from the image border through transparent and sheet-colored pixels. Dark ink
    #    that is enclosed by art (eyes, mouths) is never reached, so it survives.
    keylike = key_dist2 < 95.0 ** 2
    passable = (a < 0.05) | keylike
    bg = np.zeros_like(passable)
    bg[0, :], bg[-1, :], bg[:, 0], bg[:, -1] = passable[0, :], passable[-1, :], passable[:, 0], passable[:, -1]
    while True:
        grown = dilate(bg) & passable & ~bg
        if not grown.any():
            break
        bg |= grown
    a = np.where(bg, 0.0, a)

    # Everything see-through that connects to the outside. Soft pixels that are NOT in here
    # are enclosed by art.
    ext = bg.copy()
    while True:
        grown = dilate(ext) & (a <= 0.5) & ~ext
        if not grown.any():
            break
        ext |= grown

    # The key also nibbled the rims of the dark eyes and mouths (their ink is close to the
    # sheet color), leaving see-through specks inside the face. Put those back: an enclosed
    # soft pixel touching solid dark ink becomes solid again, recombined with the sheet color.
    for _ in range(2):
        ink = (a >= 0.98) & (((rgb - KEY) ** 2).sum(-1) < 75.0 ** 2)
        nibbled = ~ext & (a < 0.98) & dilate(ink)
        rgb[nibbled] = rgb[nibbled] * a[nibbled][:, None] + KEY * (1.0 - a[nibbled][:, None])
        a = np.where(nibbled, 1.0, a)

    # 2. Rim cleanup. Push clean interior color outward over the two outer rings of solid
    #    pixels and the soft pixels beyond them.
    solid = a > 0.5
    ring1 = solid & dilate(ext)
    ring2 = solid & ~ring1 & dilate(ring1)
    soft = (a > 0) & ~solid & ext
    f = rgb.copy()
    known = solid & ~ring1 & ~ring2
    for band in (ring2, ring1, soft, soft):
        mean, tot = neighbors_mean(f, known.astype(np.float64))
        ok = band & ~known & (tot > 0)
        f[ok] = mean[ok]
        known |= ok
    # Thin features (sparkle tips, spark lines) have no interior to borrow from: use the
    # solid neighbors instead, weighted toward the ones least like the sheet color.
    edge = (ring1 | ring2 | soft) & ~known
    clean = (key_dist2 ** 2) * solid
    mean, tot = neighbors_mean(rgb, clean / max(clean.max(), 1e-9))
    ok = edge & (tot > 0)
    f[ok] = mean[ok]
    known |= ok

    fk = f - KEY
    denom = np.maximum((fk * fk).sum(-1), 1e-9)
    t = np.clip(((rgb - KEY) * fk).sum(-1) / denom, 0.0, 1.0)
    fix = (ring1 | ring2 | soft) & known
    fix &= denom > 60.0 ** 2      # art whose own color is near the sheet color: leave alone
    fix &= t < 0.94               # already clean: leave alone
    rgb[fix] = f[fix]
    a = np.where(fix, a * t, a)
    # Faint dark pixels with no art anywhere near them.
    stray = soft & ~known & (rgb.max(-1) < 150)
    a = np.where(stray, 0.0, a)

    out = np.dstack([np.clip(rgb, 0, 255), np.clip(a * 255.0, 0, 255)]).round().astype(np.uint8)
    out[out[..., 3] == 0] = 0
    return Image.fromarray(out)


def main(src_dir, dst_dir, names):
    os.makedirs(dst_dir, exist_ok=True)
    total_in = total_out = 0
    for name in names:
        im = Image.open(os.path.join(src_dir, name)).convert('RGBA')
        # n0..n9 and nc are flat ink that is itself close to the sheet color: keep as cut.
        is_digit = name[0] == 'n' and len(name) <= 6
        res = im if is_digit else defringe(im)
        res = res.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        dst = os.path.join(dst_dir, name)
        res.save(dst, optimize=True)
        total_in += os.path.getsize(os.path.join(src_dir, name))
        total_out += os.path.getsize(dst)
    print(f'{len(names)} sprites: {total_in // 1024} KB -> {total_out // 1024} KB in {dst_dir}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3:])

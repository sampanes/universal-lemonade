"""Cut the painted sky out of the friends' stand backdrops, so the day scene's own sky (its
color changes with the weather) and its drifting clouds show behind the buildings.

Sources: art_src/backdrops/<friend's stand pic>.webp (elm, ballpark, pool), 1080 x 540 with a
flat painted sky. The sky goes clear: all of that color joined to the top edge, and any patch
boxed in by the picture (inside the playground tower) that is bigger than a speck and the
very same color (the pool's house windows are a slightly different blue, and stay). The soft
edge where the dark outline meets the sky is unmixed from the sky color, so it fades to
clear without a blue fringe.

Out: public/sprites/backdrops/<name>.webp, same size, with alpha.

Run from the repo root:
    py -3.11 -I art_src/build_backdrop_art.py
"""
import glob
import os

import numpy as np
from PIL import Image

SRC = os.path.join('art_src', 'backdrops')
DST = os.path.join('public', 'sprites', 'backdrops')
SKY_TOL = 22        # RGB distance from the sky color that still counts as sky
SPECK = 60          # a boxed-in patch of sky color smaller than this (px) stays painted...
PATCH_TOL = 6       # ...and so does one whose average is farther than this from the sky color
EDGE = 2            # px of the outline's soft edge (next to the sky) that get unmixed
FIT_TOL = 30        # an edge pixel unmixes only if it really is outline over sky


def dilate(mask):
    out = mask.copy()
    out[1:] |= mask[:-1]
    out[:-1] |= mask[1:]
    out[:, 1:] |= mask[:, :-1]
    out[:, :-1] |= mask[:, 1:]
    return out


def grow(seed, mask):
    """Everything in mask joined to seed (4-neighbors)."""
    while True:
        more = dilate(seed) & mask
        if (more == seed).all():
            return seed
        seed = more


def cut(rgb):
    sky_color = np.median(rgb[:8].reshape(-1, 3), axis=0)
    off = np.linalg.norm(rgb - sky_color, axis=2)
    near_sky = off < SKY_TOL

    top = np.zeros_like(near_sky)
    top[0] = near_sky[0]
    sky = grow(top, near_sky)
    left = near_sky & ~sky
    pockets = 0
    while left.any():
        y, x = np.argwhere(left)[0]
        seed = np.zeros_like(left)
        seed[y, x] = True
        patch = grow(seed, left)
        left &= ~patch
        if patch.sum() >= SPECK and off[patch].mean() < PATCH_TOL:
            sky |= patch
            pockets += 1

    # The outline color: the darkest tenth of the picture.
    lum = rgb.mean(axis=2)
    ink = np.median(rgb[lum <= np.percentile(lum, 10)], axis=0)

    alpha = np.where(sky, 0.0, 1.0)
    color = rgb.copy()
    edge = sky.copy()
    for _ in range(EDGE):
        edge = dilate(edge)
    edge &= ~sky
    # pixel = a * ink + (1 - a) * sky: a from the pixel's place on the line from sky to ink.
    span = ink - sky_color
    a = np.clip(((rgb - sky_color) @ span) / (span @ span), 0.0, 1.0)
    fit = np.linalg.norm(rgb - (sky_color + a[..., None] * span), axis=2) < FIT_TOL
    soft = edge & fit & (a < 1.0)
    alpha[soft] = a[soft]
    safe = np.maximum(a, 1e-3)[..., None]
    unmixed = np.clip((rgb - (1.0 - a[..., None]) * sky_color) / safe, 0, 255)
    color[soft] = unmixed[soft]
    return color, alpha, sky_color, ink, pockets, int(soft.sum())


def main():
    os.makedirs(DST, exist_ok=True)
    for path in sorted(glob.glob(os.path.join(SRC, '*.webp'))):
        rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float64)
        color, alpha, sky_color, ink, pockets, soft = cut(rgb)
        out = np.dstack([color, alpha * 255]).round().astype(np.uint8)
        name = os.path.basename(path)
        Image.fromarray(out, 'RGBA').save(os.path.join(DST, name), quality=90, method=6)
        print('[OK] %s: sky %s, ink %s, %.0f%% clear, %d boxed-in patches, %d soft edge px' % (
            name, sky_color.astype(int).tolist(), ink.astype(int).tolist(),
            100 * (alpha == 0).mean(), pockets, soft))


if __name__ == '__main__':
    main()

"""Clean the cut-out edges of small UI sprites and enlarge the stretched ones.

Some sprites were cut off a white background with hard (on/off) alpha, which
leaves a whitish fringe on dark backgrounds, and small ones stretched wide get
stair-stepped edges. (The old frame and weather panel art had both problems;
those are drawn in CSS now.)

For each sprite this script:
  1. removes light fringe pixels on the outer edge (lighter than the art
     just inside them),
  2. bleeds the inside colours out under the transparent area, so the
     enlarged edge blends into the art's own outline colour, not white,
  3. enlarges RGB with Lanczos and rebuilds alpha as a smooth anti-aliased
     edge.

Originals are kept in art_src/morning_prep/ and are the input; output goes to
public/sprites/morning_prep/. Run from the repo root:
    py -3.11 -I art_src/clean_edges.py
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = os.path.join('art_src', 'morning_prep')
DST = os.path.join('public', 'sprites', 'morning_prep')

# name -> enlargement factor (1 = only clean the edge)
JOBS = {
    'sun_happy': 1,
}

LIGHTER_BY = 35      # a fringe pixel is this much lighter than the art inside it
FRINGE_PASSES = 2


def lum(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def defringe(rgb, opaque):
    """Drop outer-edge pixels that are much lighter than the art next to them."""
    for _ in range(FRINGE_PASSES):
        inner = ndimage.binary_erosion(opaque, iterations=2)
        edge = opaque & ~ndimage.binary_erosion(opaque)
        if not inner.any():
            break
        L = lum(rgb)
        w = inner.astype(float)
        num = ndimage.uniform_filter(L * w, size=7)
        den = ndimage.uniform_filter(w, size=7)
        near = np.where(den > 0, num / np.maximum(den, 1e-6), L)
        drop = edge & (den > 0) & (L - near > LIGHTER_BY)
        if not drop.any():
            break
        opaque = opaque & ~drop
    return opaque


def bleed(rgb, opaque):
    """Give every transparent pixel the colour of the nearest opaque one."""
    _, (iy, ix) = ndimage.distance_transform_edt(~opaque, return_indices=True)
    return rgb[iy, ix]


def process(name, up):
    src = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    a = np.array(src).astype(float)
    rgb, alpha = a[..., :3], a[..., 3] / 255.0
    opaque = alpha > 0.5
    opaque = defringe(rgb, opaque)
    rgb = bleed(rgb, opaque)
    # Keep any real soft alpha inside the shape; the cleaned edge is 0/1.
    alpha = np.where(opaque, np.maximum(alpha, 0.0), 0.0)
    alpha = np.where(opaque & (alpha < 0.5), 1.0, alpha)

    h, w = alpha.shape
    W, H = w * up, h * up
    rgb_img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB')
    rgb_up = np.array(rgb_img.resize((W, H), Image.LANCZOS)).astype(float)

    # Smooth edge: blur the mask a little, enlarge, then tighten the ramp to
    # about 1.5 output px so it is soft but not blurry.
    soft = ndimage.gaussian_filter(alpha, sigma=0.6)
    a_up = np.array(Image.fromarray(soft.astype(np.float32), 'F').resize((W, H), Image.BICUBIC))
    ramp = 0.6 if up > 1 else 1.0
    a_up = np.clip((a_up - 0.5) / ramp + 0.5, 0.0, 1.0)

    out = np.dstack([np.clip(rgb_up, 0, 255), a_up * 255.0]).round().astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(os.path.join(DST, name + '.png'), optimize=True)
    print('[OK] %s %dx%d -> %dx%d' % (name, w, h, W, H))


def main():
    names = sys.argv[1:] or list(JOBS)
    for n in names:
        process(n, JOBS[n])


if __name__ == '__main__':
    main()

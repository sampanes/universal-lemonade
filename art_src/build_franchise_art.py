"""Cut the three friend stands (Elm Street, Ballpark, Pool) out of one sticker sheet.

Source: art_src/franchise/stands_sheet.png, three stickers in a row on a transparent
background. Each is found by its empty columns, cropped to the sticker, and shrunk by ONE
shared scale (so the three stay the same size as each other) until the biggest is SIZE px
on its longer side. Premultiplied while shrinking so the transparent edge does not darken.

Run from the repo root:
    py -3.11 -I art_src/build_franchise_art.py
"""
import os

import numpy as np
from PIL import Image

SRC = os.path.join('art_src', 'franchise', 'stands_sheet.png')
DST = os.path.join('public', 'sprites', 'franchise')
NAMES = ['elm', 'ballpark', 'pool']
SIZE = 320
SOLID = 16      # alpha above this counts as part of a sticker


def runs(mask):
    """[start, end) spans where mask is True, ignoring specks narrower than 20 px."""
    out, start = [], None
    for i, v in enumerate(list(mask) + [False]):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start > 20:
                out.append((start, i))
            start = None
    return out


def main():
    sheet = Image.open(SRC).convert('RGBA')
    alpha = np.array(sheet)[:, :, 3] > SOLID
    cols = runs(alpha.any(axis=0))
    assert len(cols) == len(NAMES), 'expected %d stickers, found %d' % (len(NAMES), len(cols))

    crops = []
    for x0, x1 in cols:
        rows = runs(alpha[:, x0:x1].any(axis=1))
        y0, y1 = rows[0][0], rows[-1][1]
        crops.append(sheet.crop((x0, y0, x1, y1)))

    k = SIZE / max(max(c.size) for c in crops)
    os.makedirs(DST, exist_ok=True)
    for name, im in zip(NAMES, crops):
        w, h = im.size
        size = (round(w * k), round(h * k))
        out = im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')
        out.save(os.path.join(DST, name + '.png'), optimize=True)
        print('[OK] %s.png %dx%d -> %dx%d' % (name, w, h, size[0], size[1]))


if __name__ == '__main__':
    main()

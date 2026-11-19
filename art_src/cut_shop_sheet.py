"""Cut a row of Stand Shop stickers out of one sheet into art_src/shop/ sources.

Source: art_src/shop/sheets/supplies_sheet.png, stickers in a row on a transparent
background (Big Wagon, Supply Club Card, bottles). Each sticker is found by its empty
columns and cropped to itself. Then run build_shop_art.py to make the game-size files.

Run from the repo root:
    py -3.11 -I art_src/cut_shop_sheet.py
    py -3.11 -I art_src/build_shop_art.py
"""
import os

import numpy as np
from PIL import Image

SRC = os.path.join('art_src', 'shop', 'sheets', 'supplies_sheet.png')
DST = os.path.join('art_src', 'shop')
NAMES = ['big_wagon', 'club_card', 'bottles']
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
    for name, (x0, x1) in zip(NAMES, cols):
        rows = runs(alpha[:, x0:x1].any(axis=1))
        y0, y1 = rows[0][0], rows[-1][1]
        im = sheet.crop((x0, y0, x1, y1))
        im.save(os.path.join(DST, name + '.png'), optimize=True)
        print('[OK] %s.png %dx%d' % (name, im.size[0], im.size[1]))


if __name__ == '__main__':
    main()

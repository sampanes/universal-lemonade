"""Cut rows of Stand Shop stickers out of sheets into art_src/shop/ sources.

Sources: art_src/shop/sheets/*.png, stickers in a row on a transparent background.
  supplies_sheet.png  - Big Wagon, Supply Club Card, bottles
  invention_sheet.png - lemon squeezer, Invent It!, Sell It Worldwide
Each sticker is found by its empty columns and cropped to itself. Then run
build_shop_art.py to make the game-size files.

Run from the repo root:
    py -3.11 -I art_src/cut_shop_sheet.py
    py -3.11 -I art_src/build_shop_art.py
"""
import os

import numpy as np
from PIL import Image

SHEETS = os.path.join('art_src', 'shop', 'sheets')
DST = os.path.join('art_src', 'shop')
NAMES = {
    'supplies_sheet.png': ['big_wagon', 'club_card', 'bottles'],
    'invention_sheet.png': ['squeezer', 'invent_it', 'worldwide'],
}
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


def cut(sheet_name, names):
    sheet = Image.open(os.path.join(SHEETS, sheet_name)).convert('RGBA')
    alpha = np.array(sheet)[:, :, 3] > SOLID
    cols = runs(alpha.any(axis=0))
    assert len(cols) == len(names), '%s: expected %d stickers, found %d' % (sheet_name, len(names), len(cols))
    for name, (x0, x1) in zip(names, cols):
        rows = runs(alpha[:, x0:x1].any(axis=1))
        y0, y1 = rows[0][0], rows[-1][1]
        im = sheet.crop((x0, y0, x1, y1))
        im.save(os.path.join(DST, name + '.png'), optimize=True)
        print('[OK] %s.png %dx%d' % (name, im.size[0], im.size[1]))


def main():
    for sheet_name, names in NAMES.items():
        cut(sheet_name, names)


if __name__ == '__main__':
    main()

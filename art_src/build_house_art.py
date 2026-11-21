"""Make the game-size My House pictures and their wall masks.

Sources: art_src/house/sources/house_<name>.png, the same house from the same angle on a
transparent background (onestory, base, treehouse, hq). For each one this writes
  public/sprites/house/house_<name>.webp  - the picture, SIZE wide
  public/sprites/house/walls_<name>.png   - white where the painted walls are (alpha mask)
The game repaints the house by laying the kid's color over the walls mask (CSS
mix-blend-mode: color keeps the drawing's shading). Walls are found by their peach-cream
color; specks are dropped.

Run from the repo root:
    py -3.11 -I art_src/build_house_art.py
"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = os.path.join('art_src', 'house', 'sources')
DST = os.path.join('public', 'sprites', 'house')
NAMES = ['onestory', 'base', 'treehouse', 'hq']
CANVAS = (1448, 1086)   # every source is put on this canvas so the pictures line up
SIZE = (640, 480)
MIN_WALL = 1500         # wall patches smaller than this many source pixels are dropped


def wall_mask(a):
    r, g, b, al = (a[..., i].astype(int) for i in range(4))
    m = ((al > 200) & (r > 225) & (g > 165) & (g < 232) & (b > 130) & (b < 210)
         & (r - b > 42) & (r - b < 100) & (r - g > 18))
    m = ndimage.binary_opening(m, iterations=1)
    lab, n = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    return np.isin(lab, 1 + np.where(sizes > MIN_WALL)[0])


def main():
    os.makedirs(DST, exist_ok=True)
    for name in NAMES:
        src = Image.open(os.path.join(SRC, 'house_%s.png' % name)).convert('RGBA')
        canvas = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
        canvas.paste(src, (0, 0))
        a = np.array(canvas)
        mask = wall_mask(a)
        pic = canvas.convert('RGBa').resize(SIZE, Image.LANCZOS).convert('RGBA')
        pic.save(os.path.join(DST, 'house_%s.webp' % name), quality=90, method=6)
        walls = Image.fromarray((mask * 255).astype(np.uint8)).resize(SIZE, Image.LANCZOS)
        out = Image.new('RGBA', SIZE, (255, 255, 255, 0))
        out.putalpha(walls)
        out.save(os.path.join(DST, 'walls_%s.png' % name), optimize=True)
        print('[OK] %s: %d wall px, %d KB + %d KB' % (
            name, int(mask.sum()),
            os.path.getsize(os.path.join(DST, 'house_%s.webp' % name)) // 1024,
            os.path.getsize(os.path.join(DST, 'walls_%s.png' % name)) // 1024))


if __name__ == '__main__':
    main()

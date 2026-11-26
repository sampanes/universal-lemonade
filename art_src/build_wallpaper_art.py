"""Make the page wallpapers (src/data/trophies.ts) from the wallpaper tiles in art_src/wallpapers/.

Each tile is a 1024 x 1024 pattern on a transparent background with nothing touching its
edges, so it repeats without a seam (its prompt: art_src/prompts/README.md). This puts the
wallpaper's dark color behind it and fades the pattern, so the cards on top stay easy to
read, then shrinks it to TILE px. The page repeats it at half that size (it is drawn at 2x
for sharp screens).

Run from the repo root:
    py -3.11 -I art_src/build_wallpaper_art.py
"""
import os

import numpy as np
from PIL import Image

SRC = os.path.join('art_src', 'wallpapers')
DST = os.path.join('public', 'sprites', 'wallpapers')
TILE = 640   # px; shown at 320 CSS px (game.css body[data-wallpaper])
EDGE = 4     # px of the source that must be empty all around, or the repeat shows a seam

# id -> (background color, how strongly the pattern shows (0 to 1)). The colors match
# body[data-wallpaper] in game.css.
WALLPAPERS = {
    'lemons': ('#2c1338', 0.28),
    'fruit': ('#0f2f38', 0.28),
    'stars': ('#16123f', 0.3),
}


def main():
    os.makedirs(DST, exist_ok=True)
    for wid, (color, strength) in WALLPAPERS.items():
        art = Image.open(os.path.join(SRC, wid + '.png')).convert('RGBA')
        alpha = np.asarray(art)[:, :, 3]
        border = np.concatenate([alpha[:EDGE].ravel(), alpha[-EDGE:].ravel(), alpha[:, :EDGE].ravel(), alpha[:, -EDGE:].ravel()])
        assert border.max() < 16, '%s: the pattern touches the edge, so the tiles would show a seam' % wid
        art.putalpha(art.getchannel('A').point(lambda v: round(v * strength)))
        tile = Image.new('RGBA', art.size, color)
        tile.alpha_composite(art)
        tile = tile.convert('RGB').resize((TILE, TILE), Image.LANCZOS)
        out = os.path.join(DST, wid + '.webp')
        tile.save(out, quality=86, method=6)
        print('[OK] %s %dx%d %d bytes' % (out, TILE, TILE, os.path.getsize(out)))


if __name__ == '__main__':
    main()

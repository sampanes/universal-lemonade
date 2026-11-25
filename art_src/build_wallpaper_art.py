"""Make the page wallpapers (src/data/trophies.ts) from the game's own sticker pictures.

Each wallpaper is one seamless square tile: a dark color with a few stickers scattered over
it, faded so the cards on top stay easy to read. The page repeats the tile at half its size
(it is drawn at 2x for sharp screens). The stickers come from public/sprites/ (the lemon,
the Flavor Lab's fruits, the stars and sparkles), so build_sticker_art.py runs first.

Run from the repo root:
    py -3.11 -I art_src/build_wallpaper_art.py
"""
import os

from PIL import Image

SPRITES = os.path.join('public', 'sprites')
DST = os.path.join('public', 'sprites', 'wallpapers')
TILE = 320   # px; shown at 160 CSS px

# id -> (background color, how strongly the stickers show (0 to 1),
#        [(sticker under public/sprites/, center x, center y, longer side, turn in degrees)])
WALLPAPERS = {
    'lemons': ('#2c1338', 0.42, [
        ('lemon.png', 70, 62, 74, -18),
        ('lemon_wheel.png', 228, 92, 58, 0),
        ('lemon.png', 238, 238, 70, 24),
        ('lemon_wheel.png', 78, 228, 52, 30),
        ('lemon_wheel.png', 156, 160, 30, 12),
    ]),
    'fruit': ('#0f2f38', 0.45, [
        ('flavors/strawberry.png', 66, 66, 64, -14),
        ('flavors/peach.png', 226, 70, 62, 12),
        ('flavors/blueberry.png', 150, 160, 54, 0),
        ('flavors/watermelon.png', 72, 246, 64, 16),
        ('flavors/mango.png', 244, 236, 62, -10),
    ]),
    'stars': ('#16123f', 0.55, [
        ('kawaii_cat/star_small.png', 72, 70, 60, -12),
        ('kawaii_cat/sparkle_big.png', 236, 108, 50, 0),
        ('kawaii_cat/sparkle_small.png', 150, 176, 30, 0),
        ('kawaii_cat/star_small.png', 238, 250, 46, 16),
        ('kawaii_cat/sparkle_small.png', 62, 244, 36, 0),
        ('kawaii_cat/sparkle_small.png', 300, 24, 22, 0),
    ]),
}


def sticker(name, size, turn, strength):
    im = Image.open(os.path.join(SPRITES, name)).convert('RGBA')
    k = size / max(im.size)
    im = im.convert('RGBa').resize((round(im.width * k), round(im.height * k)), Image.LANCZOS).convert('RGBA')
    if turn:
        im = im.rotate(turn, resample=Image.BICUBIC, expand=True)
    a = im.getchannel('A').point(lambda v: round(v * strength))
    im.putalpha(a)
    return im


def main():
    os.makedirs(DST, exist_ok=True)
    for wid, (color, strength, stickers) in WALLPAPERS.items():
        tile = Image.new('RGB', (TILE, TILE), color)
        for name, cx, cy, size, turn in stickers:
            im = sticker(name, size, turn, strength)
            x, y = cx - im.width // 2, cy - im.height // 2
            # Drawn again one tile over in each direction, so a sticker over an edge wraps.
            for dx in (-TILE, 0, TILE):
                for dy in (-TILE, 0, TILE):
                    tile.paste(im, (x + dx, y + dy), im)
        out = os.path.join(DST, wid + '.webp')
        tile.save(out, quality=88, method=6)
        print('[OK] %s %dx%d %d bytes' % (out, TILE, TILE, os.path.getsize(out)))


if __name__ == '__main__':
    main()

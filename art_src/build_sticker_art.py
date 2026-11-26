"""Make the game-size sticker pictures from the big sources.

Sources are the full-size pictures in art_src/shop/ (the Stand Shop), art_src/flavors/ (the
Flavor Lab's fruits), art_src/trophies/ (the money trophies), art_src/yard/ (the yard things),
art_src/brand/ (the brand moves) and art_src/icons/ (the season and alert icons, shown about
16 px tall), each with a transparent background, cleaned (inside
alpha made fully solid, stray specks removed) and cropped to the picture; cut_sheets.py
makes most of them. Each is shrunk so its longer side is the
folder's size (about 2x what the MSI shows), premultiplied so the transparent edge does not
turn dark.

Run from the repo root:
    py -3.11 -I art_src/build_sticker_art.py
"""
import glob
import os

from PIL import Image

# (source folder, game folder, longer side in px)
FOLDERS = [
    (os.path.join('art_src', 'shop'), os.path.join('public', 'sprites', 'shop'), 320),
    (os.path.join('art_src', 'flavors'), os.path.join('public', 'sprites', 'flavors'), 160),
    (os.path.join('art_src', 'trophies'), os.path.join('public', 'sprites', 'trophies'), 200),
    (os.path.join('art_src', 'yard'), os.path.join('public', 'sprites', 'yard'), 320),
    (os.path.join('art_src', 'brand'), os.path.join('public', 'sprites', 'brand'), 240),
    (os.path.join('art_src', 'icons'), os.path.join('public', 'sprites', 'icons'), 64),
]


def main():
    for src, dst, size in FOLDERS:
        os.makedirs(dst, exist_ok=True)
        for path in sorted(glob.glob(os.path.join(src, '*.png'))):
            im = Image.open(path).convert('RGBA')
            w, h = im.size
            k = size / max(w, h)
            out_size = (round(w * k), round(h * k))
            out = im.convert('RGBa').resize(out_size, Image.LANCZOS).convert('RGBA')
            name = os.path.basename(path)
            out.save(os.path.join(dst, name), optimize=True)
            print('[OK] %s %dx%d -> %dx%d' % (name, w, h, out_size[0], out_size[1]))


if __name__ == '__main__':
    main()

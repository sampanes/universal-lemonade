"""Make the game-size Stand Shop pictures from the big sources in art_src/shop/.

Sources are the full-size item pictures (transparent background, cleaned: inside alpha
made fully solid, stray specks removed, cropped to the item). Each is shrunk so its
longer side is SIZE px (about 2x what the MSI shows), premultiplied so the transparent
edge does not turn dark.

Run from the repo root:
    py -3.11 -I art_src/build_shop_art.py
"""
import glob
import os

from PIL import Image

SRC = os.path.join('art_src', 'shop')
DST = os.path.join('public', 'sprites', 'shop')
SIZE = 320


def main():
    os.makedirs(DST, exist_ok=True)
    for path in sorted(glob.glob(os.path.join(SRC, '*.png'))):
        im = Image.open(path).convert('RGBA')
        w, h = im.size
        k = SIZE / max(w, h)
        size = (round(w * k), round(h * k))
        out = im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')
        name = os.path.basename(path)
        out.save(os.path.join(DST, name), optimize=True)
        print('[OK] %s %dx%d -> %dx%d' % (name, w, h, size[0], size[1]))


if __name__ == '__main__':
    main()

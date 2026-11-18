"""Make the game-size stand frame art from the big sources in art_src/frame/.

Sources (full size, already cleaned):
  ribbon.png          the title ribbon (alpha cleaned, cropped to the ribbon)
  awning_tile.png     4 awning stripes cut stripe-edge to stripe-edge, repeats with no seam
  tablecloth_tile.png 4 hem bumps cut bump-bottom to bump-bottom; its gingham was squeezed 1%
                      so 15 gingham repeats fit exactly, and the orange hem stroke was redrawn
                      from the shape so it is even across the join

The two tiles are shrunk from a 3-wide copy and the middle is kept, so the left and right
columns still meet with no seam after resampling. Resizing is done premultiplied so the
transparent edge does not turn dark.

Run from the repo root:
    py -3.11 -I art_src/build_frame_art.py
"""
import os

from PIL import Image

SRC = os.path.join('art_src', 'frame')
DST = os.path.join('public', 'sprites', 'frame')

# name -> output width in px (about 2x the size the MSI shows it at)
JOBS = {
    'ribbon': 1000,
    'awning_tile': 420,
    'tablecloth_tile': 420,
}


def resize_premul(im, size):
    return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def build(name, width):
    im = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    w, h = im.size
    height = round(h * width / w)
    if name.endswith('_tile'):
        strip = Image.new('RGBA', (w * 3, h))
        for i in range(3):
            strip.paste(im, (i * w, 0))
        strip = resize_premul(strip, (width * 3, height))
        out = strip.crop((width, 0, width * 2, height))
    else:
        out = resize_premul(im, (width, height))
    os.makedirs(DST, exist_ok=True)
    out.save(os.path.join(DST, name + '.png'), optimize=True)
    print('[OK] %s %dx%d -> %dx%d' % (name, w, h, width, height))


def main():
    for name, width in JOBS.items():
        build(name, width)


if __name__ == '__main__':
    main()

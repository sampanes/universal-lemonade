# tools/make_pitcher_glass.py -- rebuild public/sprites/pitcher_glass_translucent.png
#
# Usage (from the repo root, needs Pillow):
#   py -3 tools\make_pitcher_glass.py public\sprites\pitcher_cutout.png public\sprites\pitcher_liquid_mask.png public\sprites\pitcher_glass_translucent.png 512
#
# The overlay is drawn on top of the SVG liquid in index.html, so the glass has to be
# see-through. Alpha is derived per pixel from the art itself, over the true glass interior
# (the liquid mask), instead of knocking alpha down inside a rectangle:
#   plain glass -> faint sheen, blue shading -> stays visible, white highlights -> stay bright.
import sys
from PIL import Image, ImageChops, ImageFilter

src, mask_path, out, size = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
im = Image.open(src).convert('RGBA')
mask = Image.open(mask_path).convert('L').point(lambda v: 255 if v > 127 else 0)
r, g, b, a = im.split()

SHEEN = 30          # alpha of plain clear glass
# Blue shading: the less red a pixel has, the thicker the glass reads.
shade = r.point(lambda v: max(0, min(255, int((246 - v) * 4.2))))
# Specular highlights: near-pure-white blobs. Blur the min channel first so noisy
# almost-white patches become soft blobs instead of speckle, then ramp 249.5..253.5 -> 0..1.
minc = ImageChops.darker(ImageChops.darker(r, g), b).filter(ImageFilter.GaussianBlur(3))
hi = minc.point(lambda v: max(0, min(255, int((v - 249.5) / 4.0 * 255))))
hi = hi.filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: int(v * 0.80))

glass_alpha = ImageChops.lighter(ImageChops.lighter(shade, hi), Image.new('L', im.size, SHEEN))
# Glass interior uses derived alpha; outline (outside mask) keeps its original alpha.
new_a = Image.composite(glass_alpha, a, mask)
new_a = ImageChops.darker(new_a, a)
res = Image.merge('RGBA', (r, g, b, new_a))
# Downscale in premultiplied space so edges do not pick up fringes.
res = res.convert('RGBa').resize((size, size), Image.LANCZOS).convert('RGBA')
# 256-color palette with alpha: visually identical for this flat cartoon art, ~6x smaller.
res = res.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
res.save(out, optimize=True)
print('wrote', out, res.size)

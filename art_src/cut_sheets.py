"""Cut rows of stickers out of sheets into full-size sources.

Each sheet is one row of stickers on a transparent background.
  art_src/shop/sheets/ -> art_src/shop/ (Stand Shop pictures)
    supplies_sheet.png  - Big Wagon, Supply Club Card, bottles
    invention_sheet.png - lemon squeezer, Invent It!, Sell It Worldwide
    helpers_sheet.png   - Supply Truck, Stand Captain, Delivery Route
    factory_sheet.png   - Lemonade Factory, More Supermarkets, Canning Line, Flavor Lab
    shipping_sheet.png  - Stores Across the Country, Club Store Pallets, Restaurant
                          Fountains, Factories Around the World
    dreams_sheet.png    - Lemonade Jet, The Lemonade Arena, Citrus Cay (also the ending's island)
  art_src/flavors/sheets/ -> art_src/flavors/ (the Flavor Lab's fruits, named by flavor id)
    fruits_sheet.png    - strawberry, peach, mint, blueberry, watermelon, mango
  art_src/trophies/sheets/ -> art_src/trophies/ (the money trophies, src/data/trophies.ts)
    trophies_sheet.png  - bronze, silver, gold, millionaire, billionaire
  art_src/yard/sheets/ -> art_src/yard/ (the yard things, src/data/yard.ts)
    yard_sheet_a.png    - trampoline, go-kart, bouncy castle
    yard_sheet_b.png    - robot helper, lemon hot-air balloon, puppy, kitten
  art_src/brand/sheets/ -> art_src/brand/ (the brand moves, src/data/brand.ts)
    brand_sheet_a.png   - billboard, radio jingle, TV commercial, ballpark team
    brand_sheet_b.png   - parade float, blimp, big game commercial
  art_src/icons/sheets/ -> art_src/icons/ (small icons beside words, src/pictures.ts)
    seasons_sheet.png   - spring, summer, fall, winter (the season badge)
    alerts_sheet.png    - warning (a supply running low), lock (a button not open yet)
Each sticker is found by its empty columns and cropped to itself, and its inside is made
fully solid (the image tool leaves it at about 99%). Then run build_sticker_art.py to make
the game-size files.

Run from the repo root:
    py -3.11 -I art_src/cut_sheets.py
    py -3.11 -I art_src/build_sticker_art.py
"""
import os

import numpy as np
from PIL import Image

SHOP = os.path.join('art_src', 'shop')
FLAVORS = os.path.join('art_src', 'flavors')
TROPHIES = os.path.join('art_src', 'trophies')
YARD = os.path.join('art_src', 'yard')
BRAND = os.path.join('art_src', 'brand')
ICONS = os.path.join('art_src', 'icons')
# (folder, sheet file, sticker names from left to right). The sheet is in folder/sheets/.
SHEETS = [
    (SHOP, 'supplies_sheet.png', ['big_wagon', 'club_card', 'bottles']),
    (SHOP, 'invention_sheet.png', ['squeezer', 'invent_it', 'worldwide']),
    (SHOP, 'helpers_sheet.png', ['supply_truck', 'stand_captain', 'delivery_route']),
    (SHOP, 'factory_sheet.png', ['lemonade_factory', 'more_supermarkets', 'canning_line', 'flavor_lab']),
    (SHOP, 'shipping_sheet.png', ['stores_across_the_country', 'club_store_pallets', 'restaurant_fountains',
                                  'factories_around_the_world']),
    (SHOP, 'dreams_sheet.png', ['lemonade_jet', 'lemonade_arena', 'citrus_cay']),
    (FLAVORS, 'fruits_sheet.png', ['strawberry', 'peach', 'mint', 'blueberry', 'watermelon', 'mango']),
    (TROPHIES, 'trophies_sheet.png', ['bronze', 'silver', 'gold', 'millionaire', 'billionaire']),
    (YARD, 'yard_sheet_a.png', ['trampoline', 'go_kart', 'bouncy_castle']),
    (YARD, 'yard_sheet_b.png', ['robot', 'balloon', 'puppy', 'kitten']),
    (BRAND, 'brand_sheet_a.png', ['billboard', 'jingle', 'tv', 'team']),
    (BRAND, 'brand_sheet_b.png', ['parade', 'blimp', 'big_game']),
    (ICONS, 'seasons_sheet.png', ['spring', 'summer', 'fall', 'winter']),
    (ICONS, 'alerts_sheet.png', ['warning', 'lock']),
]
SOLID = 16      # alpha above this counts as part of a sticker
OPAQUE = 240    # alpha at or above this is the sticker's inside: made 255


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


def cut(folder, sheet_name, names):
    sheet = Image.open(os.path.join(folder, 'sheets', sheet_name)).convert('RGBA')
    alpha = np.array(sheet)[:, :, 3] > SOLID
    cols = runs(alpha.any(axis=0))
    assert len(cols) == len(names), '%s: expected %d stickers, found %d' % (sheet_name, len(names), len(cols))
    for name, (x0, x1) in zip(names, cols):
        rows = runs(alpha[:, x0:x1].any(axis=1))
        y0, y1 = rows[0][0], rows[-1][1]
        px = np.array(sheet.crop((x0, y0, x1, y1)))
        px[:, :, 3][px[:, :, 3] >= OPAQUE] = 255
        im = Image.fromarray(px, 'RGBA')
        im.save(os.path.join(folder, name + '.png'), optimize=True)
        print('[OK] %s.png %dx%d' % (name, im.size[0], im.size[1]))


def main():
    for folder, sheet_name, names in SHEETS:
        cut(folder, sheet_name, names)


if __name__ == '__main__':
    main()

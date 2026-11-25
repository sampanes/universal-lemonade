# Picture prompts still to make

Each prompt below makes one sticker sheet: a single row of stickers on a transparent
background. Save each image as a PNG with exactly the file name and folder shown. When the
pictures are wired into the game, the sheet goes into the cutter's list
(`art_src/cut_sheets.py`), which finds each sticker by the empty space between them, and
`art_src/build_sticker_art.py` makes the game-size pictures.

Rules for every sheet (the cutter depends on the first two):

- One row, stickers not touching, clear empty space between them.
- Fully transparent background, no ground shadows, no scenery behind them.
- No text, letters or numbers anywhere (the game writes its own labels).
- Same style as the game's other stickers: kawaii, thick dark plum outline, soft cel
  shading, bright cheerful colors, chunky cute proportions.

| Sheet | Save as | What it is for |
| --- | --- | --- |
| 1 | `art_src/trophies/sheets/trophies_sheet.png` | Money trophies on My Shelf |
| 2 | `art_src/yard/sheets/yard_sheet_a.png` | Rich-kid things for the yard |
| 3 | `art_src/yard/sheets/yard_sheet_b.png` | More yard things, and a pet |
| 4 | `art_src/brand/sheets/brand_sheet_a.png` | Optional: Brand tab pictures |
| 5 | `art_src/brand/sheets/brand_sheet_b.png` | Optional: Brand tab pictures |


## 1. trophies_sheet.png (the money trophies)

One trophy lands on My Shelf the first time the kid's total earnings reach $1,000,
$10,000, $100,000, $1,000,000 and $1,000,000,000. Each one is fancier than the last.

```
Kawaii sticker set, 5 trophies in one row on a fully transparent background, no text,
letters or numbers anywhere, thick dark plum outline, soft cel shading, glossy
highlights, bright cheerful colors, chunky cute proportions. Each trophy fancier than
the one before it:

1. A small bronze trophy cup on a little wooden base, a lemon on the front of the cup.
2. A silver trophy cup with two curly handles shaped like lemon leaves, on a wooden base.
3. A tall shiny gold trophy cup on a two-step base, a star on top and a lemon on the front.
4. A big gold trophy shaped like a lemon, wearing a tiny crown, on a pedestal, sparkles
   around it.
5. A giant golden lemon statue covered in sparkling gems, on a marble pedestal, with a
   rainbow shine and stars around it.

Each trophy separated by clear empty space, no ground shadows, no background scenery.
```


## 2. yard_sheet_a.png (rich-kid things for the yard)

Late-game things the kid buys with their own money once the house is paid off. They stand
in the yard beside the house (My House and the day scene) and on My Shelf.

```
Kawaii sticker set, 3 stickers in one row on a fully transparent background, no text or
letters anywhere, thick dark plum outline, soft cel shading, bright cheerful colors,
chunky cute proportions. Each seen from the front and a little above, like a toy
standing on grass:

1. A round backyard trampoline with a safety net, lemon-yellow and white stripes around
   the edge.
2. A cute lemon-yellow go-kart with a racing stripe, chunky black tires and a little
   lemon-shaped steering wheel.
3. A bouncy castle in pink, yellow and mint with four round towers topped with little
   lemon flags.

Each sticker separated by clear empty space, similar size to each other, no ground
shadows, no background scenery.
```


## 3. yard_sheet_b.png (more yard things, and a pet)

The puppy and the kitten can be a "pick one now, the other comes later" choice.

```
Kawaii sticker set, 4 stickers in one row on a fully transparent background, no text or
letters anywhere, thick dark plum outline, soft cel shading, bright cheerful colors,
chunky cute proportions. Each seen from the front:

1. A friendly round robot helper holding a tray with a glass of lemonade, lemon-yellow
   body with a little antenna.
2. A hot-air balloon shaped like a lemon, with a small wicker basket, tied down to the
   ground with a rope.
3. A happy puppy sitting in front of a little wooden doghouse with a lemon painted over
   the door.
4. A happy kitten sitting on top of a small cat tower with a round bed and a dangling
   lemon toy.

Each sticker separated by clear empty space, similar size to each other, no ground
shadows, no background scenery.
```


## 4 and 5. Optional: brand_sheet_a.png and brand_sheet_b.png (the Brand tab)

Only if the Brand tab should show a picture of each brand move (today it shows the lemon
mascot head for all of them).

brand_sheet_a.png:

```
Kawaii sticker set, 4 stickers in one row on a fully transparent background, no text or
letters anywhere, thick dark plum outline, soft cel shading, bright cheerful colors,
chunky cute proportions.

1. A giant billboard on two posts showing a big lemon.
2. A retro radio with musical notes floating out of it.
3. A chunky TV set with a lemon on its screen.
4. A baseball jersey with a lemon on the chest.

Each sticker separated by clear empty space, similar size to each other, no ground
shadows, no background scenery.
```

brand_sheet_b.png:

```
Kawaii sticker set, 3 stickers in one row on a fully transparent background, no text or
letters anywhere, thick dark plum outline, soft cel shading, bright cheerful colors,
chunky cute proportions.

1. A parade float shaped like a giant lemon, with balloons tied to it.
2. A blimp painted like a lemon, with a little leaf on its nose.
3. A big stadium screen showing a lemon, with spotlights and confetti around it.

Each sticker separated by clear empty space, similar size to each other, no ground
shadows, no background scenery.
```

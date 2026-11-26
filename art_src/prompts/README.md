# Picture prompts still to make

No pictures are waiting right now.

Two kinds of picture are made from prompts here: sticker sheets and wallpaper tiles. New
prompts go at the end of this file, one section per image, each with the exact file name and
folder to save it to (make the folder if it is not there yet). Once a picture is in the game,
its prompt comes out of this file.

## How sticker sheets work

Each sticker prompt makes one sticker sheet: a single row of stickers on a transparent
background. Save it as a PNG with exactly the file name and folder its section gives. When
the pictures are wired into the game, the sheet goes into the cutter's list
(`art_src/cut_sheets.py`), which finds each sticker by the empty space between them, and
`art_src/build_sticker_art.py` makes the game-size pictures.

Rules for every sheet (the cutter depends on the first two):

- One row, stickers not touching, clear empty space between them.
- Fully transparent background, no ground shadows, no scenery behind them.
- No text, letters or numbers anywhere (the game writes its own labels).
- Same style as the game's other stickers: kawaii, thick dark plum outline, soft cel
  shading, bright cheerful colors, chunky cute proportions.
- For icons shown small (about 16 pixels tall), say so: a bold, simple shape that reads
  instantly, with only a few big details and no faces.

A sticker prompt starts like this, then lists the stickers left to right:

```
Kawaii sticker set, N stickers in one row on a fully transparent background, no text,
letters or numbers anywhere, thick dark plum outline, soft cel shading, bright cheerful
colors, chunky cute proportions.

1. ...
2. ...

Each sticker separated by clear empty space, similar size to each other, no ground
shadows, no background scenery.
```

## How wallpaper tiles work

A wallpaper is one square picture that the page repeats behind the cards. Save it as a
1024 x 1024 PNG with exactly the file name and folder its section gives (the wallpaper's id
from `src/data/trophies.ts`, in `art_src/wallpapers/`). `art_src/build_wallpaper_art.py`
puts the wallpaper's dark color behind it and fades it, so the cards on top stay easy to
read, and stops if anything touches the edges.

Rules for every tile (the first two keep the repeat seamless):

- Fully transparent background: no color, texture, glow or vignette behind the pattern.
- Nothing touches or crosses an edge of the square. A clear, even margin all around, about
  half the gap between motifs, so the tiles meet with no seam.
- Motifs spread evenly over the whole square, none overlapping, no big empty patches.
- No text, letters or numbers anywhere.
- The sticker style, kept simpler: thick dark plum outline, flat bright colors with light
  cel shading, chunky shapes.

A wallpaper prompt goes like this:

```
Seamless repeating wallpaper tile, square, 1024 x 1024, on a fully transparent background
(no background color, texture, glow or vignette), no text, letters or numbers anywhere.
Kawaii style kept simple: thick dark plum outline, flat bright colors with light cel
shading, chunky shapes. It will be shown over a <dark color> background, so use colors that
stand out on dark.

Pattern: ...

About 12 motifs in all: two or three big, four or five medium, the rest small, turned at
different angles and spread evenly over the whole square, none overlapping, no big empty
patches. Nothing touches or crosses the edges of the square: leave a clear, even margin all
around, about half the gap between motifs, so the square repeats without a seam.
```

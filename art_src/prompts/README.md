# Picture prompts still to make

No sheets are waiting right now. New prompts go at the end of this file, one section per
sheet, each with the exact file name and folder to save it to.

Each prompt makes one sticker sheet: a single row of stickers on a transparent background.
Save each image as a PNG with exactly the file name and folder its section gives. When the
pictures are wired into the game, the sheet goes into the cutter's list
(`art_src/cut_sheets.py`), which finds each sticker by the empty space between them, and
`art_src/build_sticker_art.py` makes the game-size pictures. Once a sheet is in the game,
its prompt comes out of this file.

Rules for every sheet (the cutter depends on the first two):

- One row, stickers not touching, clear empty space between them.
- Fully transparent background, no ground shadows, no scenery behind them.
- No text, letters or numbers anywhere (the game writes its own labels).
- Same style as the game's other stickers: kawaii, thick dark plum outline, soft cel
  shading, bright cheerful colors, chunky cute proportions.

A prompt starts like this, then lists the stickers left to right:

```
Kawaii sticker set, N stickers in one row on a fully transparent background, no text,
letters or numbers anywhere, thick dark plum outline, soft cel shading, bright cheerful
colors, chunky cute proportions.

1. ...
2. ...

Each sticker separated by clear empty space, similar size to each other, no ground
shadows, no background scenery.
```

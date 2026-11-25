# Picture prompts still to make

Two kinds of picture are made from prompts here: sticker sheets and wallpaper tiles. Each
section below is one image, with the exact file name and folder to save it to (make the
folder if it is not there yet). New prompts go at the end of this file. Once a picture is in
the game, its prompt comes out of this file.

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
1024 x 1024 PNG with exactly the file name and folder its section gives. When a tile is
wired in, `art_src/build_wallpaper_art.py` puts the wallpaper's dark color behind it and
fades it, so the cards on top stay easy to read.

Rules for every tile (the first two keep the repeat seamless):

- Fully transparent background: no color, texture, glow or vignette behind the pattern.
- Nothing touches or crosses an edge of the square. A clear, even margin all around, about
  half the gap between motifs, so the tiles meet with no seam.
- Motifs spread evenly over the whole square, none overlapping, no big empty patches.
- No text, letters or numbers anywhere.
- The sticker style, kept simpler: thick dark plum outline, flat bright colors with light
  cel shading, chunky shapes.

## Season stickers (sheet 1 of 2)

Save as `art_src/icons/sheets/seasons_sheet.png`.

These replace the emoji on the season badge (the weather card and the Day Report). They
show about 16 pixels tall, so each one needs a bold, simple shape. The weather card already
has a sun picture for sunny days, so the summer sun wears sunglasses to look different.

```
Kawaii sticker set, 4 stickers in one row on a fully transparent background, no text,
letters or numbers anywhere, thick dark plum outline, soft cel shading, bright cheerful
colors, chunky cute proportions. These are tiny icons shown about 16 pixels tall, so each
one is a bold, simple shape that reads instantly, with only a few big details. Only the
sun has a face.

1. Spring: a pink five-petal cherry blossom flower with a yellow center.
2. Summer: a round golden sun with short chunky rays, wearing dark sunglasses and a big
   grin.
3. Fall: an orange-red maple leaf with a short brown stem.
4. Winter: a pale icy-blue snowflake with six chunky, rounded arms.

Each sticker separated by clear empty space, similar size to each other, no ground
shadows, no background scenery.
```

## Alert stickers (sheet 2 of 2)

Save as `art_src/icons/sheets/alerts_sheet.png`.

These replace the warning emoji next to a supply that is running low, and the padlock emoji
on buttons that are not open yet (a friend's upgrade, a brand move, a store sign-up). They
also show about 16 pixels tall.

```
Kawaii sticker set, 2 stickers in one row on a fully transparent background, no text,
letters or numbers anywhere, thick dark plum outline, soft cel shading, bright cheerful
colors, chunky cute proportions. These are tiny icons shown about 16 pixels tall, so each
one is a bold, simple shape that reads instantly, with only a few big details. No faces.

1. Running low: a rounded yellow-orange warning triangle with a bold dark plum exclamation
   mark in the middle (the exclamation mark is the only mark allowed on the sheet).
2. Locked: a chunky closed golden padlock with a rounded shackle and a small dark keyhole.

Each sticker separated by clear empty space, similar size to each other, no ground
shadows, no background scenery.
```

## Lemons wallpaper

Save as `art_src/wallpapers/lemons.png`. Won with the Gold trophy; the game shows it over
deep plum.

```
Seamless repeating wallpaper tile, square, 1024 x 1024, on a fully transparent background
(no background color, texture, glow or vignette), no text, letters or numbers anywhere.
Kawaii style kept simple: thick dark plum outline, flat bright colors with light cel
shading, chunky shapes. It will be shown over a deep plum background, so use colors that
stand out on dark.

Pattern: whole lemons (a few with tiny happy faces), round lemon slices, small green lemon
leaves and little white lemon blossoms.

About 10 motifs in all: two or three big, four medium, the rest small, turned at different
angles and spread evenly over the whole square, none overlapping, no big empty patches.
Nothing touches or crosses the edges of the square: leave a clear, even margin all around,
about half the gap between motifs, so the square repeats without a seam.
```

## Fruit Party wallpaper

Save as `art_src/wallpapers/fruit.png`. Won with the Millionaire trophy; the game shows it
over dark teal.

```
Seamless repeating wallpaper tile, square, 1024 x 1024, on a fully transparent background
(no background color, texture, glow or vignette), no text, letters or numbers anywhere.
Kawaii style kept simple: thick dark plum outline, flat bright colors with light cel
shading, chunky shapes. It will be shown over a dark teal background, so use colors that
stand out on dark.

Pattern: a fruit party of strawberries, a peach, sprigs of mint, blueberries, watermelon
slices and a mango, a few with tiny happy faces, plus a few small round confetti dots in
pink, yellow and teal.

About 12 motifs in all: two or three big, four or five medium, the rest small, turned at
different angles and spread evenly over the whole square, none overlapping, no big empty
patches. Nothing touches or crosses the edges of the square: leave a clear, even margin all
around, about half the gap between motifs, so the square repeats without a seam.
```

## Gold Stars wallpaper

Save as `art_src/wallpapers/stars.png`. Won with the Billionaire trophy; the game shows it
over midnight blue.

```
Seamless repeating wallpaper tile, square, 1024 x 1024, on a fully transparent background
(no background color, texture, glow or vignette), no text, letters or numbers anywhere.
Kawaii style kept simple: thick dark plum outline, flat bright colors with light cel
shading, chunky shapes. It will be shown over a midnight blue background, so use colors
that stand out on dark.

Pattern: shiny gold five-point stars with rounded points (two or three big ones with tiny
happy faces), smaller plain gold stars, four-point twinkle sparkles in pale yellow and
white, and a few tiny round gold glints.

About 12 motifs in all: two or three big, four or five medium, the rest small, turned at
different angles and spread evenly over the whole square, none overlapping, no big empty
patches. Nothing touches or crosses the edges of the square: leave a clear, even margin all
around, about half the gap between motifs, so the square repeats without a seam.
```

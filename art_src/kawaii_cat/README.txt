incoming_kawaii_cat -- unsorted drop from the Garmin "Little Counter" kid-watch app
=====================================================================================

The site uses web-ready copies of these in public/sprites/kawaii_cat/, made by
tools/prep_kawaii_cat.py.

All PNGs are transparent (RGBA), cut at full sheet size from
sources/2026-11-16_cat-sprite-sheet.png, which was drawn on a flat dark purple (#301046).
That purple was keyed out with a soft edge, so the art sits on any background; it looks
best on dark or pastel ones.

Characters
  cat0.png .. cat4.png   the cat peeking over an edge (paws at the bottom), in order of
                         excitement: calm, smiling, happy (+sparks), squeezed-eyes excited
                         (+sparks), arms up cheering (+sparks)

Counter
  pill.png               empty white rounded counter box, lavender rim (cat removed)
  pill_cat.png           pill with a happy cat holding on top (+sparks)
  pill_cat_wide.png      wider version of the same
  n0.png .. n9.png       digits 0-9, dark purple ink only (made for the white pill;
                         invisible on dark backgrounds). All 68 px tall on the same
                         baseline, so they can be laid side by side.
  nc.png                 the comma, same 68 px row as the digits

Buttons / labels (glossy candy pills)
  step1.png              pink "+1"
  step10.png             blue "+10"
  step100.png            teal "+100"
  step100_dark.png       darker teal "+100" (pressed look)
  step100_glow.png       glowing "+100" with sparks (the glow has a faint dark halo on
                         light backgrounds)

Decorations
  star.png, star_small.png         smiling yellow stars
  sparks_small.png, sparks_big.png "pop" lines (put above something that just happened)
  sparkle_big.png, sparkle_small.png  four-point twinkles
  cloud_big.png, cloud_small.png   soft lilac clouds

sources/
  2026-11-16_cat-sprite-sheet.png  the sheet everything above was cut from
  2026-11-16_cat-ui-sheet-light.png an earlier light-background version (not cut)
  2026-11-16_little-counter-mockup.png the watch-app mockup (reference only)

Recut with (from the my-garmin-watchfaces repo):
  py -3.11 scripts\make_tap_counter_art.py --full <this folder>

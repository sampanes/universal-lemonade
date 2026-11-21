# Universal Lemonade

A lemonade-stand business game for kids. It starts with a driveway stand and, in later
stages, grows into a neighborhood franchise, a bottling business, a patent and a national
beverage company.

Play it here: **https://sampanes.github.io/universal-lemonade/**

## Playing

Each morning the kid looks at the weather, tunes the recipe (lemons, sugar, ice, price), buys
supplies and opens the stand. At the end of the day the Money Bag shows how it went, with a
Day Report of what customers said.

- **The golden recipe.** Every game has one best lemon and sugar mix. Nothing on screen gives
  a score; the customers' comments point the way ("a little more lemon"). Sell it a few days
  in a row and the recipe locks in gold.
- **Stand Shop.** One upgrade at a time: an ice machine (no more running out of ice, and the
  ice buttons go away), then a mini-fridge (no lemon limit or spoilage, 10% more customers), then
  a second stand, which opens the friends' stands, then a Supply Club Card (cheaper
  supplies). The Big Wagon (friends sell more) waits until two friends are hired. Then
  Bottle It! (after 250 cups sold) opens the stores, and a Bottle Labeler makes bottles
  cheaper.
- **Friends' stands.** Timmy (Elm Street), Leo (Ballpark) and Sarah (Pool) can each be hired
  to run a stand with the kid's recipe, price and supplies. Each is paid a flat wage every
  day they work, even a slow one, so a friend can cost money; tapping a friend gives them
  a day off (no sales, no pay). They stay off until tapped again. The Day Report shows each
  friend's cups and pay.
- **Stores.** After Bottle It!, the friends card gets a Stores tab: a Corner Store, a
  Farmers Market and a Ballfield snack bar. Each is signed up once and then buys bottles
  every day (more on hot days), filled from the same lemons and sugar. Save up to expand
  each store's shelf twice and grow its orders. Bottles (glass, cap and label in one price)
  take the ice box's place in Morning Prep, and the morning advice counts what stores need.
- **Invention.** After selling 1,500 bottles, pay $4,000 to patent a lemon squeezer.
  After the first 100 squeezer sales, the $3,000 worldwide license opens on the Invention card.
  Worldwide stores sell about 48 squeezers a day, up from 16, and pay $3.25 per sale,
  up from $2.50. The Lemonade Factory (Stage 5) shows as "coming soon".
- **Chores.** A broke kid can always do chores for a few dollars.
- **The kid.** The stand is run by a paper-doll kid with picked skin, hair, hair color and
  shirt. The mirror changes the look any time. New hair styles and colors unlock as the
  business grows; the fanciest ones take a long time.

The game saves itself in the browser (about once a second) and picks up where it left off.
Reset starts a new game.

## Later stages

Kid mode covers the first four stages for now; Stage 5 is playable in Dad Mode:

1. **Driveway stand** - recipe, weather, supplies, chores, Stand Shop.
2. **Neighborhood franchise** - hire neighborhood kids to run stands at Elm Street, the
   ballpark and the pool; pay their wages and keep them supplied.
3. **Bottling and wholesale** - bottle the recipe and sell to a corner store, a farmers market
   and sports concessions.
4. **Patent** - invent a citrus press and earn royalties on every one sold.
5. **Beverage company** - a co-packer, supermarket chains, big-box stores and beyond.

## Dad Mode

Dad Mode shows the full business panels for the later stages, test controls (game speed,
Auto-Day, the game's seed, and "Jump to..." to skip ahead to the start of a later stage, as
if the stages before it had been played) and a mirror with every look unlocked. Dad Mode
plays its own game and keeps its own look, both saved separately, so testing never changes
the kid's game or look (Reset in Dad Mode only starts Dad's game over).

- Tap the game title three times to switch it on or off, or
- open the page with `?dad=1` (on) or `?dad=0` (off). The choice is remembered.
- `?seed=NUMBER` replays an exact game (it starts that game fresh, over the saved one).

## Running it

Needs Node 22.

```bash
npm install     # dependencies (exact versions, from package-lock.json)
npm run dev     # local dev server
npm run build   # type check + production build into dist/
npm test        # type check + engine, pacing and unlock tests
```

Every push to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Project layout

| Path | What is there |
| --- | --- |
| `index.html` | The whole page: markup, CSS and the UI script |
| `src/engine.ts` | The game engine (no DOM): state, days, buying, upgrades, save and load |
| `src/balance.ts` | Every economy tuning number |
| `src/simulation/` | Weather, demand, recipe taste, reviews, reputation, storage limits |
| `src/data/` | Stand upgrades and business projects, chores, franchise stands, wholesale, trophies |
| `src/character.ts`, `src/kid.ts` | The kid's saved look, and drawing the paper-doll kid |
| `src/unlocks.ts` | Which looks unlock when |
| `sim/` | The balance simulator (bot players) |
| `test/` | Node tests, run on the simulator build |
| `public/` | Game-size sprites and fonts, served as-is |
| `art_src/`, `tools/` | Full-size source art and the Python scripts that make the game-size sprites |
| `docs/` | The early visual design plan (some of it built, some not) |

## Art

Source art lives in `art_src/` and is never served. Python scripts (Pillow and numpy; run from
the repo root) turn it into the small files in `public/sprites/`:

- `art_src/build_kid_art.py` - the paper-doll kid (body, 21 hair styles, faces) and `kid.json`
- `art_src/build_shop_art.py` - Stand Shop pictures
- `art_src/cut_shop_sheet.py` - cuts the wagon, club card and bottles sheet into shop sources
- `art_src/build_frame_art.py` - the stand's ribbon, awning and tablecloth
- `art_src/build_franchise_art.py` - the three friend stands (Elm Street, Ballpark, Pool)
- `art_src/build_store_art.py` - the three bottle stores and the labeler
- `art_src/clean_edges.py` - edge cleanup for small UI sprites
- `tools/prep_kawaii_cat.py` - the cat, counter digits, stars and sparkles
- `tools/make_pitcher_glass.py` - the see-through pitcher glass

Recolorable layers (skin, hair, shirt) are drawn in gray, so the game can tint them.

For the back-facing paper doll system (driveway diorama, wheelchair characters, 3/4 flipshot dynamic, and headwear triage), see [`docs/paper_doll_and_character_system.md`](docs/paper_doll_and_character_system.md).

## Balance simulator

The simulator plays thousands of headless games with bot players across all CPU cores and
reports pacing (the day each stage is reached), money, going broke, chores and reputation as
p10 / median / p90 across games.

```bash
npm run sim                                          # 1,000 games per bot, 60 days
npm run sim -- --games 100000 --bots careful,sloppy  # more games, chosen bots
npm run sim -- --vs buzz.wordOfMouth=0.4             # current vs a changed setting
npm run sim -- --help                                # all options and bot descriptions
```

Games are seeded, so the same seed and the same choices always play out the same way. Bots
live in `sim/bots.ts`; add one to model a new kind of player.

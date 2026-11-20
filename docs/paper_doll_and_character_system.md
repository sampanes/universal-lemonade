# Paper Doll & Modular Character System Reference

> **Purpose:** Comprehensive specification, asset manifest, perspective guidelines, and triage decisions for the modular 2D character paper doll system in *Universal Lemonade*. Future agents and developers should reference this document when assembling, expanding, or animating character sprites.

---

## 1. System Overview: Front View vs. Back-Facing "Flip Shot"

The game utilizes two complementary character perspectives:

1. **Front View (Customer Perspective / Customizer):**
   * **Location:** `public/sprites/kid/` (driven by `src/kid.ts` and `src/character.ts`).
   * **Usage:** Used in the "Create Your Lemonade Hero" customizer and front-facing stand UI.
   * **Pipeline:** Multi-layered canvas (`body_fixed`, `body_shade`, `hair_*_fixed`, `hair_*_shade`, `face_*`) with HSV recoloring for skin tones, hair palettes, and apron colors.

2. **Back-Facing View ("Flip Shot" / Driveway Diorama):**
   * **Location:** `public/sprites/kid_back/` (indexed in `kid_back.json` and `headwear/headwear.json`).
   * **Usage:** Used in the active driveway diorama looking over the kid's shoulder out toward the sidewalk, watching customers and neighbors approach.
   * **Structure:** Modular interchangeable layers: `outfits/`, `hair/`, `props/`, and `headwear/`.

---

## 2. The "Flipshot Dynamic" Explained

The introduction of 3/4-perspective characters (such as kids in wheelchairs) establishes the **Flipshot Dynamic**, which governs camera direction, screen direction, and character orientation:

```
                  [Front Shot / Vendor View]
                     Customer's Perspective
                   (Facing Stand & Kid's Face)
                                ▲
                                │ 180° Camera Axis Flip ("Shot / Reverse-Shot")
                                ▼
                   [Flip Shot / Driveway View]
                      Kid's POV / Over-Shoulder
                 (Looking Out at Road & Neighbors)
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
 [Right-Facing 3/4]                              [Left-Facing 3/4]
  • Approaching from Left / Stand on Right         • Approaching from Right / Stand on Left
  • Active right hand forward                      • Mirrored horizontal flip (scaleX(-1))
```

### Core Rules of the Flipshot:
1. **Camera Reverse-Shot (Front vs. Back):** In cinematographic terms, the "flip shot" is the 180° reverse-angle from the customer looking across the counter to the kid looking out into the world.
2. **Horizontal Orientation (`scaleX(-1)`):**
   * Standing characters from Sheets 1–3 are dead-orthogonal ($0^\circ$ rear view) and have neutral yaw.
   * Wheelchair characters are drawn at a **$3/4$ perspective facing right ($\approx 35^\circ$)**.
   * To face left (e.g., if the lemonade counter or customer approaches from the opposite side), the sprite is horizontally mirrored. Pre-flipped versions (`_right` and `_left`) are provided to prevent texture bleeding or CSS coordinate inversions.
3. **Customer Stream Randomization ("Used Sometimes"):**
   * In `src/scene/customerArt.ts`, pedestrian traffic visits the stand during daytime simulation.
   * A weighted random check ($\approx 10\text{--}15\%$) spawns a customer in a wheelchair rolling across the sidewalk.
4. **Scale Parity Normalization:**
   * Standing figures were drawn 4-across on a 1024×768 sheet (outfit width $\approx 235\text{px}$, head width $\approx 230\text{px}$).
   * Wheelchair figures were drawn 2-across (width $389\text{px}\text{--}433\text{px}$, head width $373\text{px}$), meaning they are at $\approx 1.62\times$ scale.
   * **Rule:** Use the normalized assets (`_norm_right.png`, `_norm_left.png`) scaled by factor $0.617$, which brings head and collar dimensions into exact 1:1 pixel parity with standing bodies and hairstyles.

---

## 3. Ergonomics & Prop Handling

* **Single-Handed "Sandwich/Brick" Grip:**
  * Outfits feature an asymmetrical pose: **Right hand raised/waving**, **Left hand hanging relaxed at the hip**.
  * While horizontal consoles (e.g., Game Boy, DS, Switch) traditionally require two thumbs when playing, idle characters hold them **single-handedly between thumb and fingers like a thick sandwich or brick** in the lowered left hand. This looks authentic and effortless for a kid hanging out by a stand.
* **Ground Props vs. Held Props:**
  * Ground props (`prop_skateboard`, `prop_soccerball`): Placed near the feet on the driveway surface.
  * Vertical/held props (`prop_balloon`, `prop_umbrella`, `prop_baseball_bat`, `prop_bouquet`, `prop_teddy_bear`): Anchored to the lowered left hand.

---

## 4. Headwear & Accessory Triage

Twenty headwear items (`public/sprites/kid_back/headwear/`) were cut and categorized across four functional tiers:

### Tier A: Immediate Back-of-Head Differentiation (Plug & Play)
*These cover or enclose the scalp cleanly, creating instant pedestrian or hero variety:*
* `hat_baseball_snapback.png`: **Top Pick.** Specifically drawn with the rear arch cutout, snapback peg strap, and backward bill.
* `acc_pirate_bandana.png`: Shows the authentic rear tied knot and hanging fabric tails at the nape.
* `acc_cat_paw_headphones.png`: Headband arches over crown; paw-print ear cushions clamp ears from behind.
* `hat_pompom_beanie_ribbed.png` & `hat_beanie_slouchy.png`: Symmetrical beanies that neatly encase the entire top hair volume.

### Tier B: Great Protagonist Accessories (Hero Customization)
*Lightweight flair items that perch over hairstyles or serve as unlocked trophies:*
* `acc_cat_ears_headband.png`: Arched headband with cat ears; fits cleanly over most hairstyles.
* `acc_ribbon_bow_headband.png`: Oversized cute bow headband.
* `acc_flower_wreath.png`: Floral daisy wreath for long hair, curls, or braids.
* `hat_tophat_flower.png`: Formal top hat with flower accent.
* `acc_tiara_coronet.png` & `acc_tiara_ornate.png`: Milestone achievement crowns for high profit/reputation.

### Tier C: Needs Touch-Up to be Paper-Doll Ready
*Valuable designs with minor drawing or masking conflicts:*
* `hat_bucket_safari.png`: Has a chin strap with toggle dangling down the middle. In a rear view, chin straps sit on the front of the throat. **Fix:** Erase or mask out the chin strap cords.
* `hat_ruffled_bonnet.png`: Interior cavity is filled with opaque gray. **Fix:** Punch a transparent hole in the bonnet center so hair sits inside the ruffles.
* `hat_cowboy_star.png`: Has a sheriff star badge in the rear crease (badges belong on the front). **Fix:** Paint out the star.
* `acc_athletic_sweatband.png`: Closed ring that looks like a floating halo unless hair strands are layered in front and behind.
* `hat_sombrero.png`: Extremely wide ($337\text{px}$) with an angled brim; requires downscaling and a neck collar cutoff.

### Tier D: Discard Candidates (Perspective Mismatches)
*Do not use for back-facing characters:*
* `acc_sunglasses.png`: Front-facing sunglasses with lenses and nose bridge facing the viewer.
* `hat_baseball_cap_front.png`: Downward curved front bill; redundant with the snapback.
* `hat_aviator_goggles.png`: Front-facing glass lenses look like eyes on the back of the head.

---

## 5. Hair & Outfit Modular Compatibility Critique

When mixing and matching hairstyles and outfits in the paper doll system, keep these collision and anatomical constraints in mind:

| Asset | Issue / Clash | Mitigation |
| :--- | :--- | :--- |
| `hair_long_braid.png` | $280\text{px}$ long braid hangs straight down the spine. Collides with hoods (`outfit_hoodie`, `outfit_raincoat`) and collides with the giant back sash bow on `outfit_frilly_dress`. | Reserve for flat-collar shirts (`varsity`, `polo`, `tshirt`) or split into an under-hood mask layer. |
| `hair_classic_bob.png` | Rigid inward bell curve ($264\text{px}$ wide) clips directly into raised collars and hoods. | Use with collarless tops or scale slightly outward. |
| `hair_double_buns.png` | Two dangling neck ringlets cross over high collar seams awkwardly. | Mask tendrils behind thick coats. |
| **Ear Inconsistency** | Sheet 1 hair (`sidepart`, `spiky`, `flared_wings`) has ears baked in; Sheets 2 & 3 have **no ears**. | Standardize ears to either a dedicated head base layer or trim ears off Sheet 1 hair. |
| `outfit_hoodie.png` & `outfit_raincoat.png` | Puffy hoods resting on the upper back block any medium/long hair. | Best paired with short hair (`spiky`, `sidepart`, `curly_mop`, `snapback`). |
| `outfit_frilly_dress.png` | Large tied sash bow at waist prevents low-hanging props or braids. | Pair with up-dos, short bobs, or headbands. |
| `outfit_argyle_vest.png` | Asymmetric peaked white shirt collar on child's left neck ($y=0, x=9..41$). | Align hair center to collar center rather than bounding box center. |

---

## 6. Directory Index

* `art_src/headwear/`: Raw full-sheet PNGs (`headwear_sheet_1.png`, `headwear_sheet_2.png`).
* `public/sprites/kid_back/`:
  * `hair/`: 9 standing hairstyles + 4 wheelchair $3/4$ hairstyles (native & normalized, left & right).
  * `outfits/`: 12 standing outfits + 4 wheelchair outfits (native & normalized, left & right).
  * `props/`: 9 hand-held and ground accessories.
  * `headwear/`: 20 individual cut headwear pieces + `headwear.json`.
  * `full_characters/`: Pre-assembled full wheelchair characters (`hoodie` and `dress`, left & right).
  * `kid_back.json`: Metadata manifest for programmatic loading and registration.

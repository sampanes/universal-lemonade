# Universal Lemonade

An entrepreneurial business simulation game modeling the realistic (though best-case) growth of an ambitious kid's lemonade business—from driveway hustle to national beverage empire.

Live playable demo: **https://sampanes.github.io/universal-lemonade/**

## Business Scaling Stages

1. **Stage 1: Driveway Hustle (Solo Operator)**
   - Solo operations: buy supplies (lemons, sugar, ice, cups), monitor weather forecasts, and tune the signature recipe.
   - Emergency seed capital: do neighborhood chores ($5–$25) when low on working capital.
   - Invest in an insulated cooler and garage mini-fridge to eliminate overnight spoilage.

2. **Stage 2: Neighborhood Franchise (Labor & Delegation)**
   - Expand beyond your street by hiring neighborhood kids:
     - **Timmy** on Elm Street (steady residential traffic).
     - **Leo** at Little League Park (crushes weekend tournaments).
     - **Sarah** at the Community Pool (huge volume on hot days).
   - Manage central supply logistics and daily payroll wages.
   - Unlock a Costco Business Membership for 35% bulk supply discounts.

3. **Stage 3: Bottling & Wholesale (Packaging & Local Retail)**
   - Bottle your recipe in sealed glass bottles.
   - Sign wholesale accounts: Corner Bodega, Saturday Farmers Market, and Youth Sports Concessions.
   - Balance wholesale margins ($2.00–$3.50/bottle) against bottle packaging and label costs.

4. **Stage 4: Invention & Patent Licensing (Passive Income)**
   - Invent the "Vortex Citrus Press"—an ergonomic high-yield juicer.
   - File a USPTO patent and sign a nationwide licensing agreement with an appliance brand.
   - Earn passive royalties ($2.50/unit) on every juicer sold nationwide.

5. **Stage 5: Industrial Beverage Empire**
   - Contract with a commercial beverage co-packer.
   - Distribute cases to regional supermarket chains, national big-box stores, and warehouse club pallets.
   - Scale into a global enterprise to buy personal trophies and retire on Citrus Cay.

## Design & GUI Architecture

- See the **[Kid-Centric GUI Masterplan & Asset Manifest](docs/kid_gui_design_manifest.md)** for our visual design specifications, Pop Comic art direction, prompt recipes for frontier image generation, mascot perks, and zero-asset Web Audio synthesis architecture.

## Quickstart

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Build for production
npm run build

# Engine and pacing checks
npm test
```

## Balance Simulator

Every economy tuning number lives in `src/balance.ts`. The simulator plays thousands of
headless games with bot players across all CPU cores and reports pacing (day each stage is
reached), money, going broke, chores and reputation as p10 / median / p90 across games.

```bash
npm run sim                                          # 1,000 games per bot, 60 days
npm run sim -- --games 100000 --bots careful,sloppy  # more games, chosen bots
npm run sim -- --vs buzz.wordOfMouth=0.4    # current vs a changed setting
npm run sim -- --help                                # all options and bot descriptions
```

Games are seeded, so the same seed and the same choices always play out the same way.
Bots live in `sim/bots.ts`; add one to model a new kind of player.

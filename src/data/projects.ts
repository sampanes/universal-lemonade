// src/data/projects.ts -- Business Investments & Technology Upgrades (Phases 1-5)
import type { ProjectDef, GameState } from '../types';
import { BOTTLES_FOR_INVENTION, BOTTLES_FOR_LABELER } from './wholesale';

// The lemon squeezer's four steps (Stage 4). Level 1 comes with the patent; each later step
// is a project bought on the Invention card once enough squeezers have sold in all (counted
// across saves in state.totalSqueezersSold). Each step sells four times as many a day, so
// royalties grow from about $125 a day to about $10,000 a day.
export interface SqueezerLevel {
  level: number;
  name: string;            // where it sells, for the kid ("Hometown")
  project: string | null;  // the project that buys this step (null: the patent itself)
  cost: number;
  salesRequired: number;   // lifetime squeezers sold before the step can be bought
  unitsPerDay: number;
  royaltyPerUnit: number;
}
export const SQUEEZER_LEVELS: readonly SqueezerLevel[] = [
  { level: 1, name: 'Hometown', project: null, cost: 0, salesRequired: 0, unitsPerDay: 50, royaltyPerUnit: 2.5 },
  { level: 2, name: 'On TV', project: 'squeezer_tv', cost: 3000, salesRequired: 300, unitsPerDay: 200, royaltyPerUnit: 2.5 },
  { level: 3, name: 'Every State', project: 'squeezer_states', cost: 12000, salesRequired: 2000, unitsPerDay: 800, royaltyPerUnit: 2.75 },
  { level: 4, name: 'Worldwide', project: 'global_licensing', cost: 40000, salesRequired: 8000, unitsPerDay: 3200, royaltyPerUnit: 3.25 },
];
// Set the squeezer to a step (never down a step).
export function applySqueezerLevel(patent: { level: number; baseUnitsPerDay: number; royaltyPerUnit: number }, level: number): void {
  const step = SQUEEZER_LEVELS[Math.max(1, Math.min(SQUEEZER_LEVELS.length, Math.max(level, patent.level))) - 1];
  patent.level = step.level;
  patent.baseUnitsPerDay = step.unitsPerDay;
  patent.royaltyPerUnit = step.royaltyPerUnit;
}
function squeezerStep(level: number): ProjectDef {
  const step = SQUEEZER_LEVELS[level - 1];
  return {
    id: step.project as string,
    name: `Lemon Squeezer: ${step.name}`,
    desc: `Sell about ${step.unitsPerDay.toLocaleString('en-US')} squeezers a day at $${step.royaltyPerUnit.toFixed(2)} each.`,
    phase: 4,
    costCash: step.cost,
    purchased: false,
    unlocked: (s: GameState) => s.phase >= 4 && s.totalSqueezersSold >= step.salesRequired,
    effect: (e: any) => {
      applySqueezerLevel(e.patent, step.level);
      e.log(`Lemon squeezer: ${step.name}! About ${step.unitsPerDay.toLocaleString('en-US')} sold a day now.`);
    }
  };
}

// The two Phase 1 stand upgrades are the kid's first choice: the Stand Shop shows both from
// Day 3, the kid picks which one to get first, and the other one comes next. They cost the
// same, so the pick is about what each does: the ice machine saves money and never runs out
// of ice, the mini-fridge brings more customers and keeps lemons fresh. (Played by the bots,
// either pick reaches Stage 2 on about the same day.) Each also lifts a storage limit
// (src/simulation/storage.ts): a busy summer day needs more ice than the 400-cube bucket
// holds, and a second stand more lemons than the 24-lemon bowl. There is no cooler step any
// more (the ice machine made it useless a few days later); the kid gets by with the bucket
// and runs short of ice a couple of times first. (The engine still knows hasCooler, so it
// can come back.) The kid shop only spends money left over after today's supplies
// (engine.restockCostForToday), so buying one never leaves the stand without lemons.
export const FIRST_CHOICE = ['auto_ice_dispenser', 'fridge'] as const;
const FIRST_CHOICE_COST = 400;

// The helpers' prices. Stage 4 opens with about $2,000 to $4,000 a day coming in, so the
// truck is about a day's money and the captain two or three; the route comes in Stage 5,
// after the first supermarkets (about $15,000 a day).
const SUPPLY_TRUCK_COST = 2000;
const STAND_CAPTAIN_COST = 6000;
const DELIVERY_ROUTE_COST = 25000;

export function createInitialProjects(): ProjectDef[] {
  return [
    {
      id: 'auto_ice_dispenser',
      name: 'Digital Weather-Synced Ice Dispenser',
      desc: 'Makes all the ice the day needs for free, with no storage limit, and dials in ideal ice per cup (Auto toggle).',
      phase: 1,
      costCash: FIRST_CHOICE_COST,
      purchased: false,
      unlocked: (s: GameState) => s.phase >= 1 && s.day >= 3,
      effect: (e: any) => {
        e.state.flags.hasAutoIce = true;
        e.state.flags.autoIceEnabled = true;
        e.state.recipe.icePerCup = e.computeIdealIce(e.state.tempF);
        e.log('Project: Digital Ice Dispenser installed! Automatically calibrates ice to the daily weather forecast.');
      }
    },
    {
      id: 'fridge',
      name: 'Garage Mini-Fridge',
      desc: 'Unlimited lemons, no spoilage, and 10% more customers.',
      phase: 1,
      costCash: FIRST_CHOICE_COST,
      purchased: false,
      unlocked: (s: GameState) => s.phase >= 1 && s.day >= 3,
      effect: (e: any) => {
        e.state.flags.hasMiniFridge = true;
        e.log('Upgrade: Mini-fridge online! Lemons stay crisp and fresh.');
      }
    },
    {
      id: 'franchise_license',
      name: 'Neighborhood Expansion (Phase 2)',
      desc: 'Print flyers, buy folding tables, and start hiring neighborhood kids to run stands!',
      phase: 1,
      costCash: 150,
      purchased: false,
      unlocked: (s: GameState) => s.phase === 1 && s.cash.gte(100) && (s.bestRecipeQuality >= 0.80 || (s.avgRecipeQuality || 0) >= 0.75),
      effect: (e: any) => {
        e.state.phase = 2;
        e.log('PHASE 2 UNLOCKED: You are now a manager! Hire neighborhood kids in the Franchise tab.');
      }
    },
    {
      id: 'costco_card',
      name: 'Costco Business Card',
      desc: 'Wholesale restaurant supply pricing: cuts all grocery supply costs by 35%!',
      phase: 2,
      costCash: 60,
      purchased: false,
      unlocked: (s: GameState) => s.phase >= 2,
      effect: (e: any) => {
        e.state.flags.hasCostcoDiscount = true;
        e.log('Project: Costco Business Card unlocked! 35% discount on all ingredients.');
      }
    },
    {
      id: 'cargo_wagon',
      name: 'Heavy-Duty Radio Flyer Cargo Wagon',
      desc: 'Streamlines supply distribution: boosts all franchise stands capacity by +25%!',
      phase: 2,
      costCash: 75,
      purchased: false,
      unlocked: (s: GameState) => s.phase >= 2,
      effect: (e: any) => {
        e.state.flags.hasCargoWagon = true;
        Object.values(e.franchiseStands as Record<string, any>).forEach((st: any) => {
          st.baseCapacity = Math.round(st.baseCapacity * 1.25);
        });
        e.log('Project: Cargo Wagon in service! Franchise capacity expanded.');
      }
    },
    {
      id: 'bottling_rig',
      name: 'Commercial Countertop Bottling Rig (Phase 3)',
      desc: 'Hand-capper, food-grade glass bottles, and labels. Sell wholesale to local stores!',
      phase: 2,
      costCash: 450,
      purchased: false,
      unlocked: (s: GameState) => s.phase === 2 && s.cash.gte(300) && s.totalCupsSold.gte(250),
      effect: (e: any) => {
        e.state.phase = 3;
        e.log('PHASE 3 UNLOCKED: Bottling operations online! Sign wholesale accounts in the Wholesale tab.');
      }
    },
    {
      id: 'commercial_labeler',
      name: 'Semi-Automatic Bottle Labeler',
      desc: 'Labels bottles by machine: bottles cost 30% less.',
      phase: 3,
      costCash: 250,
      purchased: false,
      unlocked: (s: GameState) => s.phase >= 3 && s.totalBottlesSold >= BOTTLES_FOR_LABELER,
      effect: (e: any) => {
        e.state.flags.hasCommercialLabeler = true;   // supplyPack('bottles') reads it
        e.log('Project: Semi-Auto Labeler running! Bottles cost less.');
      }
    },
    {
      id: 'patent_filing',
      name: 'USPTO Patent for "Vortex Press" (Phase 4)',
      desc: 'Invent an ergonomic high-yield citrus press. License it to an appliance company for passive royalties!',
      phase: 3,
      costCash: 4000,
      purchased: false,
      unlocked: (s: GameState) => s.phase === 3 && s.totalBottlesSold >= BOTTLES_FOR_INVENTION,
      effect: (e: any) => {
        e.state.phase = 4;
        e.patent.licensed = true;
        applySqueezerLevel(e.patent, 1);
        e.log('PHASE 4 UNLOCKED: Patent granted! You now earn passive royalties on every juicer sold nationwide.');
      }
    },
    squeezerStep(2),
    squeezerStep(3),
    squeezerStep(4),
    // Helpers (engine.runHelpers). By Stage 4 the stands and stores earn pocket change next to
    // the squeezer, so the kid can hand their daily jobs to helpers, one at a time.
    {
      id: 'supply_truck',
      name: 'Supply Truck',
      desc: 'Buys the lemons, sugar, cups and bottles each morning for what the forecast needs.',
      phase: 4,
      costCash: SUPPLY_TRUCK_COST,
      purchased: false,
      unlocked: (s: GameState) => s.phase >= 4,
      effect: (e: any) => {
        e.state.flags.hasSupplyTruck = true;
        e.runHelpers();
        e.log('Helper: the Supply Truck brings the supplies every morning now.');
      }
    },
    {
      id: 'stand_captain',
      name: 'Stand Captain',
      desc: 'Runs the stands: picks the price, who works each day, and hires the friends.',
      phase: 4,
      costCash: STAND_CAPTAIN_COST,
      purchased: false,
      unlocked: (s: GameState) => s.phase >= 4,
      effect: (e: any) => {
        e.state.flags.hasStandCaptain = true;
        e.runHelpers();
        e.log('Helper: the Stand Captain runs the lemonade stands now.');
      }
    },
    {
      id: 'copacker_deal',
      name: 'Industrial Co-Packer Agreement (Phase 5)',
      desc: 'Contract a regional beverage bottling plant. Place cases on supermarket shelves across the state!',
      phase: 4,
      costCash: 6000,
      purchased: false,
      unlocked: (s: GameState) => s.phase >= 4 && s.cash.gte(4000),
      effect: (e: any) => {
        e.state.phase = 5;
        e.copacker.active = true;
        e.log('PHASE 5 UNLOCKED: Beverage Empire achieved! Commercial co-packing and supermarket distribution active.');
      }
    },
    {
      id: 'regional_supermarkets',
      name: 'Regional Supermarket Distribution',
      desc: 'Partner with regional grocery chains (Whole Foods, Sprouted Markets) across 3 states. Co-packer volume scales to 300 cases/day!',
      phase: 5,
      costCash: 18000,
      purchased: false,
      unlocked: (s: GameState) => s.phase === 5 && s.cash.gte(10000),
      effect: (e: any) => {
        e.copacker.casesPerDay = 300;
        e.log('Project: Regional Supermarket Distribution active! Shipping 300 cases/day across 3 states.');
      }
    },
    {
      id: 'delivery_route',
      name: 'Delivery Route',
      desc: 'Runs the stores: signs up every store and grows their shelves.',
      phase: 5,
      costCash: DELIVERY_ROUTE_COST,
      purchased: false,
      unlocked: (s: GameState) => s.phase >= 5,
      effect: (e: any) => {
        e.state.flags.hasDeliveryRoute = true;
        e.runHelpers();
        e.log('Helper: the Delivery Route runs the stores now.');
      }
    },
    {
      id: 'automated_canning_line',
      name: 'High-Speed Rotary Canning Line',
      desc: 'Install automated rotary filler & pasteurization tunnel at the co-packer facility. Capacity scales to 1,500 cases/day at $22/case margin!',
      phase: 5,
      costCash: 85000,
      purchased: false,
      unlocked: (s: GameState) => s.phase === 5 && s.cash.gte(50000),
      effect: (e: any) => {
        e.copacker.casesPerDay = 1500;
        e.copacker.netPerCase = 22.00;
        e.log('Project: High-Speed Rotary Canning Line online! 1,500 cases/day at $22/case net margin.');
      }
    },
    // The Flavor Lab: see src/data/flavors.ts.
    {
      id: 'flavor_lab',
      name: 'Flavor Lab',
      desc: 'Invent new flavors: each one made just right adds 20% more factory cases.',
      phase: 5,
      costCash: 150000,
      purchased: false,
      unlocked: (s: GameState) => s.phase >= 5,
      effect: (e: any) => {
        e.state.flags.hasFlavorLab = true;
        e.log('Project: the Flavor Lab is open! The taste testers try a new flavor every day.');
      }
    },
    {
      id: 'national_bigbox',
      name: 'National Big-Box Retail Rollout (Target & Walmart)',
      desc: 'Premium endcap displays in 2,500 retail stores nationwide. Co-packer volume scales to 6,000 cases/day!',
      phase: 5,
      costCash: 350000,
      purchased: false,
      unlocked: (s: GameState) => s.phase === 5 && s.cash.gte(200000),
      effect: (e: any) => {
        e.copacker.casesPerDay = 6000;   // and the Brand tab opens (src/data/brand.ts)
        e.log('Project: National Big-Box contract finalized! Shipping 6,000 cases/day across America.');
      }
    },
    {
      id: 'club_store_pallets',
      name: 'Costco & Sam\'s Club Wholesale Pallet Program',
      desc: 'Full pallets of 24-can variety club packs in wholesale warehouses nationwide. Volume expands to 25,000 cases/day!',
      phase: 5,
      costCash: 1800000,
      purchased: false,
      unlocked: (s: GameState) => s.phase === 5 && s.cash.gte(1000000),
      effect: (e: any) => {
        e.copacker.casesPerDay = 25000;
        e.log('Project: Club Store Pallet Program active! 25,000 cases/day flowing through warehouse clubs.');
      }
    },
    {
      id: 'qsr_fountain_licensing',
      name: 'Global Fast-Casual Restaurant Fountain Licensing',
      desc: 'Craft lemonade dispensers in 10,000 fast-casual restaurants worldwide. Volume expands to 100,000 cases/day!',
      phase: 5,
      costCash: 8500000,
      purchased: false,
      unlocked: (s: GameState) => s.phase === 5 && s.cash.gte(5000000),
      effect: (e: any) => {
        e.copacker.casesPerDay = 100000;
        e.log('Project: Fast-casual soda fountain contract live! 100,000 cases/day globally.');
      }
    },
    {
      id: 'global_beverage_jv',
      name: 'International Beverage Conglomerate Joint Venture',
      desc: 'Partner with global bottling plants in Europe, Asia, and Latin America. Production hits 350,000 cases/day!',
      phase: 5,
      costCash: 35000000,
      purchased: false,
      unlocked: (s: GameState) => s.phase === 5 && s.cash.gte(20000000),
      effect: (e: any) => {
        e.copacker.casesPerDay = 350000;
        e.log('Project: International Joint Venture operational! World-wide distribution of 350,000 cases/day.');
      }
    }
  ];
}

// src/data/projects.ts -- everything the Stand Shop sells, Stages 1-5: the stand upgrades, the
// steps that open each stage, the helpers, the factory steps and the big dreams. The shop's
// order, pictures and pacing are in src/ui/kidShop.js; engine.buyProject buys one.
import type { ProjectDef, GameState } from '../types';
import { BOTTLES_FOR_INVENTION, BOTTLES_FOR_LABELER } from './wholesale';

// The lemon squeezer's four steps (Stage 4). Level 1 comes with the patent; each later step
// is a project bought on the Invention card once enough squeezers have sold in all
// (state.totalSqueezersSold). Each step sells four times as many a day, so royalties grow
// from about $125 a day to about $10,000 a day.
interface SqueezerLevel {
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
function applySqueezerLevel(patent: { level: number; baseUnitsPerDay: number; royaltyPerUnit: number }, level: number): void {
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
    effect: (e: any) => applySqueezerLevel(e.patent, step.level),
  };
}

// The two Stage 1 stand upgrades are the kid's first choice: the Stand Shop shows both from
// Day 3, the kid picks which one to get first, and the other one comes next. They cost the
// same, so the pick is about what each does: the ice machine saves money and never runs out
// of ice, the mini-fridge brings more customers and keeps lemons fresh. (Played by the bots,
// either pick reaches Stage 2 on about the same day.) Each also lifts a storage limit
// (src/simulation/storage.ts): a busy summer day needs more ice than the 400-cube bucket
// holds, and a second stand more lemons than the 24-lemon bowl. The kid shop only spends
// money left over after today's supplies (engine.restockCostForToday), so buying one never
// leaves the stand without lemons.
export const FIRST_CHOICE = ['auto_ice_dispenser', 'fridge'] as const;
const FIRST_CHOICE_COST = 400;

// The helpers' prices. Stage 4 opens with about $2,000 to $4,000 a day coming in, so the
// truck is about a day's money and the captain two or three; the route comes in Stage 5,
// after the first supermarkets (about $15,000 a day).
const SUPPLY_TRUCK_COST = 2000;
const STAND_CAPTAIN_COST = 6000;
const DELIVERY_ROUTE_COST = 25000;

// Citrus Cay, the ending. The careful bot (npm run sim -- --bots careful --days 220) buys it
// about 12 days after the last factory step, around day 139.
const ISLAND_COST = 1000000000;

const stage = (n: number) => (s: GameState) => s.phase >= n;

export function createInitialProjects(): ProjectDef[] {
  return [
    {
      id: 'auto_ice_dispenser',
      name: 'Ice Machine',
      desc: 'Makes all the ice you need, free, and picks the right amount.',
      phase: 1,
      costCash: FIRST_CHOICE_COST,
      purchased: false,
      unlocked: (s: GameState) => s.day >= 3,
      effect: (e: any) => {
        e.state.flags.hasAutoIce = true;
        e.state.flags.autoIceEnabled = true;
        e.state.recipe.icePerCup = e.computeIdealIce(e.state.tempF);
      }
    },
    {
      id: 'fridge',
      name: 'Mini-Fridge',
      desc: 'Unlimited lemons, no spoilage, +10% customers!',
      phase: 1,
      costCash: FIRST_CHOICE_COST,
      purchased: false,
      unlocked: (s: GameState) => s.day >= 3,
      effect: (e: any) => { e.state.flags.hasMiniFridge = true; }
    },
    {
      id: 'franchise_license',
      name: 'A Second Stand',
      desc: 'Friends can run stands around town for you!',
      phase: 1,
      costCash: 150,
      purchased: false,
      // A tasty recipe first: friends sell the kid's recipe.
      unlocked: (s: GameState) => s.phase === 1 && (s.bestRecipeQuality >= 0.80 || (s.avgRecipeQuality || 0) >= 0.75),
      effect: (e: any) => { e.state.phase = 2; }
    },
    {
      id: 'club_card',
      name: 'Supply Club Card',
      desc: 'Lemons, sugar and cups cost a lot less!',
      phase: 2,
      costCash: 60,
      purchased: false,
      unlocked: stage(2),
      effect: (e: any) => { e.state.flags.hasClubCard = true; }
    },
    {
      id: 'cargo_wagon',
      name: 'Big Wagon',
      desc: "Haul more to your friends' stands: they each sell more!",
      phase: 2,
      costCash: 75,
      purchased: false,
      unlocked: stage(2),
      effect: (e: any) => {
        Object.values(e.franchiseStands as Record<string, any>).forEach((st: any) => {
          st.baseCapacity = Math.round(st.baseCapacity * 1.25);
        });
      }
    },
    {
      id: 'bottling_rig',
      name: 'Bottle It!',
      desc: 'Bottle your lemonade and sell it to stores!',
      phase: 2,
      costCash: 450,
      purchased: false,
      unlocked: (s: GameState) => s.phase === 2 && s.totalCupsSold.gte(250),
      effect: (e: any) => { e.state.phase = 3; }
    },
    {
      id: 'commercial_labeler',
      name: 'Bottle Labeler',
      desc: 'Labels bottles by machine: bottles cost 30% less!',
      phase: 3,
      costCash: 250,
      purchased: false,
      unlocked: (s: GameState) => s.phase >= 3 && s.totalBottlesSold >= BOTTLES_FOR_LABELER,
      effect: (e: any) => { e.state.flags.hasCommercialLabeler = true; }   // supplyPack('bottles') reads it
    },
    {
      id: 'patent_filing',
      name: 'Invent It!',
      desc: 'Invent a lemon squeezer! Stores sell it, and you get money for every one.',
      phase: 3,
      costCash: 4000,
      purchased: false,
      unlocked: (s: GameState) => s.phase === 3 && s.totalBottlesSold >= BOTTLES_FOR_INVENTION,
      effect: (e: any) => {
        e.state.phase = 4;
        e.patent.licensed = true;
        applySqueezerLevel(e.patent, 1);
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
      desc: 'Brings the lemons, sugar, cups and bottles every morning. No more buying!',
      phase: 4,
      costCash: SUPPLY_TRUCK_COST,
      purchased: false,
      unlocked: stage(4),
      effect: (e: any) => {
        e.state.flags.hasSupplyTruck = true;
        e.runHelpers();
      }
    },
    {
      id: 'stand_captain',
      name: 'Stand Captain',
      desc: 'Runs your stands: picks the price and who works each day!',
      phase: 4,
      costCash: STAND_CAPTAIN_COST,
      purchased: false,
      unlocked: stage(4),
      effect: (e: any) => {
        e.state.flags.hasStandCaptain = true;
        e.runHelpers();
      }
    },
    {
      id: 'copacker_deal',
      name: 'Lemonade Factory',
      desc: 'A factory makes your lemonade for stores, with its own supplies!',
      phase: 4,
      costCash: 6000,
      purchased: false,
      unlocked: stage(4),
      effect: (e: any) => {
        e.state.phase = 5;
        e.copacker.active = true;
      }
    },
    {
      id: 'regional_supermarkets',
      name: 'More Supermarkets',
      desc: 'Send about 300 cases a day to supermarkets!',
      phase: 5,
      costCash: 18000,
      purchased: false,
      unlocked: stage(5),
      effect: (e: any) => { e.copacker.casesPerDay = 300; }
    },
    {
      id: 'delivery_route',
      name: 'Delivery Route',
      desc: 'Runs your stores: signs them up and grows their shelves!',
      phase: 5,
      costCash: DELIVERY_ROUTE_COST,
      purchased: false,
      unlocked: stage(5),
      effect: (e: any) => {
        e.state.flags.hasDeliveryRoute = true;
        e.runHelpers();
      }
    },
    {
      id: 'automated_canning_line',
      name: 'Canning Line',
      desc: 'Make about 1,500 cases a day and earn more per case!',
      phase: 5,
      costCash: 85000,
      purchased: false,
      unlocked: stage(5),
      effect: (e: any) => {
        e.copacker.casesPerDay = 1500;
        e.copacker.netPerCase = 22.00;
      }
    },
    // The Flavor Lab: see src/data/flavors.ts.
    {
      id: 'flavor_lab',
      name: 'Flavor Lab',
      desc: 'Invent new flavors! Each one you get just right sells in stores.',
      phase: 5,
      costCash: 150000,
      purchased: false,
      unlocked: stage(5),
      effect: (e: any) => { e.state.flags.hasFlavorLab = true; }
    },
    {
      id: 'national_bigbox',
      name: 'Stores Across the Country',
      desc: 'Send about 6,000 cases a day across the country!',
      phase: 5,
      costCash: 350000,
      purchased: false,
      unlocked: stage(5),
      effect: (e: any) => { e.copacker.casesPerDay = 6000; }   // and the Brand tab opens (src/data/brand.ts)
    },
    {
      id: 'club_store_pallets',
      name: 'Club Store Pallets',
      desc: 'Ship about 25,000 cases a day to club stores!',
      phase: 5,
      costCash: 1800000,
      purchased: false,
      unlocked: stage(5),
      effect: (e: any) => { e.copacker.casesPerDay = 25000; }
    },
    {
      id: 'qsr_fountain_licensing',
      name: 'Restaurant Fountains',
      desc: 'Serve your lemonade in restaurants around the world!',
      phase: 5,
      costCash: 8500000,
      purchased: false,
      unlocked: stage(5),
      effect: (e: any) => { e.copacker.casesPerDay = 100000; }
    },
    {
      id: 'global_beverage_jv',
      name: 'Factories Around the World',
      desc: 'Make your lemonade around the world!',
      phase: 5,
      costCash: 35000000,
      purchased: false,
      unlocked: stage(5),
      effect: (e: any) => { e.copacker.casesPerDay = 350000; }
    },
    // The big dreams, after the last factory step. The last one is the ending.
    {
      id: 'private_jet',
      name: 'Lemonade Jet',
      desc: 'Fly around the world! Your squeezers sell twice as much.',
      phase: 5,
      costCash: 65000000,
      purchased: false,
      unlocked: stage(5),
      effect: (e: any) => { e.state.flags.hasPrivateJet = true; }
    },
    {
      id: 'arena_naming',
      name: 'The Lemonade Arena',
      desc: 'A giant arena with your name on it! The factory sells twice as much.',
      phase: 5,
      costCash: 80000000,
      purchased: false,
      unlocked: stage(5),
      effect: (e: any) => { e.state.flags.hasArenaNaming = true; }
    },
    {
      id: 'private_island',
      name: 'Citrus Cay',
      desc: 'Your very own lemonade island! The biggest dream of all.',
      phase: 5,
      costCash: ISLAND_COST,
      purchased: false,
      unlocked: stage(5),
      effect: (e: any) => { e.state.gameWon = true; }   // main.js plays the ending once
    }
  ];
}

// src/data/projects.ts -- Business Investments & Technology Upgrades (Phases 1-5)
import type { ProjectDef, GameState } from '../types';
import { BOTTLES_FOR_INVENTION } from './wholesale';

// The two Phase 1 stand upgrades, $275 and $605, each lift a storage limit
// (src/simulation/storage.ts): a busy summer day needs more ice than the 400-cube bucket
// holds, and a second stand more lemons than the 48-lemon bowl. There is no cooler step any
// more (the ice machine made it useless a few days later); the kid gets by with the bucket
// and runs short of ice a couple of times first. (The engine still knows hasCooler, so it
// can come back.) The kid shop only spends money left over after today's supplies
// (engine.restockCostForToday), so buying one never leaves the stand without lemons.
// Sim, 40 days: a careful player buys them around Day 10 and 24, after 2 or 3 days short of
// ice; a perfect player around Day 7 and 10.
export function createInitialProjects(): ProjectDef[] {
  return [
    {
      id: 'auto_ice_dispenser',
      name: 'Digital Weather-Synced Ice Dispenser',
      desc: 'Makes all the ice the day needs for free, with no storage limit, and dials in ideal ice per cup (Auto toggle).',
      phase: 1,
      costCash: 275,
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
      desc: 'No lemon storage limit (was 48), no overnight spoilage, +10% Reputation.',
      phase: 1,
      costCash: 605,
      purchased: false,
      unlocked: (s: GameState) => s.phase >= 1 && s.day >= 3,
      effect: (e: any) => {
        e.state.flags.hasMiniFridge = true;
        e.state.reputation = Math.min(e.balance.reputation.max, e.state.reputation + e.balance.projects.fridgeReputationBump);
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
      unlocked: (s: GameState) => s.phase >= 3,
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
      unlocked: (s: GameState) => s.phase === 3 && (s.legacyStoreProgress || s.totalBottlesSold >= BOTTLES_FOR_INVENTION),
      effect: (e: any) => {
        e.state.phase = 4;
        e.patent.licensed = true;
        e.log('PHASE 4 UNLOCKED: Patent granted! You now earn passive royalties on every juicer sold nationwide.');
      }
    },
    {
      id: 'global_licensing',
      name: 'International Appliance Licensing',
      desc: 'Expands juicer distribution across Europe and Asia. Triples passive patent royalties!',
      phase: 4,
      costCash: 3000,
      purchased: false,
      unlocked: (s: GameState) => s.phase >= 4,
      effect: (e: any) => {
        e.patent.level = 2;
        e.patent.baseUnitsPerDay *= 3;
        e.patent.royaltyPerUnit = 3.25;
        e.log('Project: Global patent licensing active! Royalties tripled.');
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
    {
      id: 'national_bigbox',
      name: 'National Big-Box Retail Rollout (Target & Walmart)',
      desc: 'Premium endcap displays in 2,500 retail stores nationwide. Co-packer volume scales to 6,000 cases/day!',
      phase: 5,
      costCash: 350000,
      purchased: false,
      unlocked: (s: GameState) => s.phase === 5 && s.cash.gte(200000),
      effect: (e: any) => {
        e.copacker.casesPerDay = 6000;
        e.state.brandMultiplier *= 1.25;
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
        e.state.brandMultiplier *= 1.20;
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
        e.state.brandMultiplier *= 1.25;
        e.log('Project: International Joint Venture operational! World-wide distribution of 350,000 cases/day.');
      }
    }
  ];
}

// engine.ts — Realistic Scaling Entrepreneur Engine with Lifestyle Trophies

// ============================================================================
// 1. SELF-CONTAINED BIGNUM (Supports numbers up to 10^9,000,000,000)
// ============================================================================
export class BigNum {
  public m: number; // Mantissa in [1, 10) or 0
  public e: number; // Integer exponent

  constructor(mantissa: number = 0, exponent: number = 0) {
    this.m = mantissa;
    this.e = exponent;
    this.normalize();
  }

  static fromNumber(n: number): BigNum {
    if (!Number.isFinite(n) || n === 0) return new BigNum(0, 0);
    return new BigNum(n, 0);
  }

  private normalize(): this {
    if (this.m === 0 || Number.isNaN(this.m)) {
      this.m = 0;
      this.e = 0;
      return this;
    }
    const sign = Math.sign(this.m);
    const absM = Math.abs(this.m);
    if (absM >= 10 || absM < 1) {
      const shift = Math.floor(Math.log10(absM));
      this.m = sign * (absM / Math.pow(10, shift));
      this.e += shift;
    }
    if (Math.abs(this.m) >= 9.999999999999) {
      this.m = sign * 1;
      this.e += 1;
    }
    return this;
  }

  clone(): BigNum {
    return new BigNum(this.m, this.e);
  }

  toNumber(): number {
    if (this.m === 0) return 0;
    if (this.e > 308) return Infinity * Math.sign(this.m);
    if (this.e < -308) return 0;
    return this.m * Math.pow(10, this.e);
  }

  log10(): number {
    if (this.m <= 0) return -Infinity;
    return Math.log10(this.m) + this.e;
  }

  add(other: BigNum | number): BigNum {
    const b = typeof other === 'number' ? BigNum.fromNumber(other) : other;
    if (this.m === 0) return b.clone();
    if (b.m === 0) return this.clone();
    const diff = this.e - b.e;
    if (diff > 15) return this.clone();
    if (diff < -15) return b.clone();
    return new BigNum(this.m + b.m * Math.pow(10, -diff), this.e);
  }

  sub(other: BigNum | number): BigNum {
    const b = typeof other === 'number' ? BigNum.fromNumber(other) : other;
    return this.add(new BigNum(-b.m, b.e));
  }

  mul(other: BigNum | number): BigNum {
    const b = typeof other === 'number' ? BigNum.fromNumber(other) : other;
    if (this.m === 0 || b.m === 0) return new BigNum(0, 0);
    return new BigNum(this.m * b.m, this.e + b.e);
  }

  div(other: BigNum | number): BigNum {
    const b = typeof other === 'number' ? BigNum.fromNumber(other) : other;
    if (b.m === 0) throw new Error('Division by zero in BigNum');
    if (this.m === 0) return new BigNum(0, 0);
    return new BigNum(this.m / b.m, this.e - b.e);
  }

  pow(power: number): BigNum {
    if (this.m === 0) return new BigNum(0, 0);
    if (power === 0) return new BigNum(1, 0);
    const logVal = this.log10() * power;
    const newExp = Math.floor(logVal);
    const newMant = Math.pow(10, logVal - newExp);
    return new BigNum(newMant, newExp);
  }

  cmp(other: BigNum | number): number {
    const b = typeof other === 'number' ? BigNum.fromNumber(other) : other;
    if (this.m === 0 && b.m === 0) return 0;
    const signA = Math.sign(this.m);
    const signB = Math.sign(b.m);
    if (signA !== signB) return signA > signB ? 1 : -1;
    if (this.e !== b.e) return (this.e > b.e ? 1 : -1) * signA;
    if (Math.abs(this.m - b.m) < 1e-12) return 0;
    return this.m > b.m ? 1 : -1;
  }

  gte(other: BigNum | number): boolean { return this.cmp(other) >= 0; }
  gt(other: BigNum | number): boolean { return this.cmp(other) > 0; }
  lte(other: BigNum | number): boolean { return this.cmp(other) <= 0; }
  lt(other: BigNum | number): boolean { return this.cmp(other) < 0; }

  format(decimals: number = 2): string {
    if (this.m === 0) return '0.00';
    if (this.e < 0) return this.toNumber().toFixed(decimals);
    if (this.e < 3) return this.toNumber().toFixed(decimals);
    const suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    const tier = Math.floor(this.e / 3);
    if (tier < suffixes.length) {
      const scaled = this.m * Math.pow(10, this.e % 3);
      return `${scaled.toFixed(decimals)} ${suffixes[tier]}`;
    }
    return `${this.m.toFixed(decimals)}e${this.e}`;
  }
}

// ============================================================================
// 2. DATA STRUCTURES & BUSINESS SCHEMA
// ============================================================================
export type WeatherCondition = 'SUNNY' | 'CLOUDY' | 'RAINY';
export type GamePhase = 1 | 2 | 3 | 4 | 5;

export interface FranchiseStand {
  id: string;
  name: string;
  workerName: string;
  location: string;
  hired: boolean;
  setupCost: number;
  dailyWage: number;
  baseCapacity: number;
  weatherSens: number;
  desc: string;
}

export interface WholesaleAccount {
  id: string;
  name: string;
  active: boolean;
  setupCost: number;
  bottlesPerDay: number;
  wholesalePrice: number;
  packagingCost: number;
  weatherSens: number;
  desc: string;
}

export interface PatentSystem {
  licensed: boolean;
  royaltyPerUnit: number;
  baseUnitsPerDay: number;
  level: number;
}

export interface CoPackerSystem {
  active: boolean;
  casesPerDay: number; // 24 bottles per case
  netPerCase: number;
}

export interface ChoreState {
  name: string;
  reward: number;
  cooldownSec: number;
  remainingSec: number;
}

export interface ProjectDef {
  id: string;
  name: string;
  desc: string;
  phase: GamePhase;
  costCash: number;
  purchased: boolean;
  unlocked: (state: GameState) => boolean;
  effect: (engine: LemonadeEngine) => void;
}

export interface LifestyleTrophy {
  id: string;
  name: string;
  emoji: string;
  category: 'kid' | 'teen' | 'mogul' | 'billionaire';
  costCash: number;
  purchased: boolean;
  desc: string;
  perkDesc: string;
  phaseRequired: GamePhase;
}

export interface CustomerReview {
  stars: number;
  quote: string;
  reviewer: string;
  sentiment: 'positive' | 'mixed' | 'negative';
}

export interface DailyDemandEstimate {
  estDrivewayCups: number;
  franchiseEstimates: { id: string; name: string; workerName: string; estCups: number }[];
  totalEstCups: number;
  neededLemons: number;
  neededSugar: number;
  neededIce: number;
  neededCups: number;
}

export interface DaySummary {
  day: number;
  tempF: number;
  weather: WeatherCondition;

  // Driveway Stand
  drivewayCupsSold: number;
  drivewayRevenue: number;

  // Franchise Stands (Phase 2+)
  franchiseCupsSold: number;
  franchiseGrossRevenue: number;
  franchiseWagesPaid: number;
  franchiseNet: number;

  // Wholesale Bottling (Phase 3+)
  bottlesSold: number;
  wholesaleRevenue: number;
  packagingCosts: number;
  wholesaleNet: number;

  // Patent Royalties (Phase 4+)
  patentUnitsSold: number;
  patentRoyalties: number;

  // Industrial Co-Packing (Phase 5)
  copackerCasesSold: number;
  copackerNet: number;

  // P&L Statement totals
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;

  recipeQuality: number;
  reviews: CustomerReview[];
  notes: string[];
}

export interface GameState {
  phase: GamePhase;
  elapsedSec: number;
  day: number;
  tempF: number;
  weather: WeatherCondition;
  reputation: number;        // [0.1, 1.0]
  bestRecipeQuality: number;
  avgRecipeQuality: number;
  totalQualityDays: number;
  totalQualitySum: number;
  brandMultiplier: number;
  gameWon: boolean;

  // Working Capital & Inventory
  cash: BigNum;
  totalCupsSold: BigNum;
  totalRevenueEarned: BigNum;

  inv: {
    lemons: number;
    sugar: number;
    ice: number;
    cups: number;
    bottles: number;
  };
  recipe: {
    lemonsPerPitcher: number;
    sugarPerPitcher: number;
    icePerCup: number;
    pricePerCup: number;
  };

  // Upgrades & Flag States
  flags: {
    hasCooler: boolean;
    hasMiniFridge: boolean;
    hasCostcoDiscount: boolean;
    hasCargoWagon: boolean;
    hasCommercialLabeler: boolean;
    weatherLocked95F: boolean;
    hasAutoIce: boolean;
    autoIceEnabled: boolean;

    // Lifestyle Trophy Flags
    hasSkateboard: boolean;
    hasMountainBike: boolean;
    hasNintendoSwitch: boolean;
    hasElectricScooter: boolean;
    hasIpadPro: boolean;
    hasDisneyTrip: boolean;
    hasHondaCivic: boolean;
    hasGarageArcade: boolean;
    hasCollegePrepaid: boolean;
    hasPaidMortgage: boolean;
    hasLemonGrove: boolean;
    hasTeslaModelX: boolean;
    hasPrivateJet: boolean;
    hasArenaNaming: boolean;
    hasPrivateIsland: boolean;
  };

  currentChore: ChoreState;
  lastDaySummary: DaySummary | null;
  logs: string[];
}

// ============================================================================
// 3. CORE SIMULATION ENGINE
// ============================================================================
export class LemonadeEngine {
  public state: GameState;
  public projects: ProjectDef[];
  public trophies: LifestyleTrophy[];
  public franchiseStands: Record<string, FranchiseStand>;
  public wholesaleAccounts: Record<string, WholesaleAccount>;
  public patent: PatentSystem;
  public copacker: CoPackerSystem;
  private rngSeed = 1337;

  private static readonly CHORE_DEFS: { name: string; min: number; max: number }[] = [
    { name: "Mow Neighbor's Lawn", min: 15, max: 25 },
    { name: "Rake Autumn Leaves", min: 10, max: 18 },
    { name: "Wash Dad's SUV", min: 12, max: 20 },
    { name: "Walk Mrs. Higgins' Dog", min: 8, max: 15 },
    { name: "Weed the Garden Beds", min: 8, max: 15 },
    { name: "Clean Out the Garage", min: 15, max: 25 },
    { name: "Sort Recycling Cans", min: 5, max: 10 },
    { name: "Shovel Neighbor's Walkway", min: 15, max: 25 },
    { name: "Help Carry Heavy Groceries", min: 6, max: 12 },
    { name: "Sweep the Deck & Porch", min: 5, max: 10 }
  ];

  constructor() {
    this.franchiseStands = this.initFranchiseStands();
    this.wholesaleAccounts = this.initWholesaleAccounts();
    this.patent = { licensed: false, royaltyPerUnit: 2.50, baseUnitsPerDay: 16, level: 1 };
    this.copacker = { active: false, casesPerDay: 40, netPerCase: 18.00 };
    this.projects = this.initProjects();
    this.trophies = this.initTrophies();
    this.state = this.createInitialState();
    this.rollNextForecast();
    this.rollNextChore();
  }

  private rand(): number {
    let x = this.rngSeed;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    this.rngSeed = x;
    return ((x >>> 0) / 4294967296);
  }

  private createInitialState(): GameState {
    return {
      phase: 1,
      elapsedSec: 0,
      day: 1,
      tempF: 78,
      weather: 'SUNNY',
      reputation: 0.5,
      bestRecipeQuality: 0,
      avgRecipeQuality: 0,
      totalQualityDays: 0,
      totalQualitySum: 0,
      brandMultiplier: 1.0,
      gameWon: false,

      cash: BigNum.fromNumber(60.00),
      totalCupsSold: new BigNum(0, 0),
      totalRevenueEarned: new BigNum(0, 0),

      inv: { lemons: 24, sugar: 20, ice: 80, cups: 50, bottles: 0 },
      recipe: { lemonsPerPitcher: 4, sugarPerPitcher: 4, icePerCup: 4, pricePerCup: 2.00 },

      flags: {
        hasCooler: false,
        hasMiniFridge: false,
        hasCostcoDiscount: false,
        hasCargoWagon: false,
        hasCommercialLabeler: false,
        weatherLocked95F: false,
        hasAutoIce: false,
        autoIceEnabled: false,

        hasSkateboard: false,
        hasMountainBike: false,
        hasNintendoSwitch: false,
        hasElectricScooter: false,
        hasIpadPro: false,
        hasDisneyTrip: false,
        hasHondaCivic: false,
        hasGarageArcade: false,
        hasCollegePrepaid: false,
        hasPaidMortgage: false,
        hasLemonGrove: false,
        hasTeslaModelX: false,
        hasPrivateJet: false,
        hasArenaNaming: false,
        hasPrivateIsland: false
      },

      currentChore: {
        name: "Mow Neighbor's Lawn",
        reward: 18.00,
        cooldownSec: 10,
        remainingSec: 0
      },
      lastDaySummary: null,
      logs: ['Day 1: Opened the driveway stand! Check the forecast and set your recipe.']
    };
  }

  private initFranchiseStands(): Record<string, FranchiseStand> {
    return {
      timmy: {
        id: 'timmy',
        name: 'Elm Street Stand',
        workerName: 'Timmy',
        location: 'Elm St & 4th Ave',
        hired: false,
        setupCost: 45.00,
        dailyWage: 12.00,
        baseCapacity: 35,
        weatherSens: 0.8,
        desc: 'Steady residential traffic. Timmy is reliable and easygoing.'
      },
      leo: {
        id: 'leo',
        name: 'Ballpark Stand',
        workerName: 'Leo',
        location: 'Little League Park',
        hired: false,
        setupCost: 75.00,
        dailyWage: 16.00,
        baseCapacity: 70,
        weatherSens: 1.2,
        desc: 'Crushes weekend games and sunny tournaments! Huge crowds.'
      },
      sarah: {
        id: 'sarah',
        name: 'Poolside Stand',
        workerName: 'Sarah',
        location: 'Community Pool Entrance',
        hired: false,
        setupCost: 95.00,
        dailyWage: 20.00,
        baseCapacity: 100,
        weatherSens: 1.8,
        desc: 'Insane volume on scorchers above 80°F! Slow when cloudy.'
      }
    };
  }

  private initWholesaleAccounts(): Record<string, WholesaleAccount> {
    return {
      bodega: {
        id: 'bodega',
        name: 'Corner Bodega & Deli',
        active: false,
        setupCost: 80.00,
        bottlesPerDay: 25,
        wholesalePrice: 2.40,
        packagingCost: 0.60,
        weatherSens: 0.6,
        desc: 'Buys 25 bottled units daily for their refrigerated beverage case.'
      },
      market: {
        id: 'market',
        name: "Saturday Farmers Market",
        active: false,
        setupCost: 140.00,
        bottlesPerDay: 60,
        wholesalePrice: 3.50,
        packagingCost: 0.65,
        weatherSens: 1.5,
        desc: 'Weekend organic craft stall. Sells out premium bottles on sunny days!'
      },
      sports: {
        id: 'sports',
        name: 'Youth Sports Complex Concession',
        active: false,
        setupCost: 180.00,
        bottlesPerDay: 80,
        wholesalePrice: 2.20,
        packagingCost: 0.55,
        weatherSens: 1.3,
        desc: 'Supplies bottled sports drinks to concession stands across 4 fields.'
      }
    };
  }

  private initProjects(): ProjectDef[] {
    return [
      {
        id: 'cooler',
        name: 'Insulated 50-Qt Cooler',
        desc: 'Stops unused ice from melting overnight.',
        phase: 1, costCash: 45, purchased: false,
        unlocked: (s) => s.phase >= 1 && s.day >= 2,
        effect: (e) => { e.state.flags.hasCooler = true; e.log('Upgrade: Insulated cooler bought. Ice no longer melts overnight!'); }
      },
      {
        id: 'auto_ice_dispenser',
        name: 'Digital Weather-Synced Ice Dispenser',
        desc: 'Reads the morning thermometer and automatically dials in ideal ice cubes per cup! Includes an Auto toggle.',
        phase: 1, costCash: 60, purchased: false,
        unlocked: (s) => s.phase >= 1 && s.day >= 3,
        effect: (e) => {
          e.state.flags.hasAutoIce = true;
          e.state.flags.autoIceEnabled = true;
          e.state.recipe.icePerCup = e.computeIdealIce(e.state.tempF);
          e.log('Project: Digital Ice Dispenser installed! Automatically calibrates ice to the daily weather forecast.');
        }
      },
      {
        id: 'fridge',
        name: 'Garage Mini-Fridge',
        desc: 'Eliminates overnight lemon spoilage (+10% Reputation).',
        phase: 1, costCash: 120, purchased: false,
        unlocked: (s) => s.phase >= 1 && s.day >= 3,
        effect: (e) => { e.state.flags.hasMiniFridge = true; e.state.reputation = Math.min(1.0, e.state.reputation + 0.1); e.log('Upgrade: Mini-fridge online! Lemons stay crisp and fresh.'); }
      },
      {
        id: 'franchise_license',
        name: 'Neighborhood Expansion (Phase 2)',
        desc: 'Print flyers, buy folding tables, and start hiring neighborhood kids to run stands!',
        phase: 1, costCash: 150, purchased: false,
        unlocked: (s) => s.phase === 1 && s.cash.gte(100) && (s.bestRecipeQuality >= 0.80 || (s.avgRecipeQuality || 0) >= 0.75),
        effect: (e) => {
          e.state.phase = 2;
          e.log('PHASE 2 UNLOCKED: You are now a manager! Hire neighborhood kids in the Franchise tab.');
        }
      },
      {
        id: 'costco_card',
        name: 'Costco Business Card',
        desc: 'Wholesale restaurant supply pricing: cuts all grocery supply costs by 35%!',
        phase: 2, costCash: 60, purchased: false,
        unlocked: (s) => s.phase >= 2,
        effect: (e) => { e.state.flags.hasCostcoDiscount = true; e.log('Project: Costco Business Card unlocked! 35% discount on all ingredients.'); }
      },
      {
        id: 'cargo_wagon',
        name: 'Heavy-Duty Radio Flyer Cargo Wagon',
        desc: 'Streamlines supply distribution: boosts all franchise stands capacity by +25%!',
        phase: 2, costCash: 75, purchased: false,
        unlocked: (s) => s.phase >= 2,
        effect: (e) => {
          e.state.flags.hasCargoWagon = true;
          Object.values(e.franchiseStands).forEach(st => st.baseCapacity = Math.round(st.baseCapacity * 1.25));
          e.log('Project: Cargo Wagon in service! Franchise capacity expanded.');
        }
      },
      {
        id: 'bottling_rig',
        name: 'Commercial Countertop Bottling Rig (Phase 3)',
        desc: 'Hand-capper, food-grade glass bottles, and labels. Sell wholesale to local stores!',
        phase: 2, costCash: 450, purchased: false,
        unlocked: (s) => s.phase === 2 && s.cash.gte(300) && s.totalCupsSold.gte(250),
        effect: (e) => {
          e.state.phase = 3;
          e.log('PHASE 3 UNLOCKED: Bottling operations online! Sign wholesale accounts in the Wholesale tab.');
        }
      },
      {
        id: 'commercial_labeler',
        name: 'Semi-Automatic Bottle Labeler',
        desc: 'Reduces bottle packaging cost from ~$0.60 down to $0.35 per bottle.',
        phase: 3, costCash: 250, purchased: false,
        unlocked: (s) => s.phase >= 3,
        effect: (e) => {
          e.state.flags.hasCommercialLabeler = true;
          Object.values(e.wholesaleAccounts).forEach(w => w.packagingCost = 0.35);
          e.log('Project: Semi-Auto Labeler running! Packaging margins improved.');
        }
      },
      {
        id: 'patent_filing',
        name: 'USPTO Patent for "Vortex Press" (Phase 4)',
        desc: 'Invent an ergonomic high-yield citrus press. License it to an appliance company for passive royalties!',
        phase: 3, costCash: 1200, purchased: false,
        unlocked: (s) => s.phase === 3 && s.cash.gte(800),
        effect: (e) => {
          e.state.phase = 4;
          e.patent.licensed = true;
          e.log('PHASE 4 UNLOCKED: Patent granted! You now earn passive royalties on every juicer sold nationwide.');
        }
      },
      {
        id: 'global_licensing',
        name: 'International Appliance Licensing',
        desc: 'Expands juicer distribution across Europe and Asia. Triples passive patent royalties!',
        phase: 4, costCash: 3000, purchased: false,
        unlocked: (s) => s.phase >= 4,
        effect: (e) => {
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
        phase: 4, costCash: 6000, purchased: false,
        unlocked: (s) => s.phase >= 4 && s.cash.gte(4000),
        effect: (e) => {
          e.state.phase = 5;
          e.copacker.active = true;
          e.log('PHASE 5 UNLOCKED: Beverage Empire achieved! Commercial co-packing and supermarket distribution active.');
        }
      },
      {
        id: 'regional_supermarkets',
        name: 'Regional Supermarket Distribution',
        desc: 'Partner with regional grocery chains (Whole Foods, Sprouted Markets) across 3 states. Co-packer volume scales to 300 cases/day!',
        phase: 5, costCash: 18000, purchased: false,
        unlocked: (s) => s.phase === 5 && s.cash.gte(10000),
        effect: (e) => {
          e.copacker.casesPerDay = 300;
          e.log('Project: Regional Supermarket Distribution active! Shipping 300 cases/day across 3 states.');
        }
      },
      {
        id: 'automated_canning_line',
        name: 'High-Speed Rotary Canning Line',
        desc: 'Install automated rotary filler & pasteurization tunnel at the co-packer facility. Capacity scales to 1,500 cases/day at $22/case margin!',
        phase: 5, costCash: 85000, purchased: false,
        unlocked: (s) => s.phase === 5 && s.cash.gte(50000),
        effect: (e) => {
          e.copacker.casesPerDay = 1500;
          e.copacker.netPerCase = 22.00;
          e.log('Project: High-Speed Rotary Canning Line online! 1,500 cases/day at $22/case net margin.');
        }
      },
      {
        id: 'national_bigbox',
        name: 'National Big-Box Retail Rollout (Target & Walmart)',
        desc: 'Premium endcap displays in 2,500 retail stores nationwide. Co-packer volume scales to 6,000 cases/day!',
        phase: 5, costCash: 350000, purchased: false,
        unlocked: (s) => s.phase === 5 && s.cash.gte(200000),
        effect: (e) => {
          e.copacker.casesPerDay = 6000;
          e.state.brandMultiplier *= 1.25;
          e.log('Project: National Big-Box contract finalized! Shipping 6,000 cases/day across America.');
        }
      },
      {
        id: 'club_store_pallets',
        name: 'Costco & Sam\'s Club Wholesale Pallet Program',
        desc: 'Full pallets of 24-can variety club packs in wholesale warehouses nationwide. Volume expands to 25,000 cases/day!',
        phase: 5, costCash: 1800000, purchased: false,
        unlocked: (s) => s.phase === 5 && s.cash.gte(1000000),
        effect: (e) => {
          e.copacker.casesPerDay = 25000;
          e.log('Project: Club Store Pallet Program active! 25,000 cases/day flowing through warehouse clubs.');
        }
      },
      {
        id: 'qsr_fountain_licensing',
        name: 'Global Fast-Casual Restaurant Fountain Licensing',
        desc: 'Craft lemonade dispensers in 10,000 fast-casual restaurants worldwide. Volume expands to 100,000 cases/day!',
        phase: 5, costCash: 8500000, purchased: false,
        unlocked: (s) => s.phase === 5 && s.cash.gte(5000000),
        effect: (e) => {
          e.copacker.casesPerDay = 100000;
          e.state.brandMultiplier *= 1.20;
          e.log('Project: Fast-casual soda fountain contract live! 100,000 cases/day globally.');
        }
      },
      {
        id: 'global_beverage_jv',
        name: 'International Beverage Conglomerate Joint Venture',
        desc: 'Partner with global bottling plants in Europe, Asia, and Latin America. Production hits 350,000 cases/day!',
        phase: 5, costCash: 35000000, purchased: false,
        unlocked: (s) => s.phase === 5 && s.cash.gte(20000000),
        effect: (e) => {
          e.copacker.casesPerDay = 350000;
          e.state.brandMultiplier *= 1.25;
          e.log('Project: International Joint Venture operational! World-wide distribution of 350,000 cases/day.');
        }
      }
    ];
  }

  private initTrophies(): LifestyleTrophy[] {
    return [
      {
        id: 'skateboard',
        name: 'Custom Pro Skateboard & Helmet',
        emoji: '🛹',
        category: 'kid',
        costCash: 85,
        purchased: false,
        desc: 'Custom grip tape and smooth abec-9 bearings. Roll up to the stand in style.',
        perkDesc: 'Speedy Chore Travel: reduces chore cooldown by 25%!',
        phaseRequired: 1
      },
      {
        id: 'mountain_bike',
        name: 'Trek Mountain Bike with Front Basket',
        emoji: '🚲',
        category: 'kid',
        costCash: 280,
        purchased: false,
        desc: '21-speed aluminum frame bike with a heavy-duty front rack for grocery runs.',
        perkDesc: 'Grocery Hauler: +25% bonus supplies on all store pack purchases!',
        phaseRequired: 1
      },
      {
        id: 'nintendo_switch',
        name: 'Nintendo Switch OLED & Mario Kart',
        emoji: '🎮',
        category: 'kid',
        costCash: 350,
        purchased: false,
        desc: 'Game behind the stand on slow cloudy afternoons. Total neighborhood envy.',
        perkDesc: 'Good Vibes: +5% customer happiness & reputation floor!',
        phaseRequired: 1
      },
      {
        id: 'electric_scooter',
        name: 'Segway Ninebot Electric Scooter',
        emoji: '🛴',
        category: 'kid',
        costCash: 650,
        purchased: false,
        desc: 'Zip between Timmy, Leo, and Sarahs stands in seconds to check stock.',
        perkDesc: 'Manager Mobility: +15% capacity boost to all franchise stands!',
        phaseRequired: 2
      },
      {
        id: 'ipad_pro',
        name: 'iPad Pro & Apple Pencil',
        emoji: '📱',
        category: 'teen',
        costCash: 900,
        purchased: false,
        desc: 'Design high-res glossy flyers and track real-time franchise supply spreadsheets.',
        perkDesc: 'Digital Supply Chain: +10% sales throughput across all stands!',
        phaseRequired: 2
      },
      {
        id: 'disney_vip',
        name: 'VIP Disney World Family Vacation',
        emoji: '🏰',
        category: 'teen',
        costCash: 3500,
        purchased: false,
        desc: 'Treated the entire family to 5-star resort suites. Mom and Dad are in awe.',
        perkDesc: 'Family Pride: Permanent +15% Neighborhood Reputation!',
        phaseRequired: 2
      },
      {
        id: 'first_car',
        name: '2012 Honda Civic Hatchback',
        emoji: '🚗',
        category: 'teen',
        costCash: 8500,
        purchased: false,
        desc: 'Your first car! Fold-down rear seats easily hold 25 crates of bottled lemonade.',
        perkDesc: 'Wholesale Delivery Driver: cuts wholesale packaging delivery friction by 30%!',
        phaseRequired: 3
      },
      {
        id: 'garage_arcade',
        name: 'Garage HQ Renovation & Arcade Cabinet',
        emoji: '🕹️',
        category: 'teen',
        costCash: 15000,
        purchased: false,
        desc: 'Epoxy floors, stainless steel juicing tables, and a Street Fighter arcade machine.',
        perkDesc: 'Corporate Headquarters: +15% brand multiplier across all wholesale accounts!',
        phaseRequired: 3
      },
      {
        id: 'college_fund',
        name: 'College Tuition Prepaid in Full',
        emoji: '🎓',
        category: 'teen',
        costCash: 50000,
        purchased: false,
        desc: 'Paid 4 full years of college tuition before high school graduation. Mom cried tears of joy.',
        perkDesc: 'Total Peace of Mind: permanent 1.25x Brand Multiplier on all sales!',
        phaseRequired: 3
      },
      {
        id: 'tesla_model_x',
        name: 'Tesla Model X (LEM0N8 Plates)',
        emoji: '⚡',
        category: 'mogul',
        costCash: 95000,
        purchased: false,
        desc: 'Falcon-wing doors with a custom sunshine-yellow wrap and personalized plates.',
        perkDesc: 'Luxury Tech Flex: +20% patent licensing royalties!',
        phaseRequired: 4
      },
      {
        id: 'pay_mortgage',
        name: 'Paid Off Mom & Dads 30-Year Mortgage',
        emoji: '🏡',
        category: 'mogul',
        costCash: 450000,
        purchased: false,
        desc: 'Handed your parents the mortgage deed marked PAID IN FULL. Legend of the neighborhood.',
        perkDesc: 'Neighborhood Saint: Locks Neighborhood Reputation permanently at 100%!',
        phaseRequired: 4
      },
      {
        id: 'lemon_grove',
        name: '100-Acre California Lemon Grove',
        emoji: '🍋',
        category: 'mogul',
        costCash: 1200000,
        purchased: false,
        desc: 'Your own certified organic citrus orchards in Santa Barbara, California.',
        perkDesc: 'Free Lemons Forever: Grove delivers 500 fresh lemons every morning for $0!',
        phaseRequired: 4
      },
      {
        id: 'private_jet',
        name: 'Gulfstream G650 Private Jet',
        emoji: '✈️',
        category: 'billionaire',
        costCash: 65000000,
        purchased: false,
        desc: 'Yellow-trimmed private jet to negotiate international appliance rights in London and Tokyo.',
        perkDesc: 'Global Dealmaker: Doubles all patent royalties worldwide!',
        phaseRequired: 5
      },
      {
        id: 'arena_naming',
        name: 'Naming Rights: The Lemonade Center Arena',
        emoji: '🏟️',
        category: 'billionaire',
        costCash: 80000000,
        purchased: false,
        desc: 'Your brand name glowing across the 20,000-seat professional sports arena downtown.',
        perkDesc: 'Worldwide Fame: Doubles all supermarket co-packer demand!',
        phaseRequired: 5
      },
      {
        id: 'private_island',
        name: 'Buy Citrus Cay Private Caribbean Island',
        emoji: '🏝️',
        category: 'billionaire',
        costCash: 150000000,
        purchased: false,
        desc: 'A 500-acre tropical private island with citrus orchards, white sand beaches, and an infinity pool filled with iced lemonade.',
        perkDesc: 'THE GRAND VICTORY: You won the game! Retires to paradise and unlocks Golden Seeds (+50% Empire Profit)!',
        phaseRequired: 5
      }
    ];
  }

  public log(msg: string): void {
    this.state.logs.unshift(`[Day ${this.state.day}] ${msg}`);
    if (this.state.logs.length > 50) this.state.logs.pop();
  }

  // ==========================================================================
  // CHORE SYSTEM (EMERGENCY SEED CAPITAL)
  // ==========================================================================
  public rollNextChore(): void {
    const chore = LemonadeEngine.CHORE_DEFS[Math.floor(this.rand() * LemonadeEngine.CHORE_DEFS.length)];
    const reward = chore.min + Math.floor(this.rand() * (chore.max - chore.min + 1));
    let cooldownSec = 8 + Math.floor(this.rand() * 10);
    if (this.state.flags.hasSkateboard) {
      cooldownSec = Math.max(5, Math.round(cooldownSec * 0.75)); // Skateboard perk!
    }
    this.state.currentChore = {
      name: chore.name,
      reward,
      cooldownSec,
      remainingSec: 0
    };
  }

  public doChore(): { name: string; reward: number } | null {
    const chore = this.state.currentChore;
    if (chore.remainingSec > 0) return null;

    const reward = chore.reward;
    const name = chore.name;
    this.state.cash = this.state.cash.add(reward);
    this.log(`Completed chore: ${name} (Earned +$${reward.toFixed(2)})`);

    const cd = chore.cooldownSec;
    this.rollNextChore();
    this.state.currentChore.remainingSec = cd;
    return { name, reward };
  }

  // ==========================================================================
  // INVENTORY & SUPPLY LOGISTICS
  // ==========================================================================
  public buySupplies(item: 'lemons' | 'sugar' | 'ice' | 'cups' | 'bottles', packs: number = 1): boolean {
    const discount = this.state.flags.hasCostcoDiscount ? 0.65 : 1.0;
    const bikeBonus = this.state.flags.hasMountainBike ? 1.25 : 1.0; // Mountain bike perk!

    const catalog = {
      lemons:  { qty: Math.round(24 * bikeBonus),  cost: +(8.00 * discount).toFixed(2) },
      sugar:   { qty: Math.round(20 * bikeBonus),  cost: +(6.00 * discount).toFixed(2) },
      ice:     { qty: Math.round(100 * bikeBonus), cost: +(4.00 * discount).toFixed(2) },
      cups:    { qty: Math.round(50 * bikeBonus),  cost: +(4.00 * discount).toFixed(2) },
      bottles: { qty: Math.round(25 * bikeBonus),  cost: +(10.00 * discount).toFixed(2) }
    }[item];

    const totalCost = catalog.cost * packs;
    if (this.state.cash.lt(totalCost)) return false;

    this.state.cash = this.state.cash.sub(totalCost);
    this.state.inv[item] += catalog.qty * packs;
    return true;
  }

  // ==========================================================================
  // FRANCHISE, WHOLESALE & LIFESTYLE ACTIONS
  // ==========================================================================
  public hireFranchiseStand(id: string): boolean {
    const stand = this.franchiseStands[id];
    if (!stand || stand.hired || this.state.cash.lt(stand.setupCost)) return false;

    this.state.cash = this.state.cash.sub(stand.setupCost);
    stand.hired = true;
    this.log(`Hired ${stand.workerName} for ${stand.name}! ($${stand.setupCost} setup, $${stand.dailyWage}/day wage)`);
    return true;
  }

  public signWholesaleAccount(id: string): boolean {
    const account = this.wholesaleAccounts[id];
    if (!account || account.active || this.state.cash.lt(account.setupCost)) return false;

    this.state.cash = this.state.cash.sub(account.setupCost);
    account.active = true;
    this.log(`Signed wholesale contract with ${account.name}!`);
    return true;
  }

  public buyProject(id: string): boolean {
    const p = this.projects.find(x => x.id === id);
    if (!p || p.purchased || !p.unlocked(this.state) || this.state.cash.lt(p.costCash)) return false;

    this.state.cash = this.state.cash.sub(p.costCash);
    p.purchased = true;
    p.effect(this);
    return true;
  }

  public buyTrophy(id: string): boolean {
    const t = this.trophies.find(x => x.id === id);
    if (!t || t.purchased || this.state.cash.lt(t.costCash)) return false;

    this.state.cash = this.state.cash.sub(t.costCash);
    t.purchased = true;

    // Apply specific trophy perks
    if (id === 'skateboard') this.state.flags.hasSkateboard = true;
    if (id === 'mountain_bike') this.state.flags.hasMountainBike = true;
    if (id === 'nintendo_switch') {
      this.state.flags.hasNintendoSwitch = true;
      this.state.reputation = Math.min(1.0, this.state.reputation + 0.05);
    }
    if (id === 'electric_scooter') {
      this.state.flags.hasElectricScooter = true;
      Object.values(this.franchiseStands).forEach(st => st.baseCapacity = Math.round(st.baseCapacity * 1.15));
    }
    if (id === 'ipad_pro') this.state.flags.hasIpadPro = true;
    if (id === 'disney_vip') {
      this.state.flags.hasDisneyTrip = true;
      this.state.reputation = Math.min(1.0, this.state.reputation + 0.15);
    }
    if (id === 'first_car') this.state.flags.hasHondaCivic = true;
    if (id === 'garage_arcade') {
      this.state.flags.hasGarageArcade = true;
      this.state.brandMultiplier *= 1.15;
    }
    if (id === 'college_fund') {
      this.state.flags.hasCollegePrepaid = true;
      this.state.brandMultiplier *= 1.25;
    }
    if (id === 'tesla_model_x') this.state.flags.hasTeslaModelX = true;
    if (id === 'pay_mortgage') {
      this.state.flags.hasPaidMortgage = true;
      this.state.reputation = 1.0;
    }
    if (id === 'lemon_grove') this.state.flags.hasLemonGrove = true;
    if (id === 'private_jet') this.state.flags.hasPrivateJet = true;
    if (id === 'arena_naming') this.state.flags.hasArenaNaming = true;
    if (id === 'private_island') {
      this.state.flags.hasPrivateIsland = true;
      this.state.gameWon = true;
    }

    this.log(`🎉 TROPHY PURCHASED: ${t.emoji} ${t.name} ($${t.costCash.toLocaleString()})! ${t.perkDesc}`);
    return true;
  }

  // ==========================================================================
  // WEATHER & RECIPE CALCULATIONS
  // ==========================================================================
  public rollNextForecast(): void {
    if (this.state.flags.weatherLocked95F) {
      this.state.tempF = 95;
      this.state.weather = 'SUNNY';
      return;
    }
    const rW = this.rand();
    this.state.weather = rW < 0.60 ? 'SUNNY' : rW < 0.85 ? 'CLOUDY' : 'RAINY';
    const baseTemp = this.state.weather === 'SUNNY' ? 82 : this.state.weather === 'CLOUDY' ? 72 : 62;
    this.state.tempF = Math.round(baseTemp + (this.rand() - 0.5) * 24);
  }

  public computeIdealIce(tempF: number): number {
    return Math.max(1, Math.min(8, Math.round((tempF - 50) / 7)));
  }

  public computeRecipeQuality(tempF: number = this.state.tempF): number {
    const { lemonsPerPitcher: L, sugarPerPitcher: S, icePerCup: I } = this.state.recipe;
    const idealL = 4;
    const idealS = 4;
    const idealI = this.computeIdealIce(tempF);
    const distSq = 0.08 * Math.pow(L - idealL, 2) + 0.08 * Math.pow(S - idealS, 2) + 0.12 * Math.pow(I - idealI, 2);
    return Math.exp(-distSq);
  }

  // ==========================================================================
  // CUSTOMER REVIEWS & DEMAND ESTIMATION
  // ==========================================================================
  public generateCustomerReviews(info: {
    tempF: number;
    quality: number;
    pricePerCup: number;
    fairPrice: number;
    drivewayCupsSold: number;
    franchiseCupsSold: number;
    soldOutStands: string[];
  }): CustomerReview[] {
    const reviews: CustomerReview[] = [];
    const s = this.state;
    const { lemonsPerPitcher: L, sugarPerPitcher: S, icePerCup: I } = s.recipe;
    const idealI = this.computeIdealIce(info.tempF);
    const priceRatio = info.pricePerCup / info.fairPrice;

    // 1. TASTE / RECIPE REVIEW
    if (L - S >= 2) {
      reviews.push({
        stars: 1,
        quote: "My whole face puckered up! Did you forget the sugar?!",
        reviewer: "Elm St. neighbor",
        sentiment: "negative"
      });
    } else if (S - L >= 2) {
      reviews.push({
        stars: 2,
        quote: "Liquid sugar shock! Tastes more like melted candy than lemonade.",
        reviewer: "Dentist on Elm St.",
        sentiment: "negative"
      });
    } else if (idealI - I >= 2) {
      reviews.push({
        stars: 2,
        quote: info.tempF >= 80
          ? `It's ${info.tempF}°F outside and this was lukewarm... needed ice!`
          : "Barely cool, could definitely use more ice cubes.",
        reviewer: "Pool lifeguard",
        sentiment: "negative"
      });
    } else if (I - idealI >= 3) {
      reviews.push({
        stars: 2,
        quote: "Cup was 90% ice cubes! More ice than actual lemonade.",
        reviewer: "Little League coach",
        sentiment: "negative"
      });
    } else if (L <= 2 && S <= 2) {
      reviews.push({
        stars: 1,
        quote: "Tastes mostly like tap water. Where are the lemons?",
        reviewer: "Dog walker",
        sentiment: "negative"
      });
    } else if (info.quality >= 0.88) {
      const praises = [
        { quote: "Absolute perfection! Crisp, ice-cold, and perfectly tangy.", reviewer: "Local foodie" },
        { quote: "Best lemonade on the block! The recipe is dialed in 100%.", reviewer: "Mail carrier" },
        { quote: "Five stars! Whatever you did to this batch, don't change a thing!", reviewer: "Little League parent" },
        { quote: "The golden ratio! Crisp, sweet, and wonderfully refreshing.", reviewer: "Bicycle kid" }
      ];
      const picked = praises[Math.floor(this.rand() * praises.length)];
      reviews.push({
        stars: 5,
        quote: picked.quote,
        reviewer: picked.reviewer,
        sentiment: "positive"
      });
    } else {
      reviews.push({
        stars: 4,
        quote: "Solid, refreshing cup of lemonade. Hit the spot!",
        reviewer: "Next-door neighbor",
        sentiment: "positive"
      });
    }

    // 2. PRICE / VALUE REVIEW
    if (priceRatio >= 1.40) {
      reviews.push({
        stars: 1,
        quote: `$${info.pricePerCup.toFixed(2)} for a paper cup?! Highway robbery!`,
        reviewer: "Thrifty neighbor",
        sentiment: "negative"
      });
    } else if (priceRatio >= 1.18) {
      reviews.push({
        stars: 2,
        quote: `$${info.pricePerCup.toFixed(2)} is a bit steep for kid lemonade, but I was thirsty.`,
        reviewer: "Dog walker",
        sentiment: "mixed"
      });
    } else if (priceRatio <= 0.70) {
      reviews.push({
        stars: 5,
        quote: `Only $${info.pricePerCup.toFixed(2)}?! Best deal in town, I bought two!`,
        reviewer: "Teen on a scooter",
        sentiment: "positive"
      });
    } else {
      reviews.push({
        stars: 4,
        quote: "Fair price for cold fresh lemonade on a day like this.",
        reviewer: "Neighborhood regular",
        sentiment: "positive"
      });
    }

    // 3. OPTIONAL STOCKOUT REVIEW
    if (info.soldOutStands.length > 0) {
      reviews.push({
        stars: 2,
        quote: `Walked over to ${info.soldOutStands[0]} but they were sold out of supplies early!`,
        reviewer: "Thirsty customer",
        sentiment: "negative"
      });
    }

    return reviews;
  }

  public getDailyDemandEstimate(): DailyDemandEstimate {
    const s = this.state;
    const weatherMult = s.weather === 'SUNNY' ? 1.0 : s.weather === 'CLOUDY' ? 0.65 : 0.25;
    const tempFactor = Math.max(0.3, 1 + 0.8 * ((s.tempF - 70) / 30));
    const quality = this.computeRecipeQuality(s.tempF);
    const fairPrice = 2.00 * (1 + 0.02 * (s.tempF - 70));
    const priceRatio = fairPrice / Math.max(0.25, s.recipe.pricePerCup);
    const buyProb = Math.max(0, Math.min(1, quality * Math.pow(priceRatio, 1.8)));

    const estDriveway = Math.floor(65 * weatherMult * tempFactor * (0.5 + s.reputation) * buyProb);
    let totalCups = estDriveway;

    const franchiseEstimates: { id: string; name: string; workerName: string; estCups: number }[] = [];
    if (s.phase >= 2) {
      const efficiencyBonus = s.flags.hasIpadPro ? 1.10 : 1.0;
      for (const stand of Object.values(this.franchiseStands)) {
        if (!stand.hired) continue;
        const standTraffic = Math.floor(stand.baseCapacity * Math.pow(weatherMult * tempFactor, stand.weatherSens) * (0.6 + s.reputation * 0.4) * efficiencyBonus);
        const estStand = Math.floor(standTraffic * buyProb);
        franchiseEstimates.push({ id: stand.id, name: stand.name, workerName: stand.workerName, estCups: estStand });
        totalCups += estStand;
      }
    }

    const cupsPerPitcher = 10 + s.recipe.icePerCup;
    const pitchers = Math.ceil(totalCups / cupsPerPitcher);
    const neededLemons = pitchers * s.recipe.lemonsPerPitcher;
    const neededSugar = pitchers * s.recipe.sugarPerPitcher;
    const neededIce = totalCups * s.recipe.icePerCup;
    const neededCups = totalCups;

    return {
      estDrivewayCups: estDriveway,
      franchiseEstimates,
      totalEstCups: totalCups,
      neededLemons,
      neededSugar,
      neededIce,
      neededCups
    };
  }

  public autoRestockForToday(): { success: boolean; message: string } {
    const est = this.getDailyDemandEstimate();
    const s = this.state;
    const discount = s.flags.hasCostcoDiscount ? 0.65 : 1.0;
    const bikeBonus = s.flags.hasMountainBike ? 1.25 : 1.0;

    const packSizes = {
      lemons: Math.round(24 * bikeBonus),
      sugar: Math.round(20 * bikeBonus),
      ice: Math.round(100 * bikeBonus),
      cups: Math.round(50 * bikeBonus)
    };

    const packCosts = {
      lemons: +(8.00 * discount).toFixed(2),
      sugar: +(6.00 * discount).toFixed(2),
      ice: +(4.00 * discount).toFixed(2),
      cups: +(4.00 * discount).toFixed(2)
    };

    const defL = Math.max(0, est.neededLemons - s.inv.lemons);
    const defS = Math.max(0, est.neededSugar - s.inv.sugar);
    const defI = Math.max(0, est.neededIce - s.inv.ice);
    const defC = Math.max(0, est.neededCups - s.inv.cups);

    const packsL = Math.ceil(defL / packSizes.lemons);
    const packsS = Math.ceil(defS / packSizes.sugar);
    const packsI = Math.ceil(defI / packSizes.ice);
    const packsC = Math.ceil(defC / packSizes.cups);

    const totalCost = packsL * packCosts.lemons + packsS * packCosts.sugar + packsI * packCosts.ice + packsC * packCosts.cups;

    if (totalCost === 0) {
      return { success: true, message: "Inventory is already fully stocked for today's forecast!" };
    }

    if (s.cash.lt(totalCost)) {
      return { success: false, message: `Need $${totalCost.toFixed(2)} to restock all items, but only have $${s.cash.format()}!` };
    }

    if (packsL > 0) this.buySupplies('lemons', packsL);
    if (packsS > 0) this.buySupplies('sugar', packsS);
    if (packsI > 0) this.buySupplies('ice', packsI);
    if (packsC > 0) this.buySupplies('cups', packsC);

    this.log(`Auto-Restocked for today: bought supplies for $${totalCost.toFixed(2)}.`);
    return { success: true, message: `Restocked all supplies for $${totalCost.toFixed(2)}!` };
  }

  // ==========================================================================
  // MAIN DAILY BUSINESS SIMULATION (P&L EXECUTION)
  // ==========================================================================
  public runDay(): DaySummary {
    const s = this.state;
    const notes: string[] = [];

    // Auto-Ice Dispenser: if unlocked and enabled, calibrate ice cubes to forecast
    if (s.flags.hasAutoIce && s.flags.autoIceEnabled) {
      s.recipe.icePerCup = this.computeIdealIce(s.tempF);
    }

    // Lemon grove perk: free morning lemons!
    if (s.flags.hasLemonGrove) {
      s.inv.lemons = Math.max(s.inv.lemons, 500);
      notes.push("California Lemon Grove delivered 500 fresh organic lemons ($0)");
    }

    // Mortgage perk: locks reputation at 100%
    if (s.flags.hasPaidMortgage) {
      s.reputation = 1.0;
    }

    const weatherMult = s.weather === 'SUNNY' ? 1.0 : s.weather === 'CLOUDY' ? 0.65 : 0.25;
    const tempFactor = Math.max(0.3, 1 + 0.8 * ((s.tempF - 70) / 30));
    const quality = this.computeRecipeQuality(s.tempF);
    s.bestRecipeQuality = Math.max(s.bestRecipeQuality, quality);
    s.totalQualityDays = (s.totalQualityDays || 0) + 1;
    s.totalQualitySum = (s.totalQualitySum || 0) + quality;
    s.avgRecipeQuality = s.totalQualitySum / s.totalQualityDays;

    // 1. Driveway Stand Execution
    const drivewayTraffic = Math.floor(65 * weatherMult * tempFactor * (0.5 + s.reputation));
    const fairPrice = 2.00 * (1 + 0.02 * (s.tempF - 70));
    const priceRatio = fairPrice / Math.max(0.25, s.recipe.pricePerCup);
    const buyProb = Math.max(0, Math.min(1, quality * Math.pow(priceRatio, 1.8)));
    const drivewayDemand = Math.floor(drivewayTraffic * buyProb);

    // Stock deduction helper for cups
    const cupsPerPitcher = 10 + s.recipe.icePerCup;
    const maxByLemons = Math.floor(s.inv.lemons / Math.max(1, s.recipe.lemonsPerPitcher)) * cupsPerPitcher;
    const maxBySugar = Math.floor(s.inv.sugar / Math.max(1, s.recipe.sugarPerPitcher)) * cupsPerPitcher;
    const maxByIce = s.recipe.icePerCup > 0 ? Math.floor(s.inv.ice / s.recipe.icePerCup) : Infinity;
    const maxPourableDriveway = Math.min(s.inv.cups, maxByLemons, maxBySugar, maxByIce);

    const drivewayCupsSold = Math.min(drivewayDemand, maxPourableDriveway);
    const pitchersUsed = Math.ceil(drivewayCupsSold / cupsPerPitcher);

    // If driveway ran out of supplies before meeting demand:
    if (drivewayDemand > 0 && drivewayCupsSold < drivewayDemand) {
      const shortages: string[] = [];
      if (s.inv.cups === maxPourableDriveway) shortages.push('Cups');
      if (maxByIce === maxPourableDriveway) shortages.push('Ice');
      if (maxByLemons === maxPourableDriveway) shortages.push('Lemons');
      if (maxBySugar === maxPourableDriveway) shortages.push('Sugar');
      const itemStr = shortages.length > 0 ? shortages.join(' & ') : 'supplies';
      notes.push(`Driveway stand sold out early (ran out of ${itemStr}! Sold ${drivewayCupsSold}/${drivewayDemand} cups)`);
    }

    s.inv.cups -= drivewayCupsSold;
    s.inv.ice = Math.max(0, s.inv.ice - drivewayCupsSold * s.recipe.icePerCup);
    s.inv.lemons = Math.max(0, s.inv.lemons - pitchersUsed * s.recipe.lemonsPerPitcher);
    s.inv.sugar = Math.max(0, s.inv.sugar - pitchersUsed * s.recipe.sugarPerPitcher);

    const drivewayRevenue = drivewayCupsSold * s.recipe.pricePerCup;

    // 2. Franchise Stands Execution (Phase 2+)
    let franchiseCupsSold = 0;
    let franchiseGross = 0;
    let franchiseWages = 0;
    const soldOutStands: string[] = [];

    if (s.phase >= 2) {
      const efficiencyBonus = s.flags.hasIpadPro ? 1.10 : 1.0;

      for (const stand of Object.values(this.franchiseStands)) {
        if (!stand.hired) continue;

        const remByLemons = Math.floor(s.inv.lemons / Math.max(1, s.recipe.lemonsPerPitcher)) * cupsPerPitcher;
        const remBySugar = Math.floor(s.inv.sugar / Math.max(1, s.recipe.sugarPerPitcher)) * cupsPerPitcher;
        const remByIce = s.recipe.icePerCup > 0 ? Math.floor(s.inv.ice / s.recipe.icePerCup) : Infinity;
        const maxStandPour = Math.min(s.inv.cups, remByLemons, remBySugar, remByIce);

        // Safety clause: if stand cannot even pour 1 cup, pause it with ZERO wages charged!
        if (maxStandPour <= 0) {
          const missing: string[] = [];
          if (s.inv.cups <= 0) missing.push('Cups');
          if (s.inv.lemons < s.recipe.lemonsPerPitcher) missing.push('Lemons');
          if (s.inv.sugar < s.recipe.sugarPerPitcher) missing.push('Sugar');
          if (s.recipe.icePerCup > 0 && s.inv.ice < s.recipe.icePerCup) missing.push('Ice');
          notes.push(`${stand.workerName}'s stand paused (out of ${missing.join(' & ') || 'supplies'})`);
          soldOutStands.push(stand.name);
          continue;
        }

        franchiseWages += stand.dailyWage;
        const standTraffic = Math.floor(stand.baseCapacity * Math.pow(weatherMult * tempFactor, stand.weatherSens) * (0.6 + s.reputation * 0.4) * efficiencyBonus);
        const standDemand = Math.floor(standTraffic * buyProb);

        const sold = Math.min(standDemand, maxStandPour);
        if (sold < standDemand) {
          const bottlenecks: string[] = [];
          if (s.inv.cups === maxStandPour) bottlenecks.push('Cups');
          if (remByIce === maxStandPour) bottlenecks.push('Ice');
          if (remByLemons === maxStandPour) bottlenecks.push('Lemons');
          if (remBySugar === maxStandPour) bottlenecks.push('Sugar');
          notes.push(`${stand.workerName} sold out early (ran out of ${bottlenecks.join(' & ') || 'supplies'}! Sold ${sold}/${standDemand} cups)`);
          soldOutStands.push(stand.name);
        }

        const pitchers = Math.ceil(sold / cupsPerPitcher);
        s.inv.cups -= sold;
        s.inv.ice = Math.max(0, s.inv.ice - sold * s.recipe.icePerCup);
        s.inv.lemons = Math.max(0, s.inv.lemons - pitchers * s.recipe.lemonsPerPitcher);
        s.inv.sugar = Math.max(0, s.inv.sugar - pitchers * s.recipe.sugarPerPitcher);

        franchiseCupsSold += sold;
        franchiseGross += sold * s.recipe.pricePerCup;
      }
    }
    const franchiseNet = franchiseGross - franchiseWages;

    // 3. Wholesale Bottling Accounts (Phase 3+)
    let bottlesSold = 0;
    let wholesaleGross = 0;
    let packagingCosts = 0;

    if (s.phase >= 3) {
      const civicCostDiscount = s.flags.hasHondaCivic ? 0.70 : 1.0;

      for (const acc of Object.values(this.wholesaleAccounts)) {
        if (!acc.active) continue;

        const demand = Math.round(acc.bottlesPerDay * Math.pow(weatherMult, acc.weatherSens));
        const maxByL = Math.floor(s.inv.lemons / 0.5);
        const maxByS = Math.floor(s.inv.sugar / 0.4);
        const maxBottles = Math.min(demand, s.inv.bottles, maxByL, maxByS);

        if (maxBottles > 0) {
          s.inv.bottles -= maxBottles;
          s.inv.lemons -= Math.ceil(maxBottles * 0.5);
          s.inv.sugar -= Math.ceil(maxBottles * 0.4);

          bottlesSold += maxBottles;
          wholesaleGross += maxBottles * acc.wholesalePrice;
          packagingCosts += maxBottles * (acc.packagingCost * civicCostDiscount);
        } else if (demand > 0) {
          const missing: string[] = [];
          if (s.inv.bottles <= 0) missing.push('Glass Bottles');
          if (s.inv.lemons < 1) missing.push('Lemons');
          if (s.inv.sugar < 1) missing.push('Sugar');
          notes.push(`Could not fill wholesale order for ${acc.name} (out of ${missing.join(' & ') || 'supplies'})!`);
        }
      }
    }
    const wholesaleNet = wholesaleGross - packagingCosts;

    // 4. Patent Royalties (Phase 4+)
    let patentUnitsSold = 0;
    let patentRoyalties = 0;
    if (s.phase >= 4 && this.patent.licensed) {
      let multiplier = 1.0;
      if (s.flags.hasTeslaModelX) multiplier += 0.20;
      if (s.flags.hasPrivateJet) multiplier *= 2.0;

      patentUnitsSold = Math.round(this.patent.baseUnitsPerDay * (0.8 + this.rand() * 0.4) * multiplier);
      patentRoyalties = patentUnitsSold * this.patent.royaltyPerUnit;
    }

    // 5. Industrial Co-Packing (Phase 5)
    let copackerCasesSold = 0;
    let copackerNet = 0;
    if (s.phase >= 5 && this.copacker.active) {
      const arenaMult = s.flags.hasArenaNaming ? 2.0 : 1.0;
      copackerCasesSold = Math.round(this.copacker.casesPerDay * (0.85 + this.rand() * 0.3) * arenaMult);
      copackerNet = copackerCasesSold * this.copacker.netPerCase;
    }

    // Overnight Spoilage
    if (!s.flags.hasCooler && s.inv.ice > 0) {
      notes.push(`${s.inv.ice} ice cubes melted overnight (Tip: buy 50-Qt Cooler to keep ice cold)`);
      s.inv.ice = 0;
    }
    if (!s.flags.hasMiniFridge && s.inv.lemons > 0 && !s.flags.hasLemonGrove) {
      const rotted = Math.ceil(s.inv.lemons * 0.20);
      s.inv.lemons -= rotted;
      notes.push(`${rotted} lemons rotted (Tip: buy Mini-Fridge to keep lemons fresh)`);
    }

    // P&L Consolidation
    const totalRevenue = (drivewayRevenue + franchiseGross + wholesaleGross + patentRoyalties + copackerNet) * s.brandMultiplier;
    const totalExpenses = franchiseWages + packagingCosts;
    const netProfit = totalRevenue - totalExpenses;

    // Debt safety floor: cash never falls below zero into inescapable debt softlocks
    if (netProfit < 0) {
      const loss = Math.abs(netProfit);
      if (s.cash.lt(loss)) {
        s.cash = BigNum.fromNumber(0);
        notes.push("Operating expenses exceeded cash reserves! Balance hit $0.00.");
      } else {
        s.cash = s.cash.sub(loss);
      }
    } else {
      s.cash = s.cash.add(netProfit);
    }
    const totalCupsToday = drivewayCupsSold + franchiseCupsSold + bottlesSold;
    s.totalCupsSold = s.totalCupsSold.add(totalCupsToday);
    s.totalRevenueEarned = s.totalRevenueEarned.add(totalRevenue);

    // Reputation adjustment (unless mortgage is paid off!)
    if (!s.flags.hasPaidMortgage) {
      s.reputation = Math.max(0.1, Math.min(1.0, s.reputation + (quality - 0.65) * 0.12));
    }

    // Generate Customer Reviews for the day
    const reviews = this.generateCustomerReviews({
      tempF: s.tempF,
      quality,
      pricePerCup: s.recipe.pricePerCup,
      fairPrice,
      drivewayCupsSold,
      franchiseCupsSold,
      soldOutStands
    });

    const summary: DaySummary = {
      day: s.day,
      tempF: s.tempF,
      weather: s.weather,
      drivewayCupsSold,
      drivewayRevenue,
      franchiseCupsSold,
      franchiseGrossRevenue: franchiseGross,
      franchiseWagesPaid: franchiseWages,
      franchiseNet,
      bottlesSold,
      wholesaleRevenue: wholesaleGross,
      packagingCosts,
      wholesaleNet,
      patentUnitsSold,
      patentRoyalties,
      copackerCasesSold,
      copackerNet,
      totalRevenue,
      totalExpenses,
      netProfit,
      recipeQuality: quality,
      reviews,
      notes: notes.length ? notes : ['All operations ran smoothly!']
    };

    s.lastDaySummary = summary;
    s.day += 1;
    s.elapsedSec += 30;

    // Log the top customer review
    if (reviews.length > 0) {
      const r = reviews[0];
      this.log(`Review: ${'★'.repeat(r.stars)} "${r.quote}" — ${r.reviewer}`);
    }

    this.rollNextForecast();
    if (s.currentChore) {
      s.currentChore.remainingSec = 0;
    }

    return summary;
  }

  // ==========================================================================
  // REAL-TIME CLOCK / TIMERS
  // ==========================================================================
  public tick(dt: number): void {
    this.state.elapsedSec += dt;
    if (this.state.currentChore && this.state.currentChore.remainingSec > 0) {
      this.state.currentChore.remainingSec = Math.max(0, this.state.currentChore.remainingSec - dt);
    }
  }

  public manualAction(): void {
    this.doChore();
  }
}

// ============================================================================
// 4. AUTOMATED PACING SIMULATOR
// ============================================================================
export function runHeadlessPacingTest(simDays: number = 35): {
  phase: number;
  totalCups: string;
  cash: string;
  log: string[];
} {
  const engine = new LemonadeEngine();
  const logs: string[] = [];

  for (let d = 1; d <= simDays; d++) {
    const s = engine.state;
    s.recipe.pricePerCup = +(2.00 * (1 + 0.015 * (s.tempF - 70))).toFixed(2);
    s.recipe.icePerCup = engine.computeIdealIce(s.tempF);

    if (s.inv.cups < 60) engine.buySupplies('cups', 2);
    if (s.inv.lemons < 30) engine.buySupplies('lemons', 2);
    if (s.inv.sugar < 25) engine.buySupplies('sugar', 2);
    if (s.inv.ice < 80) engine.buySupplies('ice', 2);
    if (s.phase >= 3 && s.inv.bottles < 40) engine.buySupplies('bottles', 2);

    engine.projects.forEach(p => engine.buyProject(p.id));
    if (s.phase >= 2) {
      Object.keys(engine.franchiseStands).forEach(id => engine.hireFranchiseStand(id));
    }
    if (s.phase >= 3) {
      Object.keys(engine.wholesaleAccounts).forEach(id => engine.signWholesaleAccount(id));
    }

    // Try buying trophies if cash is abundant
    engine.trophies.filter(t => !t.purchased && t.phaseRequired <= s.phase).forEach(t => {
      if (s.cash.gte(t.costCash * 1.5)) {
        engine.buyTrophy(t.id);
      }
    });

    const res = engine.runDay();
    logs.push(`Day ${res.day}: Net Profit +$${res.netProfit.toFixed(2)} | Cash: $${s.cash.format()} | Cups: ${s.totalCupsSold.format()}`);
  }

  return {
    phase: engine.state.phase,
    totalCups: engine.state.totalCupsSold.format(),
    cash: engine.state.cash.format(),
    log: logs
  };
}

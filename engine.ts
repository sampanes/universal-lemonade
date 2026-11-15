// engine.ts — Realistic Scaling Entrepreneur Engine for Universal Lemonade

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
  brandMultiplier: number;

  // Working Capital & Inventory
  cash: BigNum;
  totalCupsSold: BigNum;
  totalRevenueEarned: BigNum;

  inv: {
    lemons: number;
    sugar: number;
    ice: number;
    cups: number;
    bottles: number; // For wholesale (Phase 3+)
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
      brandMultiplier: 1.0,

      cash: BigNum.fromNumber(60.00), // Modern 2020s starting allowance
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
        weatherLocked95F: false
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
        unlocked: (s) => s.phase === 1 && s.cash.gte(100) && s.bestRecipeQuality >= 0.80,
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
    const cooldownSec = 8 + Math.floor(this.rand() * 10);
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
    const catalog = {
      lemons:  { qty: 24,  cost: +(8.00 * discount).toFixed(2) },
      sugar:   { qty: 20,  cost: +(6.00 * discount).toFixed(2) },
      ice:     { qty: 100, cost: +(4.00 * discount).toFixed(2) },
      cups:    { qty: 50,  cost: +(4.00 * discount).toFixed(2) },
      bottles: { qty: 25,  cost: +(10.00 * discount).toFixed(2) }
    }[item];

    const totalCost = catalog.cost * packs;
    if (this.state.cash.lt(totalCost)) return false;

    this.state.cash = this.state.cash.sub(totalCost);
    this.state.inv[item] += catalog.qty * packs;
    return true;
  }

  // ==========================================================================
  // FRANCHISE & WHOLESALE ACTIONS
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
  // MAIN DAILY BUSINESS SIMULATION (P&L EXECUTION)
  // ==========================================================================
  public runDay(): DaySummary {
    const s = this.state;
    const notes: string[] = [];

    const weatherMult = s.weather === 'SUNNY' ? 1.0 : s.weather === 'CLOUDY' ? 0.65 : 0.25;
    const tempFactor = Math.max(0.3, 1 + 0.8 * ((s.tempF - 70) / 30));
    const quality = this.computeRecipeQuality(s.tempF);
    s.bestRecipeQuality = Math.max(s.bestRecipeQuality, quality);

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

    s.inv.cups -= drivewayCupsSold;
    s.inv.ice = Math.max(0, s.inv.ice - drivewayCupsSold * s.recipe.icePerCup);
    s.inv.lemons = Math.max(0, s.inv.lemons - pitchersUsed * s.recipe.lemonsPerPitcher);
    s.inv.sugar = Math.max(0, s.inv.sugar - pitchersUsed * s.recipe.sugarPerPitcher);

    const drivewayRevenue = drivewayCupsSold * s.recipe.pricePerCup;

    // 2. Franchise Stands Execution (Phase 2+)
    let franchiseCupsSold = 0;
    let franchiseGross = 0;
    let franchiseWages = 0;

    if (s.phase >= 2) {
      for (const stand of Object.values(this.franchiseStands)) {
        if (!stand.hired) continue;

        franchiseWages += stand.dailyWage;
        const standTraffic = Math.floor(stand.baseCapacity * Math.pow(weatherMult * tempFactor, stand.weatherSens) * (0.6 + s.reputation * 0.4));
        const standDemand = Math.floor(standTraffic * buyProb);

        // Check remaining inventory
        const remByLemons = Math.floor(s.inv.lemons / Math.max(1, s.recipe.lemonsPerPitcher)) * cupsPerPitcher;
        const remBySugar = Math.floor(s.inv.sugar / Math.max(1, s.recipe.sugarPerPitcher)) * cupsPerPitcher;
        const remByIce = s.recipe.icePerCup > 0 ? Math.floor(s.inv.ice / s.recipe.icePerCup) : Infinity;
        const maxStandPour = Math.min(s.inv.cups, remByLemons, remBySugar, remByIce);

        const sold = Math.min(standDemand, maxStandPour);
        if (sold < standDemand) {
          notes.push(`${stand.workerName} sold out early (ran out of supplies)!`);
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
      for (const acc of Object.values(this.wholesaleAccounts)) {
        if (!acc.active) continue;

        const demand = Math.round(acc.bottlesPerDay * Math.pow(weatherMult, acc.weatherSens));
        // 1 bottle = 0.5 lemon, 0.4 sugar, 1 bottle package
        const maxByL = Math.floor(s.inv.lemons / 0.5);
        const maxByS = Math.floor(s.inv.sugar / 0.4);
        const maxBottles = Math.min(demand, s.inv.bottles, maxByL, maxByS);

        if (maxBottles > 0) {
          s.inv.bottles -= maxBottles;
          s.inv.lemons -= Math.ceil(maxBottles * 0.5);
          s.inv.sugar -= Math.ceil(maxBottles * 0.4);

          bottlesSold += maxBottles;
          wholesaleGross += maxBottles * acc.wholesalePrice;
          packagingCosts += maxBottles * acc.packagingCost;
        } else if (demand > 0) {
          notes.push(`Could not fill wholesale order for ${acc.name} (out of bottles/lemons)!`);
        }
      }
    }
    const wholesaleNet = wholesaleGross - packagingCosts;

    // 4. Patent Royalties (Phase 4+)
    let patentUnitsSold = 0;
    let patentRoyalties = 0;
    if (s.phase >= 4 && this.patent.licensed) {
      patentUnitsSold = Math.round(this.patent.baseUnitsPerDay * (0.8 + this.rand() * 0.4));
      patentRoyalties = patentUnitsSold * this.patent.royaltyPerUnit;
    }

    // 5. Industrial Co-Packing (Phase 5)
    let copackerCasesSold = 0;
    let copackerNet = 0;
    if (s.phase >= 5 && this.copacker.active) {
      copackerCasesSold = Math.round(this.copacker.casesPerDay * (0.85 + this.rand() * 0.3));
      copackerNet = copackerCasesSold * this.copacker.netPerCase;
    }

    // Overnight Spoilage
    if (!s.flags.hasCooler && s.inv.ice > 0) {
      notes.push(`${s.inv.ice} ice cubes melted overnight`);
      s.inv.ice = 0;
    }
    if (!s.flags.hasMiniFridge && s.inv.lemons > 0) {
      const rotted = Math.ceil(s.inv.lemons * 0.20);
      s.inv.lemons -= rotted;
      notes.push(`${rotted} lemons rotted`);
    }

    // P&L Consolidation
    const totalRevenue = drivewayRevenue + franchiseGross + wholesaleGross + patentRoyalties + copackerNet;
    const totalExpenses = franchiseWages + packagingCosts;
    const netProfit = totalRevenue - totalExpenses;

    s.cash = s.cash.add(netProfit);
    const totalCupsToday = drivewayCupsSold + franchiseCupsSold + bottlesSold;
    s.totalCupsSold = s.totalCupsSold.add(totalCupsToday);
    s.totalRevenueEarned = s.totalRevenueEarned.add(totalRevenue);

    // Reputation adjustment
    s.reputation = Math.max(0.1, Math.min(1.0, s.reputation + (quality - 0.65) * 0.12));

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
      notes: notes.length ? notes : ['All operations ran smoothly!']
    };

    s.lastDaySummary = summary;
    s.day += 1;
    s.elapsedSec += 30;
    this.rollNextForecast();
    if (s.currentChore) {
      s.currentChore.remainingSec = 0; // Fresh chore every morning
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
export function runHeadlessPacingTest(simDays: number = 30): {
  phase: number;
  totalCups: string;
  cash: string;
  log: string[];
} {
  const engine = new LemonadeEngine();
  const logs: string[] = [];

  for (let d = 1; d <= simDays; d++) {
    const s = engine.state;
    // Basic bot AI
    s.recipe.pricePerCup = +(2.00 * (1 + 0.015 * (s.tempF - 70))).toFixed(2);
    s.recipe.icePerCup = engine.computeIdealIce(s.tempF);

    // Buy supplies if low
    if (s.inv.cups < 60) engine.buySupplies('cups', 2);
    if (s.inv.lemons < 30) engine.buySupplies('lemons', 2);
    if (s.inv.sugar < 25) engine.buySupplies('sugar', 2);
    if (s.inv.ice < 80) engine.buySupplies('ice', 2);
    if (s.phase >= 3 && s.inv.bottles < 40) engine.buySupplies('bottles', 2);

    // Buy available upgrades & franchise stands
    engine.projects.forEach(p => engine.buyProject(p.id));
    if (s.phase >= 2) {
      Object.keys(engine.franchiseStands).forEach(id => engine.hireFranchiseStand(id));
    }
    if (s.phase >= 3) {
      Object.keys(engine.wholesaleAccounts).forEach(id => engine.signWholesaleAccount(id));
    }

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

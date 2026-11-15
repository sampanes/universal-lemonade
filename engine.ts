// engine.ts — Pure Headless Backend for Universal Lemonade

// ============================================================================
// 1. SELF-CONTAINED BIGNUM (Mantissa * 10^Exponent, up to 10^9,000,000,000)
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
// 2. DATA STRUCTURES & STATE SCHEMA
// ============================================================================
export type WeatherCondition = 'SUNNY' | 'CLOUDY' | 'RAINY';
export type GamePhase = 1 | 2 | 3;

export interface GeneratorDef {
  id: string;
  name: string;
  baseCost: BigNum;
  costGrowth: number;
  baseCupsPerSec: BigNum;
  owned: number;
}

export interface ProjectDef {
  id: string;
  name: string;
  desc: string;
  phase: GamePhase;
  costCash?: number;
  costOps?: number;
  costZest?: number;
  purchased: boolean;
  unlocked: (state: GameState) => boolean;
  effect: (state: GameState) => void;
}

export interface DaySummary {
  day: number;
  tempF: number;
  weather: WeatherCondition;
  footTraffic: number;
  cupsSold: number;
  revenue: number;
  recipeQuality: number;
  spoilageNote: string;
}

export interface ChoreState {
  name: string;
  reward: number;
  cooldownSec: number;
  remainingSec: number;
}

export interface GameState {
  phase: GamePhase;
  elapsedSec: number;

  // Phase 1: Turn-based Stand State
  day: number;
  tempF: number;
  weather: WeatherCondition;
  reputation: number;        // [0.1, 1.0]
  bestRecipeQuality: number; // Carries into Phase 2 as brand multiplier
  brandMultiplier: number;
  inv: {
    lemons: number;
    sugar: number;
    ice: number;
    cups: number;
  };
  recipe: {
    lemonsPerPitcher: number;
    sugarPerPitcher: number;
    icePerCup: number;
    pricePerCup: number;
  };
  flags: {
    hasCooler: boolean;
    hasMiniFridge: boolean;
    hasAutoBuyer: boolean;
    weatherLocked95F: boolean;
  };
  lastDaySummary: DaySummary | null;
  currentChore: ChoreState;

  // Phase 2: Continuous Megacorp State
  cash: BigNum;
  unsoldCups: BigNum;
  totalCupsProduced: BigNum;
  totalCupsSold: BigNum;
  cupsPerSec: BigNum;
  salesPerSec: BigNum;
  marketingLevel: number;
  marketingCost: BigNum;

  // Computing (Universal Paperclips Brain Loop)
  trust: number;
  nextTrustAtCups: BigNum;
  processors: number;
  memory: number;
  ops: number;       // "Sugar Rush"
  maxOps: number;
  zest: number;      // "Creativity"

  // Phase 3: Cosmic Von Neumann State
  probes: BigNum;
  drifters: BigNum;  // "Lime Bandits"
  availableMatter: BigNum;
  totalMatter: BigNum;
  cosmicFactories: BigNum;
  probeAlloc: {
    rep: number;     // Self-replication
    haz: number;     // Hazard mitigation
    harv: number;    // Matter harvesting
    fact: number;    // Factory building
    combat: number;  // Anti-Drifter combat
  };
  goldenSeeds: number;
  logs: string[];
}

// ============================================================================
// 3. O(1) GEOMETRIC SERIES MATH FOR GENERATORS
// ============================================================================
export class GeometricMath {
  static currentCost(base: BigNum, r: number, owned: number): BigNum {
    return base.mul(BigNum.fromNumber(1).mul(new BigNum(1, 0)).add(0).mul(Math.pow(r, owned)));
  }

  static bulkCost(base: BigNum, r: number, owned: number, count: number): BigNum {
    const startCost = base.mul(new BigNum(1, 0).add(0)).mul(
      new BigNum(Math.pow(10, (owned * Math.log10(r)) % 1), Math.floor(owned * Math.log10(r)))
    );
    const factor = (Math.pow(r, count) - 1) / (r - 1);
    return startCost.mul(factor);
  }

  static maxAffordable(cash: BigNum, base: BigNum, r: number, owned: number): number {
    const logStart = base.log10() + owned * Math.log10(r);
    const startCost = new BigNum(Math.pow(10, logStart - Math.floor(logStart)), Math.floor(logStart));
    if (cash.lt(startCost)) return 0;
    const rhs = cash.mul(r - 1).div(startCost).add(1);
    const maxM = Math.floor(rhs.log10() / Math.log10(r));
    return Math.max(0, maxM);
  }
}

// ============================================================================
// 4. CORE SIMULATION ENGINE
// ============================================================================
export class LemonadeEngine {
  public state: GameState;
  public generators: Record<string, GeneratorDef>;
  public projects: ProjectDef[];
  private rngSeed = 1337;

  constructor(goldenSeeds: number = 0) {
    this.generators = this.initGenerators();
    this.projects = this.initProjects();
    this.state = this.createInitialState(goldenSeeds);
    this.rollNextForecast();
    this.rollNextChore();
  }

  private rand(): number {
    // Deterministic xorshift32 for reproducible pacing tests
    let x = this.rngSeed;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    this.rngSeed = x;
    return ((x >>> 0) / 4294967296);
  }

  private createInitialState(goldenSeeds: number): GameState {
    const prestigeMult = 1 + goldenSeeds * 0.5;
    return {
      phase: 1,
      elapsedSec: 0,
      day: 1,
      tempF: 78,
      weather: 'SUNNY',
      reputation: 0.5,
      bestRecipeQuality: 0,
      brandMultiplier: prestigeMult,
      inv: { lemons: 24, sugar: 20, ice: 80, cups: 50 },
      recipe: { lemonsPerPitcher: 4, sugarPerPitcher: 4, icePerCup: 4, pricePerCup: 0.50 },
      flags: { hasCooler: false, hasMiniFridge: false, hasAutoBuyer: false, weatherLocked95F: false },
      lastDaySummary: null,
      currentChore: {
        name: "Mow Neighbor's Lawn",
        reward: 2.00,
        cooldownSec: 8,
        remainingSec: 0
      },

      cash: BigNum.fromNumber(25 * prestigeMult),
      unsoldCups: new BigNum(0, 0),
      totalCupsProduced: new BigNum(0, 0),
      totalCupsSold: new BigNum(0, 0),
      cupsPerSec: new BigNum(0, 0),
      salesPerSec: new BigNum(0, 0),
      marketingLevel: 1,
      marketingCost: BigNum.fromNumber(100),

      trust: 2,
      nextTrustAtCups: BigNum.fromNumber(1000),
      processors: 1,
      memory: 1,
      ops: 0,
      maxOps: 1000,
      zest: 0,

      probes: new BigNum(0, 0),
      drifters: new BigNum(0, 0),
      availableMatter: new BigNum(3, 55), // 3e55 grams (Universal Paperclips scale)
      totalMatter: new BigNum(3, 55),
      cosmicFactories: new BigNum(1, 0),
      probeAlloc: { rep: 0.35, haz: 0.25, harv: 0.20, fact: 0.10, combat: 0.10 },
      goldenSeeds,
      logs: ['Day 1: Opened the driveway stand. Check the forecast and set your recipe!']
    };
  }

  private initGenerators(): Record<string, GeneratorDef> {
    return {
      squeezer: { id: 'squeezer', name: 'Auto-Squeezer', baseCost: BigNum.fromNumber(15), costGrowth: 1.15, baseCupsPerSec: BigNum.fromNumber(1.5), owned: 0 },
      drone:    { id: 'drone',    name: 'Delivery Drone', baseCost: BigNum.fromNumber(150), costGrowth: 1.15, baseCupsPerSec: BigNum.fromNumber(18), owned: 0 },
      orchard:  { id: 'orchard',  name: 'Biodome Orchard', baseCost: BigNum.fromNumber(2500), costGrowth: 1.15, baseCupsPerSec: BigNum.fromNumber(320), owned: 0 },
      synth:    { id: 'synth',    name: 'Molecular Citrus Synth', baseCost: BigNum.fromNumber(50000), costGrowth: 1.14, baseCupsPerSec: BigNum.fromNumber(7500), owned: 0 },
      collider: { id: 'collider', name: 'Hadron Lemon Collider', baseCost: BigNum.fromNumber(1.5e6), costGrowth: 1.14, baseCupsPerSec: BigNum.fromNumber(2.5e5), owned: 0 }
    };
  }

  private initProjects(): ProjectDef[] {
    return [
      {
        id: 'cooler', name: 'Insulated Igloo Cooler',
        desc: 'Stops ice from melting overnight between days.',
        phase: 1, costCash: 15, purchased: false,
        unlocked: (s) => s.phase === 1 && s.day >= 2,
        effect: (s) => { s.flags.hasCooler = true; this.log('Upgrade: Ice no longer melts overnight!'); }
      },
      {
        id: 'fridge', name: 'Garage Mini-Fridge',
        desc: 'Eliminates overnight lemon rot and boosts recipe freshness (+10% Reputation).',
        phase: 1, costCash: 35, purchased: false,
        unlocked: (s) => s.phase === 1 && s.day >= 3,
        effect: (s) => { s.flags.hasMiniFridge = true; s.reputation = Math.min(1, s.reputation + 0.1); }
      },
      {
        id: 'singularity_bot', name: 'THE SQUEEZE-BOT 9000 (Singularity Unlock)',
        desc: 'Automates squeezing and shatters turn-based days into continuous real-time production!',
        phase: 1, costCash: 100, purchased: false,
        unlocked: (s) => s.phase === 1 && s.cash.gte(60) && s.bestRecipeQuality >= 0.85,
        effect: (s) => {
          s.phase = 2;
          s.brandMultiplier = (1 + 2 * s.bestRecipeQuality * s.reputation) * (1 + s.goldenSeeds * 0.5);
          this.generators.squeezer.owned = Math.max(1, this.generators.squeezer.owned);
          this.log(`SINGULARITY UNLOCKED! Brand Multiplier locked at ${s.brandMultiplier.toFixed(2)}x. Continuous clock active.`);
        }
      },
      {
        id: 'auto_supply', name: 'Algorithmic Supply Chain',
        desc: 'Doubles all Phase 2 generator output via automated bulk logistics.',
        phase: 2, costOps: 750, costZest: 25, purchased: false,
        unlocked: (s) => s.phase === 2 && s.totalCupsProduced.gte(250),
        effect: (s) => { s.brandMultiplier *= 2.0; this.log('Project: Algorithmic Supply Chain online (2x output).'); }
      },
      {
        id: 'weather_ray', name: 'Ionospheric Sun-Lock Satellite',
        desc: 'Locks Earth weather at a permanent 95°F Sunny, multiplying public demand by 3x.',
        phase: 2, costOps: 2500, costZest: 150, purchased: false,
        unlocked: (s) => s.phase === 2 && s.totalCupsProduced.gte(25000),
        effect: (s) => {
          s.flags.weatherLocked95F = true;
          s.tempF = 95;
          s.weather = 'SUNNY';
          s.brandMultiplier *= 3.0;
          this.log('Project: Sun-Lock Satellite deployed! Permanent 95°F heatwave.');
        }
      },
      {
        id: 'orbital_probe', name: 'Launch Von Neumann Citrus Probe (Phase 3)',
        desc: 'Converts terrestrial assets into self-replicating space probes to turn the cosmos into lemonade.',
        phase: 2, costOps: 5000, costZest: 500, purchased: false,
        unlocked: (s) => s.phase === 2 && s.totalCupsProduced.gte(1e7),
        effect: (s) => {
          s.phase = 3;
          s.probes = BigNum.fromNumber(10);
          s.cosmicFactories = BigNum.fromNumber(5);
          this.log('PHASE 3: Von Neumann Citrus Probes launched into deep space!');
        }
      }
    ];
  }

  public log(msg: string): void {
    this.state.logs.unshift(`[t=${this.state.elapsedSec.toFixed(0)}s] ${msg}`);
    if (this.state.logs.length > 40) this.state.logs.pop();
  }

  // ==========================================================================
  // PHASE 1: DISCRETE MICROECONOMICS & CHORE SYSTEM
  // ==========================================================================
  private static readonly CHORE_NAMES = [
    "Mow Neighbor's Lawn",
    "Rake Autumn Leaves",
    "Wash Dad's Car",
    "Walk Mrs. Higgins' Dog",
    "Weed the Flowerbed",
    "Clean the Garage",
    "Sort Recycling Cans",
    "Shovel the Walkway",
    "Help Carry Groceries",
    "Sweep the Porch"
  ];

  public rollNextChore(): void {
    const names = LemonadeEngine.CHORE_NAMES;
    const name = names[Math.floor(this.rand() * names.length)];
    // Random reward between $1.25 and $3.50 in 25-cent steps
    const rewardSteps = Math.floor(this.rand() * 10);
    const reward = +(1.25 + rewardSteps * 0.25).toFixed(2);
    // Random cooldown between 7 and 16 seconds
    const cooldownSec = 7 + Math.floor(this.rand() * 10);
    this.state.currentChore = {
      name,
      reward,
      cooldownSec,
      remainingSec: 0
    };
  }

  public doChore(): { name: string; reward: number } | null {
    if (this.state.phase !== 1) return null;
    const chore = this.state.currentChore;
    if (chore.remainingSec > 0) return null;

    const reward = chore.reward;
    const name = chore.name;
    this.state.cash = this.state.cash.add(reward);
    this.log(`Did Chore: ${name} (Earned +$${reward.toFixed(2)})`);

    const cd = chore.cooldownSec;
    this.rollNextChore();
    this.state.currentChore.remainingSec = cd;
    return { name, reward };
  }

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
    // Gaussian Radial Basis Function
    const distSq = 0.08 * Math.pow(L - idealL, 2) + 0.08 * Math.pow(S - idealS, 2) + 0.12 * Math.pow(I - idealI, 2);
    return Math.exp(-distSq);
  }

  public buyPhase1Supplies(item: 'lemons' | 'sugar' | 'ice' | 'cups', packs: number = 1): boolean {
    const catalog = {
      lemons: { qty: 24, cost: 2.00 },
      sugar:  { qty: 20, cost: 1.50 },
      ice:    { qty: 100, cost: 1.00 },
      cups:   { qty: 50, cost: 1.00 }
    }[item];
    const totalCost = catalog.cost * packs;
    if (this.state.cash.lt(totalCost)) return false;
    this.state.cash = this.state.cash.sub(totalCost);
    this.state.inv[item] += catalog.qty * packs;
    return true;
  }

  public runPhase1Day(): DaySummary {
    const s = this.state;
    const weatherMult = s.weather === 'SUNNY' ? 1.0 : s.weather === 'CLOUDY' ? 0.65 : 0.25;
    const tempFactor = Math.max(0.3, 1 + 0.8 * ((s.tempF - 70) / 30));
    const footTraffic = Math.floor(65 * weatherMult * tempFactor * (0.5 + s.reputation));

    const quality = this.computeRecipeQuality(s.tempF);
    s.bestRecipeQuality = Math.max(s.bestRecipeQuality, quality);

    // Fair price scales with temperature
    const fairPrice = 0.50 * (1 + 0.02 * (s.tempF - 70));
    const priceRatio = fairPrice / Math.max(0.05, s.recipe.pricePerCup);
    const buyProb = Math.max(0, Math.min(1, quality * Math.pow(priceRatio, 1.8)));

    const demandedCups = Math.floor(footTraffic * buyProb);

    // Limiting reagent math (1 pitcher = 10 + icePerCup cups)
    const cupsPerPitcher = 10 + s.recipe.icePerCup;
    const maxByLemons = Math.floor(s.inv.lemons / Math.max(1, s.recipe.lemonsPerPitcher)) * cupsPerPitcher;
    const maxBySugar = Math.floor(s.inv.sugar / Math.max(1, s.recipe.sugarPerPitcher)) * cupsPerPitcher;
    const maxByIce = s.recipe.icePerCup > 0 ? Math.floor(s.inv.ice / s.recipe.icePerCup) : Infinity;
    const maxPourable = Math.min(s.inv.cups, maxByLemons, maxBySugar, maxByIce);

    const cupsSold = Math.min(demandedCups, maxPourable);
    const pitchersUsed = Math.ceil(cupsSold / cupsPerPitcher);

    // Deduct inventory
    s.inv.cups -= cupsSold;
    s.inv.ice -= cupsSold * s.recipe.icePerCup;
    s.inv.lemons = Math.max(0, s.inv.lemons - pitchersUsed * s.recipe.lemonsPerPitcher);
    s.inv.sugar = Math.max(0, s.inv.sugar - pitchersUsed * s.recipe.sugarPerPitcher);

    const revenue = cupsSold * s.recipe.pricePerCup;
    s.cash = s.cash.add(revenue);
    s.totalCupsProduced = s.totalCupsProduced.add(cupsSold);
    s.totalCupsSold = s.totalCupsSold.add(cupsSold);

    // Update reputation based on recipe quality
    s.reputation = Math.max(0.1, Math.min(1.0, s.reputation + (quality - 0.65) * 0.15));

    // Overnight Spoilage
    const notes: string[] = [];
    if (!s.flags.hasCooler && s.inv.ice > 0) {
      notes.push(`${s.inv.ice} ice melted`);
      s.inv.ice = 0;
    }
    if (!s.flags.hasMiniFridge && s.inv.lemons > 0) {
      const rotted = Math.ceil(s.inv.lemons * 0.25);
      s.inv.lemons -= rotted;
      notes.push(`${rotted} lemons rotted`);
    }

    const summary: DaySummary = {
      day: s.day,
      tempF: s.tempF,
      weather: s.weather,
      footTraffic,
      cupsSold,
      revenue,
      recipeQuality: quality,
      spoilageNote: notes.length ? notes.join(', ') : 'Zero spoilage!'
    };

    s.lastDaySummary = summary;
    s.day += 1;
    s.elapsedSec += 30; // Each discrete day represents ~30s of active play pacing
    this.rollNextForecast();
    if (s.currentChore) {
      s.currentChore.remainingSec = 0; // New day brings ready chore
    }
    return summary;
  }

  // ==========================================================================
  // PHASE 2 & 3: CONTINUOUS REAL-TIME TICK (dt in seconds)
  // ==========================================================================
  public tick(dt: number): void {
    const s = this.state;
    s.elapsedSec += dt;

    if (s.phase === 1) {
      if (s.currentChore && s.currentChore.remainingSec > 0) {
        s.currentChore.remainingSec = Math.max(0, s.currentChore.remainingSec - dt);
      }
      return;
    }

    // 1. Computing Loop: Processors -> Ops (Sugar Rush), Memory -> Cap + Zest
    s.maxOps = s.memory * 1000;
    const opsPerSec = s.processors * 18;
    if (s.ops < s.maxOps) {
      s.ops = Math.min(s.maxOps, s.ops + opsPerSec * dt);
    } else {
      // Overflow compute turns into Creativity (Zest)
      s.zest += s.processors * 2.5 * dt;
    }

    // 2. Check Trust Milestones (Fibonacci-like logarithmic progression)
    while (s.totalCupsProduced.gte(s.nextTrustAtCups)) {
      s.trust += 1;
      s.nextTrustAtCups = s.nextTrustAtCups.mul(2.6);
      this.log(`Trust Milestone +1! Total Trust: ${s.trust}`);
    }

    if (s.phase === 2) {
      this.tickPhase2(dt);
    } else if (s.phase === 3) {
      this.tickPhase3(dt);
    }
  }

  private tickPhase2(dt: number): void {
    const s = this.state;
    // Sum generator production
    let prodPerSec = new BigNum(0, 0);
    for (const key of Object.keys(this.generators)) {
      const g = this.generators[key];
      if (g.owned > 0) {
        // Synergy bonus: +2% per owned unit
        const unitSynergy = 1 + g.owned * 0.02;
        prodPerSec = prodPerSec.add(g.baseCupsPerSec.mul(g.owned * unitSynergy * s.brandMultiplier));
      }
    }
    s.cupsPerSec = prodPerSec;

    const producedThisTick = prodPerSec.mul(dt);
    s.unsoldCups = s.unsoldCups.add(producedThisTick);
    s.totalCupsProduced = s.totalCupsProduced.add(producedThisTick);

    // Continuous Public Demand & Price Elasticity
    const fairPrice = 0.35;
    const priceRatio = fairPrice / Math.max(0.02, s.recipe.pricePerCup);
    const mktBoost = Math.pow(1.25, s.marketingLevel - 1);
    const demandPerSec = BigNum.fromNumber(8 * s.brandMultiplier * mktBoost * Math.pow(priceRatio, 1.8));

    const actualSales = s.unsoldCups.lt(demandPerSec.mul(dt))
      ? s.unsoldCups.clone()
      : demandPerSec.mul(dt);

    s.unsoldCups = s.unsoldCups.sub(actualSales);
    s.totalCupsSold = s.totalCupsSold.add(actualSales);
    s.salesPerSec = actualSales.div(Math.max(1e-4, dt));
    s.cash = s.cash.add(actualSales.mul(s.recipe.pricePerCup));
  }

  private tickPhase3(dt: number): void {
    const s = this.state;
    const { rep, haz, harv, fact, combat } = s.probeAlloc;

    // 1. Coupled ODE: Self-Replication vs Hazards vs Value Drift
    const repRate = 0.45 * rep;
    const hazardLossRate = Math.max(0, 0.22 - haz * 0.9);
    const driftRate = 0.04 * Math.pow(rep, 2);
    const netGrowthRate = repRate - hazardLossRate - driftRate;

    if (s.availableMatter.gt(0)) {
      const deltaProbes = s.probes.mul(netGrowthRate * dt);
      s.probes = s.probes.add(deltaProbes);
      if (s.probes.lt(1)) s.probes = BigNum.fromNumber(1);

      const newDrifters = s.probes.mul(driftRate * dt);
      s.drifters = s.drifters.add(newDrifters);
    }

    // 2. Lanchester's Law Space Combat against Lime Bandits (Drifters)
    if (s.drifters.gt(1) && combat > 0) {
      const probeKills = s.probes.mul(combat * 0.35 * dt);
      const drifterKills = s.drifters.mul(0.05 * dt);
      s.drifters = s.drifters.gt(probeKills) ? s.drifters.sub(probeKills) : new BigNum(0, 0);
      s.probes = s.probes.gt(drifterKills) ? s.probes.sub(drifterKills) : BigNum.fromNumber(1);
    }

    // 3. Cosmic Matter Harvesting & Exponential Cup Conversion
    const matterHarvested = s.probes.mul(harv * 1e12 * dt);
    const actualHarvest = s.availableMatter.gt(matterHarvested) ? matterHarvested : s.availableMatter.clone();
    s.availableMatter = s.availableMatter.sub(actualHarvest);

    const newFactories = s.probes.mul(fact * 0.05 * dt);
    s.cosmicFactories = s.cosmicFactories.add(newFactories);

    const cosmicCupsPerSec = s.cosmicFactories.mul(actualHarvest.div(Math.max(1e-4, dt))).mul(1e3);
    s.cupsPerSec = cosmicCupsPerSec;
    s.totalCupsProduced = s.totalCupsProduced.add(cosmicCupsPerSec.mul(dt));
    s.totalCupsSold = s.totalCupsProduced.clone();
  }

  // ==========================================================================
  // PLAYER ACTIONS (GENERATOR BUY, PROJECTS, MANUAL CLICK)
  // ==========================================================================
  public manualSqueeze(): void {
    const s = this.state;
    if (s.phase === 1) {
      this.doChore();
    } else {
      const clickPower = s.cupsPerSec.mul(0.1).add(1);
      s.unsoldCups = s.unsoldCups.add(clickPower);
      s.totalCupsProduced = s.totalCupsProduced.add(clickPower);
    }
  }

  public buyGenerator(id: string, count: number | 'MAX' = 1): number {
    const g = this.generators[id];
    if (!g) return 0;
    const toBuy = count === 'MAX'
      ? GeometricMath.maxAffordable(this.state.cash, g.baseCost, g.costGrowth, g.owned)
      : count;
    if (toBuy <= 0) return 0;
    const cost = GeometricMath.bulkCost(g.baseCost, g.costGrowth, g.owned, toBuy);
    if (this.state.cash.lt(cost)) return 0;
    this.state.cash = this.state.cash.sub(cost);
    g.owned += toBuy;
    return toBuy;
  }

  public buyProject(id: string): boolean {
    const p = this.projects.find((x) => x.id === id);
    if (!p || p.purchased || !p.unlocked(this.state)) return false;
    if (p.costCash && this.state.cash.lt(p.costCash)) return false;
    if (p.costOps && this.state.ops < p.costOps) return false;
    if (p.costZest && this.state.zest < p.costZest) return false;

    if (p.costCash) this.state.cash = this.state.cash.sub(p.costCash);
    if (p.costOps) this.state.ops -= p.costOps;
    if (p.costZest) this.state.zest -= p.costZest;
    p.purchased = true;
    p.effect(this.state);
    return true;
  }

  public setProbeAlloc(alloc: Partial<GameState['probeAlloc']>): void {
    Object.assign(this.state.probeAlloc, alloc);
  }
}

export function runHeadlessPacingTest(simSeconds: number = 300): {
  phase: number;
  totalCups: string;
  cash: string;
  log: string[];
} {
  const engine = new LemonadeEngine();
  const logs: string[] = [];

  // Phase 1 fast simulation
  for (let d = 1; d <= 30; d++) {
    if (engine.state.phase > 1) break;
    const s = engine.state;
    s.recipe.lemonsPerPitcher = 4;
    s.recipe.sugarPerPitcher = 4;
    s.recipe.icePerCup = engine.computeIdealIce(s.tempF);
    s.recipe.pricePerCup = +(0.50 * (1 + 0.015 * (s.tempF - 70))).toFixed(2);

    if (s.inv.cups < 60) engine.buyPhase1Supplies('cups', 1);
    if (s.inv.lemons < 24) engine.buyPhase1Supplies('lemons', 1);
    if (s.inv.sugar < 20) engine.buyPhase1Supplies('sugar', 1);
    if (s.inv.ice < 60) engine.buyPhase1Supplies('ice', 1);

    engine.projects.forEach(p => engine.buyProject(p.id));
    const summary = engine.runPhase1Day();
    logs.push(`Day ${summary.day}: Sold ${summary.cupsSold}/${summary.footTraffic} cups ($${summary.revenue.toFixed(2)}) | Cash: $${s.cash.format()}`);
    engine.projects.forEach(p => engine.buyProject(p.id));
  }

  // Phase 2 & 3 continuous tick
  const dt = 1.0;
  for (let t = 0; t < simSeconds; t += dt) {
    engine.tick(dt);
    engine.projects.forEach(p => engine.buyProject(p.id));
    Object.keys(engine.generators).forEach(id => engine.buyGenerator(id, 'MAX'));
    const s = engine.state;
    if (s.trust > s.processors + s.memory) {
      if (s.memory <= s.processors) s.memory++; else s.processors++;
    }
  }

  return {
    phase: engine.state.phase,
    totalCups: engine.state.totalCupsProduced.format(),
    cash: engine.state.cash.format(),
    log: logs
  };
}
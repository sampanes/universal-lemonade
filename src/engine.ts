// src/engine.ts -- Lemonade Business Simulation Engine Facade & API
import { BigNum } from './bignum';
import type {
  GameState,
  GamePhase,
  FranchiseStand,
  WholesaleAccount,
  PatentSystem,
  CoPackerSystem,
  ProjectDef,
  LifestyleTrophy,
  CustomerReview,
  DailyDemandEstimate,
  KidDemandAdvice,
  PourableCapacity,
  RecipeProfile,
  DaySummary,
  MoneyLedger,
  SupplyItem,
  SeasonInfo,
  StoreDayResult
} from './types';

import { rollChore } from './data/chores';
import { createInitialFranchiseStands } from './data/franchise';
import { createInitialWholesaleAccounts } from './data/wholesale';
import { createInitialProjects, SQUEEZER_LEVELS, applySqueezerLevel } from './data/projects';
import { createInitialTrophies } from './data/trophies';
import { HOUSE_STEPS, HOUSE_COLORS, FIRST_HOUSE_COLOR, type HouseStep } from './data/house';
import { rollWeatherForecast, computeIdealIce, getSeasonInfo } from './simulation/weather';
import { iceHint, crowdLevel, type IceHint } from './simulation/hints';
import { computeRecipeQuality, getRecipeProfile } from './simulation/recipe';
import { getDailyDemandEstimate, getKidDemandAdvice, getMaxPourableCups } from './simulation/demand';
import { generateDailyReviews } from './simulation/reviews';
import { ewma, dailyCustomerScore, nextReputation, nextBuzz, reputationTrend } from './simulation/reputation';
import { allocateStandSales, computeDayDemand, storeDemand } from './simulation/demand';
import { cupsPerPitcher as pitcherCups, rollGoldenRecipe } from './simulation/recipe';
import { BALANCE, type Balance } from './balance';
import { storageCap, storageName, storageUpgradeHint } from './simulation/storage';

export { BigNum } from './bignum';
export * from './types';
export { BALANCE } from './balance';
export type { Balance } from './balance';

export interface EngineOptions {
  // Seeds the random number generator (weather, chores, review picks). Two engines with
  // the same seed and the same player actions play out identically. Default 1337.
  seed?: number;
  // Tuning numbers; defaults to src/balance.ts. The simulator passes variations here.
  balance?: Balance;
}

export const DEFAULT_SEED = 1337;

// Bump when a save from an older version can no longer be loaded as-is.
export const SAVE_VERSION = 2;

export interface EngineSave {
  v: number;
  seed: number;
  rngSeed: number;
  state: GameState;
  projects: string[];
  trophies: string[];
  franchiseStands: Record<string, FranchiseStand>;
  wholesaleAccounts: Record<string, WholesaleAccount>;
  patent: PatentSystem;
  copacker: CoPackerSystem;
}

// The project bought in each stage that opens the next one (src/data/projects.ts).
const PHASE_OPENERS: Record<number, string> = {
  1: 'franchise_license',
  2: 'bottling_rig',
  3: 'patent_filing',
  4: 'copacker_deal',
};

// Dad Mode stage jump: at least this much cash and this many cups sold on arrival. Rough
// amounts for a fresh start in each stage (enough to hire or sign the first thing, not
// enough to open the stage after it right away).
const DAD_JUMP_ARRIVAL: Record<number, { cash: number; cups: number }> = {
  2: { cash: 200, cups: 120 },
  3: { cash: 600, cups: 1500 },
  4: { cash: 2500, cups: 6000 },
  5: { cash: 12000, cups: 20000 },
};

export class LemonadeEngine {
  public state: GameState;
  public projects: ProjectDef[];
  public trophies: LifestyleTrophy[];
  public franchiseStands: Record<string, FranchiseStand>;
  public wholesaleAccounts: Record<string, WholesaleAccount>;
  public patent: PatentSystem;
  public copacker: CoPackerSystem;
  public readonly balance: Balance;
  public readonly seed: number;
  private rngSeed: number;

  constructor(options: EngineOptions = {}) {
    this.balance = options.balance ?? BALANCE;
    // xorshift32 needs a non-zero 32-bit state.
    this.seed = (options.seed ?? DEFAULT_SEED) | 0 || DEFAULT_SEED;
    this.rngSeed = this.seed;
    const b = this.balance;
    this.franchiseStands = createInitialFranchiseStands();
    this.wholesaleAccounts = createInitialWholesaleAccounts();
    this.patent = { licensed: false, royaltyPerUnit: b.patent.royaltyPerUnit, baseUnitsPerDay: b.patent.baseUnitsPerDay, level: 1 };
    this.copacker = { active: false, casesPerDay: b.copacker.casesPerDay, netPerCase: b.copacker.netPerCase };
    this.projects = createInitialProjects();
    this.trophies = createInitialTrophies();
    this.state = this.createInitialState();
    this.rollNextForecast();
    this.rollNextChore();
  }

  // ---- Saving ----
  // A save is plain JSON: the game state, which upgrades and treats were bought, and the
  // franchise, wholesale, patent and co-packer details (upgrades change those in place, so
  // they are saved as they are rather than replayed). Loading starts from a fresh engine and
  // lays the save on top, so anything a newer version of the game adds gets its default.
  public toSave(): EngineSave {
    return {
      v: SAVE_VERSION,
      seed: this.seed,
      rngSeed: this.rngSeed,
      state: this.state,
      projects: this.projects.filter(p => p.purchased).map(p => p.id),
      trophies: this.trophies.filter(t => t.purchased).map(t => t.id),
      franchiseStands: this.franchiseStands,
      wholesaleAccounts: this.wholesaleAccounts,
      patent: this.patent,
      copacker: this.copacker,
    };
  }

  // null when the save is missing pieces or from an unknown version (start a new game then).
  public static fromSave(raw: unknown, options: Omit<EngineOptions, 'seed'> = {}): LemonadeEngine | null {
    const d = raw as EngineSave;
    if (!d || d.v !== SAVE_VERSION || typeof d.seed !== 'number' || !d.state || typeof d.state !== 'object') return null;
    const e = new LemonadeEngine({ ...options, seed: d.seed });
    const fresh = e.state;
    const big = (x: unknown, fallback: BigNum) => {
      const o = x as { m?: unknown; e?: unknown } | null;
      return o && typeof o.m === 'number' && typeof o.e === 'number' ? new BigNum(o.m, o.e) : fallback;
    };
    e.state = {
      ...fresh,
      ...d.state,
      flags: { ...fresh.flags, ...d.state.flags },
      inv: { ...fresh.inv, ...d.state.inv },
      recipe: { ...fresh.recipe, ...d.state.recipe },
      cash: big(d.state.cash, fresh.cash),
      totalCupsSold: big(d.state.totalCupsSold, fresh.totalCupsSold),
      totalRevenueEarned: big(d.state.totalRevenueEarned, fresh.totalRevenueEarned),
    };
    e.rngSeed = (d.rngSeed | 0) || e.seed;
    const bought = new Set(d.projects || []);
    e.projects.forEach(p => { p.purchased = bought.has(p.id); });
    const treats = new Set(d.trophies || []);
    e.trophies.forEach(t => { t.purchased = treats.has(t.id); });
    for (const [id, st] of Object.entries(d.franchiseStands || {})) {
      if (e.franchiseStands[id]) Object.assign(e.franchiseStands[id], st);
    }
    for (const [id, w] of Object.entries(d.wholesaleAccounts || {})) {
      const account = e.wholesaleAccounts[id];
      if (!account) continue;
      account.active = !!w.active;
      account.level = account.active ? Math.max(1, Math.min(account.levels.length, w.level)) : 0;
      account.bottlesPerDay = account.levels[Math.max(0, account.level - 1)].bottlesPerDay;
    }
    Object.assign(e.patent, d.patent || {});
    // Squeezer steps: a save from before the four steps has at most "worldwide" (its old
    // level 2). Owning a step means owning the ones before it; the step's sales and royalty
    // come from SQUEEZER_LEVELS, not the save.
    const oldSave = d.state.totalSqueezersSold == null;
    if (oldSave && e.patent.level >= 2) e.patent.level = 1;
    for (const step of SQUEEZER_LEVELS) {
      const p = step.project ? e.projects.find(x => x.id === step.project) : null;
      if (p && p.purchased) {
        SQUEEZER_LEVELS.slice(1, step.level - 1).forEach(prev => { const q = e.projects.find(x => x.id === prev.project); if (q) q.purchased = true; });
        e.patent.level = Math.max(e.patent.level, step.level);
      }
    }
    if (e.patent.licensed) applySqueezerLevel(e.patent, e.patent.level);
    // Lifetime squeezer sales: older saves counted up to 100 (or nothing at all).
    if (oldSave) {
      const counted = (d.state as { squeezersTowardLicense?: number }).squeezersTowardLicense;
      e.state.totalSqueezersSold = typeof counted === 'number' ? counted : (e.patent.licensed ? SQUEEZER_LEVELS[1].salesRequired : 0);
    }
    delete (e.state as { squeezersTowardLicense?: number }).squeezersTowardLicense;
    Object.assign(e.copacker, d.copacker || {});
    // The house had six steps for a while; keep a save from then inside the four.
    e.state.houseLevel = Math.max(0, Math.min(HOUSE_STEPS.length, e.state.houseLevel ?? 0));
    if (e.state.houseLevel >= 1 && !HOUSE_COLORS.some(c => c.id === e.state.houseColor)) e.state.houseColor = FIRST_HOUSE_COLOR;
    // Saves from before the profit total: estimate it as the cash gained plus everything spent
    // on upgrades, hiring and prizes (chore money is counted in too; there is no record of it).
    if (typeof e.state.grossProfitTotal !== 'number') {
      const spent = e.projects.filter(p => p.purchased).reduce((a, p) => a + p.costCash, 0)
        + e.trophies.filter(t => t.purchased).reduce((a, t) => a + t.costCash, 0)
        + Object.values(e.franchiseStands).filter(st => st.hired).reduce((a, st) => a + st.setupCost, 0)
        + Object.values(e.wholesaleAccounts).filter(w => w.active).reduce((a, w) => a + w.setupCost, 0);
      e.state.grossProfitTotal = e.state.cash.toNumber() - e.balance.start.cash + spent;
    }
    return e;
  }

  public rand(): number {
    let x = this.rngSeed;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    this.rngSeed = x;
    return ((x >>> 0) / 4294967296);
  }

  private createInitialState(): GameState {
    const start = this.balance.start;
    return {
      phase: 1,
      elapsedSec: 0,
      day: 1,
      tempF: 78,
      weather: 'SUNNY',
      reputation: start.reputation,
      buzz: this.balance.buzz.start,
      bestRecipeQuality: 0,
      avgRecipeQuality: 0,
      totalQualityDays: 0,
      totalQualitySum: 0,
      brandMultiplier: 1.0,
      gameWon: false,

      cash: BigNum.fromNumber(start.cash),
      totalCupsSold: new BigNum(0, 0),
      totalRevenueEarned: new BigNum(0, 0),
      totalBottlesSold: 0,
      totalSqueezersSold: 0,
      houseLevel: 0,
      totalStandCupsSold: 0,

      inv: { ...start.inventory },
      recipe: { ...start.recipe },
      goldenRecipe: rollGoldenRecipe(this.seed, this.balance),
      goldenStreak: 0,
      recipeLocked: false,

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
        reward: 11.00,
        cooldownSec: 10,
        remainingSec: 0
      },
      choresToday: 0,
      lastDaySummary: null,
      logs: ['Day 1: Opened the driveway stand! Check the forecast and set your recipe.']
    };
  }

  // Today's money diary (created on first use).
  public get ledger(): MoneyLedger {
    const s = this.state;
    if (!s.ledger || s.ledger.day !== s.day) s.ledger = emptyLedger(s.day);
    return s.ledger;
  }

  public log(msg: string): void {
    this.state.logs.unshift(`[Day ${this.state.day}] ${msg}`);
    if (this.state.logs.length > 50) this.state.logs.pop();
  }

  // Chore Actions
  public rollNextChore(): void {
    this.state.currentChore = rollChore(() => this.rand(), this.state.flags.hasSkateboard, this.balance);
  }

  public doChore(): { name: string; reward: number } | null {
    const chore = this.state.currentChore;
    if (chore.remainingSec > 0) return null;

    const reward = chore.reward;
    const name = chore.name;
    this.state.cash = this.state.cash.add(reward);
    this.ledger.chores += reward;
    this.log(`Completed chore: ${name} (Earned +$${reward.toFixed(2)})`);

    // The more chores today, the longer the rest before the next one (resets each new day).
    this.state.choresToday = (this.state.choresToday ?? 0) + 1;
    const cd = chore.cooldownSec * Math.pow(this.balance.chores.cooldownGrowth, this.state.choresToday - 1);
    this.rollNextChore();
    this.state.currentChore.remainingSec = cd;
    return { name, reward };
  }

  // Supply Actions
  // What one pack of an item holds and costs right now, after upgrades.
  public supplyPack(item: SupplyItem): { qty: number; cost: number } {
    const b = this.balance;
    const discount = this.state.flags.hasCostcoDiscount ? b.costcoPriceMult : 1.0;
    const bikeBonus = this.state.flags.hasMountainBike ? b.bikePackMult : 1.0;
    const base = b.supplies[item];
    let mult = discount;
    if (item === 'bottles') {
      if (this.state.flags.hasCommercialLabeler) mult *= b.wholesale.labelerBottleMult;
      if (this.state.flags.hasHondaCivic) mult *= b.wholesale.civicPackagingMult;
    }
    return { qty: Math.round(base.qty * bikeBonus), cost: +(base.cost * mult).toFixed(2) };
  }

  // How much the stand can hold of an item (Infinity = no limit). See src/simulation/storage.ts.
  public storageCap(item: SupplyItem): number {
    return storageCap(this.state, item, this.balance);
  }

  // What tapping buy would get right now: whole packs, or only the part that still fits
  // (a part pack costs its share, rounded to the cent). qty 0 means storage is full.
  public buyOffer(item: SupplyItem, packs: number = 1): { qty: number; cost: number; full: boolean } {
    const pack = this.supplyPack(item);
    const room = Math.max(0, this.storageCap(item) - this.state.inv[item]);
    const qty = Math.min(pack.qty * packs, room);
    const cost = qty === pack.qty * packs ? +(pack.cost * packs).toFixed(2) : +(pack.cost * qty / pack.qty).toFixed(2);
    return { qty, cost, full: room <= 0 };
  }

  public buySupplies(item: SupplyItem, packs: number = 1): boolean {
    if (!this.balance.supplies[item]) return false;
    const { qty, cost } = this.buyOffer(item, packs);
    if (qty <= 0 || this.state.cash.lt(cost)) return false;

    this.state.cash = this.state.cash.sub(cost);
    this.state.inv[item] += qty;
    this.ledger.supplies[item] += cost;
    return true;
  }

  // Sales since the last expansion prevent saved cash from skipping the work.
  public friendExpansionGoal(): { remaining: number; days: number } {
    const last = this.state.friendExpansion;
    if (!last) return { remaining: 0, days: 0 };
    const hired = Object.values(this.franchiseStands).filter(st => st.hired).length;
    const target = this.balance.expansion.friendCups[Math.min(Math.max(0, hired - 1), this.balance.expansion.friendCups.length - 1)];
    return { remaining: Math.max(0, Math.ceil(target - (this.state.totalStandCupsSold - last.cups))),
      days: Math.max(0, last.day + this.balance.expansion.daysBetween - this.state.day) };
  }

  public storeExpansionGoal(): { remaining: number; days: number } {
    const last = this.state.storeExpansion;
    if (!last) return { remaining: 0, days: 0 };
    return { remaining: Math.max(0, Math.ceil(this.balance.expansion.storeBottles - (this.state.totalBottlesSold - last.bottles))),
      days: Math.max(0, last.day + this.balance.expansion.daysBetween - this.state.day) };
  }

  // Franchise & Wholesale Actions
  public hireFranchiseStand(id: string): boolean {
    const stand = this.franchiseStands[id];
    const goal = this.friendExpansionGoal();
    if (this.state.phase < 2 || !stand || stand.hired || goal.remaining || goal.days || this.state.cash.lt(stand.setupCost)) return false;

    this.state.cash = this.state.cash.sub(stand.setupCost);
    this.ledger.hiring += stand.setupCost;
    stand.hired = true;
    this.state.friendExpansion = { day: this.state.day, cups: this.state.totalStandCupsSold };
    this.log(`Hired ${stand.workerName} for ${stand.name}! ($${stand.setupCost} setup, $${stand.dailyWage}/day wage)`);
    return true;
  }

  // A hired friend stays off (or working) until the player toggles them again.
  // Friends who are off sell nothing and are not paid.
  public toggleFriendDayOff(id: string): boolean {
    const stand = this.franchiseStands[id];
    if (!stand || !stand.hired) return false;
    stand.dayOff = !stand.dayOff;
    return true;
  }

  public signWholesaleAccount(id: string): boolean {
    const account = this.wholesaleAccounts[id];
    const goal = this.storeExpansionGoal();
    if (this.state.phase < 3 || !account || account.active || goal.remaining || goal.days || this.state.cash.lt(account.setupCost)) return false;

    this.state.cash = this.state.cash.sub(account.setupCost);
    this.ledger.hiring += account.setupCost;
    account.active = true;
    account.level = 1;
    account.bottlesPerDay = account.levels[0].bottlesPerDay;
    this.state.storeExpansion = { day: this.state.day, bottles: this.state.totalBottlesSold };
    this.log(`Signed wholesale contract with ${account.name}!`);
    return true;
  }

  public upgradeWholesaleAccount(id: string): boolean {
    const account = this.wholesaleAccounts[id];
    if (this.state.phase < 3 || !account || !account.active) return false;
    const next = account.levels[account.level];
    const goal = this.storeExpansionGoal();
    if (!next || goal.remaining || goal.days || this.state.cash.lt(next.cost)) return false;
    this.state.cash = this.state.cash.sub(next.cost);
    this.ledger.storeUpgrades = (this.ledger.storeUpgrades ?? 0) + next.cost;
    account.level += 1;
    account.bottlesPerDay = next.bottlesPerDay;
    this.state.storeExpansion = { day: this.state.day, bottles: this.state.totalBottlesSold };
    this.log(`Expanded ${account.name} to level ${account.level}.`);
    return true;
  }

  // The family house (src/data/house.ts): the next step to buy, or null when all are bought.
  public nextHouseStep(): HouseStep | null {
    return HOUSE_STEPS[this.state.houseLevel ?? 0] ?? null;
  }

  public buyHouseStep(): boolean {
    const step = this.nextHouseStep();
    if (!step || this.state.phase < step.phase || this.state.cash.lt(step.cost)) return false;
    this.state.cash = this.state.cash.sub(step.cost);
    this.ledger.house = (this.ledger.house ?? 0) + step.cost;
    this.state.houseLevel = (this.state.houseLevel ?? 0) + 1;
    if (step.id === 'paint') this.state.houseColor = FIRST_HOUSE_COLOR;
    this.log(`House: ${step.name}!`);
    return true;
  }

  // Repaint the house (free, any time after Fresh Paint).
  public setHouseColor(id: string): boolean {
    if ((this.state.houseLevel ?? 0) < 1 || !HOUSE_COLORS.some(c => c.id === id)) return false;
    this.state.houseColor = id;
    return true;
  }

  public buyProject(id: string): boolean {
    const p = this.projects.find(x => x.id === id);
    if (!p || p.purchased || !p.unlocked(this.state) || this.state.cash.lt(p.costCash)) return false;

    this.state.cash = this.state.cash.sub(p.costCash);
    this.ledger.shop += p.costCash;
    this.ledger.shopIds.push(p.id);
    this.state.lastShopPurchaseDay = this.state.day;
    p.purchased = true;
    p.effect(this);
    return true;
  }

  // Dad Mode testing: skip ahead to the start of a later stage without playing to it. The
  // game ends up as if it had been played there: the stand upgrades bought, the recipe
  // locked golden, and every stage passed on the way finished (its upgrades bought, its
  // friends hired, its stores signed). The target stage itself starts fresh. Nothing is
  // charged and the money diary is untouched; cash and cups sold are raised to what a
  // player usually has on arriving.
  public dadJumpToPhase(target: GamePhase): boolean {
    const s = this.state;
    if (target <= s.phase || target > 5) return false;
    const giveFree = (p: ProjectDef) => { if (!p.purchased) { p.purchased = true; p.effect(this); } };

    for (const p of this.projects) if (p.phase === 1 && p.id !== 'franchise_license') giveFree(p);
    s.recipe.lemonsPerPitcher = s.goldenRecipe.lemons;
    s.recipe.sugarPerPitcher = s.goldenRecipe.sugar;
    s.goldenStreak = Math.max(s.goldenStreak ?? 0, this.balance.recipe.lockStreak);
    s.recipeLocked = true;
    s.bestRecipeQuality = 1;
    s.avgRecipeQuality = Math.max(s.avgRecipeQuality || 0, 0.95);
    s.reputation = Math.max(s.reputation, 0.85);

    while (s.phase < target) {
      const ph = s.phase;
      if (ph === 2) Object.values(this.franchiseStands).forEach(st => { st.hired = true; });
      if (ph === 3) Object.values(this.wholesaleAccounts).forEach(w => { w.active = true; w.level = 1; w.bottlesPerDay = w.levels[0].bottlesPerDay; });
      // This stage's upgrades first, then the one that opens the next stage.
      const opener = PHASE_OPENERS[ph];
      this.projects.filter(p => p.phase === ph && p.id !== opener).forEach(giveFree);
      const open = this.projects.find(p => p.id === opener);
      if (open) giveFree(open);
      if (s.phase === ph) s.phase = (ph + 1) as GamePhase;   // opener missing: step anyway
    }

    const arrive = DAD_JUMP_ARRIVAL[target];
    if (s.cash.lt(arrive.cash)) s.cash = BigNum.fromNumber(arrive.cash);
    if (s.totalCupsSold.lt(arrive.cups)) s.totalCupsSold = BigNum.fromNumber(arrive.cups);
    this.log(`Dad Mode: jumped ahead to Stage ${target}.`);
    return true;
  }

  public buyTrophy(id: string): boolean {
    const t = this.trophies.find(x => x.id === id);
    if (!t || t.purchased || this.state.cash.lt(t.costCash)) return false;

    this.state.cash = this.state.cash.sub(t.costCash);
    this.ledger.treats += t.costCash;
    t.purchased = true;

    if (id === 'skateboard') this.state.flags.hasSkateboard = true;
    if (id === 'mountain_bike') this.state.flags.hasMountainBike = true;
    const tb = this.balance.trophies;
    const repMax = this.balance.reputation.max;
    if (id === 'nintendo_switch') {
      this.state.flags.hasNintendoSwitch = true;
      this.state.reputation = Math.min(repMax, this.state.reputation + tb.nintendoReputationBump);
    }
    if (id === 'electric_scooter') {
      this.state.flags.hasElectricScooter = true;
      Object.values(this.franchiseStands).forEach(st => st.baseCapacity = Math.round(st.baseCapacity * tb.scooterCapacityMult));
    }
    if (id === 'ipad_pro') this.state.flags.hasIpadPro = true;
    if (id === 'disney_vip') {
      this.state.flags.hasDisneyTrip = true;
      this.state.reputation = Math.min(repMax, this.state.reputation + tb.disneyReputationBump);
    }
    if (id === 'first_car') this.state.flags.hasHondaCivic = true;
    if (id === 'garage_arcade') {
      this.state.flags.hasGarageArcade = true;
      this.state.brandMultiplier *= tb.arcadeBrandMult;
    }
    if (id === 'college_fund') {
      this.state.flags.hasCollegePrepaid = true;
      this.state.brandMultiplier *= tb.collegeBrandMult;
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

    this.log(`TROPHY PURCHASED: ${t.emoji} ${t.name} ($${t.costCash.toLocaleString()})! ${t.perkDesc}`);
    return true;
  }

  // Weather & Calculations
  public rollNextForecast(): void {
    const { weather, tempF, seasonInfo } = rollWeatherForecast(
      () => this.rand(),
      this.state.flags.weatherLocked95F,
      this.state.day,
      this.balance
    );
    this.state.weather = weather;
    this.state.tempF = tempF;
    this.state.seasonInfo = seasonInfo;

    // When Auto-Ice is enabled, immediately update recipe.icePerCup to tomorrow's ideal ice
    // so the morning prep screen, demand calculator, and supply warnings are accurate before starting the day.
    if (this.state.flags.hasAutoIce && this.state.flags.autoIceEnabled) {
      this.state.recipe.icePerCup = computeIdealIce(tempF, this.balance);
    }
  }

  public getSeasonInfo(day: number = this.state.day): SeasonInfo {
    return getSeasonInfo(day, this.balance);
  }

  public computeIdealIce(tempF: number = this.state.tempF): number {
    return computeIdealIce(tempF, this.balance);
  }

  // Word hint for the morning weather card: is the kid's ice per cup too little, too much,
  // or just right for today's heat.
  public getIceHint(): IceHint {
    const s = this.state;
    return iceHint(s.recipe.icePerCup, this.computeIdealIce(s.tempF), s.tempF);
  }

  // How busy today looks, 1 (slow) to 4 (huge crowd), from weather and heat alone.
  public getCrowdLevel(): 1 | 2 | 3 | 4 {
    const day = computeDayDemand(this.state, this.franchiseStands, this.balance);
    return crowdLevel(day.weatherMult * day.tempFactor);
  }

  // Share of the neighborhood that knows the stand, 0..1.
  public getBuzz(): number {
    return this.state.buzz ?? 0;
  }

  // The lemon:sugar recipe that tastes best.
  public getGoldenRecipe(): { lemons: number; sugar: number } {
    return { ...this.state.goldenRecipe };
  }

  public isExactGolden(): boolean {
    const r = this.state.recipe, g = this.state.goldenRecipe;
    return r.lemonsPerPitcher === g.lemons && r.sugarPerPitcher === g.sugar;
  }

  // True once the neighbors asked the kid to keep the golden recipe (see balance.recipe.lockStreak).
  public isRecipeLocked(): boolean {
    return !!this.state.recipeLocked;
  }

  // Lemons or sugar per pitcher up or down by one (never below 1). Does nothing once the
  // recipe is locked; returns whether it changed.
  public adjustRecipe(item: 'lemons' | 'sugar', delta: number): boolean {
    if (this.state.recipeLocked) return false;
    const key = item === 'lemons' ? 'lemonsPerPitcher' : 'sugarPerPitcher';
    const next = Math.max(1, this.state.recipe[key] + delta);
    if (next === this.state.recipe[key]) return false;
    this.state.recipe[key] = next;
    return true;
  }

  public computeRecipeQuality(tempF: number = this.state.tempF): number {
    return computeRecipeQuality(this.state.recipe, tempF, this.state.goldenRecipe, this.balance);
  }

  public getRecipeProfile(tempF: number = this.state.tempF): RecipeProfile {
    return getRecipeProfile(this.state.recipe, tempF, this.state.goldenRecipe, this.balance);
  }

  public getDailyDemandEstimate(): DailyDemandEstimate {
    return getDailyDemandEstimate(this.state, this.franchiseStands, this.balance, this.wholesaleAccounts);
  }

  public getKidDemandAdvice(): KidDemandAdvice {
    return getKidDemandAdvice(this.state, this.franchiseStands, this.balance, this.wholesaleAccounts);
  }

  public getMaxPourableCups(): PourableCapacity {
    return getMaxPourableCups(this.state, this.balance);
  }

  // The packs still needed to cover today's forecast (as much as storage holds; the ice
  // machine makes ice itself), and what they cost.
  private restockPlan(): { packsL: number; packsS: number; packsI: number; packsC: number; packsB: number; totalCost: number } {
    const est = this.getDailyDemandEstimate();
    const s = this.state;
    let totalCost = 0;
    const plan = (item: SupplyItem, need: number) => {
      const pack = this.supplyPack(item);
      const packs = Math.ceil(Math.max(0, need - s.inv[item]) / pack.qty);
      if (packs > 0) totalCost += this.buyOffer(item, packs).cost;
      return packs;
    };
    const packsL = plan('lemons', est.neededLemons);
    const packsS = plan('sugar', est.neededSugar);
    const packsI = s.flags.hasAutoIce ? 0 : plan('ice', est.neededIce);
    const packsC = plan('cups', est.neededCups);
    const packsB = est.neededBottles > 0 ? plan('bottles', est.neededBottles) : 0;
    return { packsL, packsS, packsI, packsC, packsB, totalCost: +totalCost.toFixed(2) };
  }

  // Money today's supplies will still cost (0 once the stand is stocked for the forecast).
  // The kid shop keeps this much back, so an upgrade never eats the lemon money.
  public restockCostForToday(): number {
    return this.restockPlan().totalCost;
  }

  public autoRestockForToday(): { success: boolean; message: string } {
    const s = this.state;
    const { packsL, packsS, packsI, packsC, packsB, totalCost } = this.restockPlan();

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
    if (packsB > 0) this.buySupplies('bottles', packsB);

    this.log(`Auto-Restocked for today: bought supplies for $${totalCost.toFixed(2)}.`);
    return { success: true, message: `Restocked all supplies for $${totalCost.toFixed(2)}!` };
  }

  public generateCustomerReviews(info: {
    tempF: number;
    quality: number;
    pricePerCup: number;
    fairPrice: number;
    totalTraffic: number;
    drivewayCupsSold: number;
    franchiseCupsSold: number;
    soldOutStands: string[];
    bottleneck?: string;
    recipeJustLocked?: boolean;
  }): CustomerReview[] {
    return generateDailyReviews({
      recipeJustLocked: info.recipeJustLocked,
      state: this.state,
      franchiseStands: this.franchiseStands,
      tempF: info.tempF,
      pricePerCup: info.pricePerCup,
      fairPrice: info.fairPrice,
      totalTraffic: info.totalTraffic,
      drivewayCupsSold: info.drivewayCupsSold,
      franchiseCupsSold: info.franchiseCupsSold,
      soldOutStands: info.soldOutStands,
      bottleneck: info.bottleneck,
      rand: () => this.rand(),
      balance: this.balance
    });
  }

  // ==========================================================================
  // MAIN DAILY BUSINESS SIMULATION (P&L EXECUTION)
  // ==========================================================================
  public runDay(): DaySummary {
    const s = this.state;
    const notes: string[] = [];

    if (s.flags.hasAutoIce && s.flags.autoIceEnabled) {
      s.recipe.icePerCup = this.computeIdealIce(s.tempF);
    }

    if (s.flags.hasLemonGrove) {
      s.inv.lemons = Math.max(s.inv.lemons, 500);
      notes.push("California Lemon Grove delivered 500 fresh organic lemons ($0)");
    }

    if (s.flags.hasPaidMortgage) {
      s.reputation = 1.0;
    }

    // A locked recipe is always golden, whatever else touched state.recipe.
    if (s.recipeLocked) {
      s.recipe.lemonsPerPitcher = s.goldenRecipe.lemons;
      s.recipe.sugarPerPitcher = s.goldenRecipe.sugar;
    }

    const b = this.balance;
    // Same function as the morning forecast (src/simulation/demand.ts).
    const demand = computeDayDemand(s, this.franchiseStands, b);
    const { weatherMult, quality, fairPrice, totalCupDemand, totalTraffic } = demand;
    const activeStands = demand.stands;
    const franchiseWages = activeStands.reduce((sum, st) => sum + st.wage, 0);

    s.bestRecipeQuality = Math.max(s.bestRecipeQuality, quality);
    s.totalQualityDays = (s.totalQualityDays || 0) + 1;
    s.totalQualitySum = (s.totalQualitySum || 0) + quality;
    // Recent recipes count most: an EWMA, seeded with the first day's quality.
    s.avgRecipeQuality = s.totalQualityDays === 1 || !s.avgRecipeQuality
      ? quality
      : ewma(s.avgRecipeQuality, quality, b.reputation.qualityAlpha);

    const reputationBefore = s.reputation;

    // The ice machine prepares enough for the forecast, including any ice already owned.
    const iceAtOpening = s.inv.ice;
    let iceMadeByMachine = 0;
    if (s.flags.hasAutoIce) {
      const want = totalCupDemand * s.recipe.icePerCup;
      if (s.inv.ice < want) { iceMadeByMachine = want - s.inv.ice; s.inv.ice = want; }
    }

    const cupsPerPitcher = pitcherCups(s.recipe.icePerCup, b);
    const maxByCups = s.inv.cups;
    const maxByIce = s.recipe.icePerCup > 0 ? Math.floor(s.inv.ice / s.recipe.icePerCup) : Infinity;
    const maxByLemons = Math.floor(s.inv.lemons / Math.max(1, s.recipe.lemonsPerPitcher)) * cupsPerPitcher;
    const maxBySugar = Math.floor(s.inv.sugar / Math.max(1, s.recipe.sugarPerPitcher)) * cupsPerPitcher;
    const maxTotalPour = Math.min(totalCupDemand, maxByCups, maxByIce, maxByLemons, maxBySugar);

    const soldOutStands: string[] = [];
    const soldByStand: Record<string, number> = {};   // cups each friend's stand sold
    let drivewayCupsSold = 0;
    let franchiseCupsSold = 0;
    let franchiseGross = 0;
    let primaryBottleneck = '';
    let storageShort: '' | 'ice' | 'lemons' = '';

    if (maxTotalPour <= 0 && totalCupDemand > 0) {
      const missing: string[] = [];
      if (s.inv.cups <= 0) missing.push('Cups');
      if (s.inv.lemons < s.recipe.lemonsPerPitcher) missing.push('Lemons');
      if (s.inv.sugar < s.recipe.sugarPerPitcher) missing.push('Sugar');
      if (s.recipe.icePerCup > 0 && s.inv.ice < s.recipe.icePerCup) missing.push('Ice');
      primaryBottleneck = missing[0] || 'supplies';
      notes.push(`No cups sold: out of ${missing.join(' & ') || 'supplies'}!`);
      if (franchiseWages > 0) notes.push(`Workers' pay: -$${franchiseWages.toFixed(2)}.`);
      activeStands.forEach(st => { if (st.demand > 0) soldOutStands.push(st.name); });
    } else {
      const allocation = allocateStandSales(activeStands, maxTotalPour);

      activeStands.forEach((st, idx) => {
        const sold = allocation[idx];

        if (!st.isDriveway) {
          franchiseCupsSold += sold;
          franchiseGross += sold * s.recipe.pricePerCup;
          soldByStand[st.id] = sold;
        } else {
          drivewayCupsSold += sold;
        }

        if (sold < st.demand) {
          soldOutStands.push(st.name);
        }
      });

      const totalSold = drivewayCupsSold + franchiseCupsSold;
      const pitchersUsed = Math.ceil(totalSold / cupsPerPitcher);
      // Stock when the stands opened. The sold-out note below reports what we "had"; reading
      // s.inv there (after the sales are deducted) always printed the leftovers, usually 0.
      const had = { ...s.inv };

      s.inv.cups = Math.max(0, s.inv.cups - totalSold);
      s.inv.ice = Math.max(0, s.inv.ice - totalSold * s.recipe.icePerCup);
      s.inv.lemons = Math.max(0, s.inv.lemons - pitchersUsed * s.recipe.lemonsPerPitcher);
      s.inv.sugar = Math.max(0, s.inv.sugar - pitchersUsed * s.recipe.sugarPerPitcher);

      if (maxTotalPour < totalCupDemand) {
        const bottlenecks: string[] = [];
        if (maxByCups === maxTotalPour) { bottlenecks.push(`Cups (had ${had.cups}, needed ${totalCupDemand})`); primaryBottleneck = 'cups'; }
        if (maxByIce === maxTotalPour) { bottlenecks.push(`Ice (${had.ice} cubes only poured ${maxByIce} cups at ${s.recipe.icePerCup}/cup; needed ${totalCupDemand * s.recipe.icePerCup})`); primaryBottleneck = 'ice'; }
        if (maxByLemons === maxTotalPour) { bottlenecks.push(`Lemons (had ${had.lemons}, needed ${Math.ceil(totalCupDemand / cupsPerPitcher) * s.recipe.lemonsPerPitcher})`); primaryBottleneck = 'lemons'; }
        if (maxBySugar === maxTotalPour) { bottlenecks.push(`Sugar (had ${had.sugar}, needed ${Math.ceil(totalCupDemand / cupsPerPitcher) * s.recipe.sugarPerPitcher})`); primaryBottleneck = 'sugar'; }
        // Sold out because the stand could not hold more: say so simply and point at the
        // upgrade that fixes it (instead of the long supply breakdown).
        const full = (['ice', 'lemons'] as const).find(it =>
          (it === 'ice' ? maxByIce : maxByLemons) === maxTotalPour && had[it] >= this.storageCap(it));
        if (full) {
          storageShort = full;
          notes.push(`Sold ${totalSold} of ${totalCupDemand} cups, then ran out of ${full}: your ${storageName(s, full)} only holds ${this.storageCap(full).toLocaleString('en-US')}. ${storageUpgradeHint(full)}`);
        } else {
          notes.push(`Stands sold out early: out of ${bottlenecks.join(' & ') || 'supplies'}! Sold ${totalSold}/${totalCupDemand} cups. Leftover supplies could not be poured without matching ingredients.`);
        }
      }
    }

    const drivewayRevenue = drivewayCupsSold * s.recipe.pricePerCup;
    const franchiseNet = franchiseGross - franchiseWages;

    let bottlesSold = 0;
    let wholesaleGross = 0;
    // Caps and labels are in the bottle price now (bought in the morning), so filling a
    // bottle costs nothing more. Kept at 0 for the Day Report fields and older saves.
    const packagingCosts = 0;
    const storeResults: StoreDayResult[] = [];

    if (s.phase >= 3) {
      const w = b.wholesale;
      for (const { id, bottles: bottleDemand } of storeDemand(s, this.wholesaleAccounts, weatherMult)) {
        const acc = this.wholesaleAccounts[id];
        const maxByL = Math.floor(s.inv.lemons / w.lemonsPerBottle);
        const maxByS = Math.floor(s.inv.sugar / w.sugarPerBottle);
        const maxBottles = Math.max(0, Math.min(bottleDemand, s.inv.bottles, maxByL, maxByS));
        storeResults.push({ id, name: acc.name, bottles: maxBottles, wanted: bottleDemand, revenue: maxBottles * acc.wholesalePrice });

        if (maxBottles > 0) {
          s.inv.bottles -= maxBottles;
          s.inv.lemons -= Math.ceil(maxBottles * w.lemonsPerBottle);
          s.inv.sugar -= Math.ceil(maxBottles * w.sugarPerBottle);

          bottlesSold += maxBottles;
          wholesaleGross += maxBottles * acc.wholesalePrice;
        }
        if (maxBottles === 0 && bottleDemand > 0) {
          const missing: string[] = [];
          if (s.inv.bottles <= 0) missing.push('Glass Bottles');
          if (s.inv.lemons < 1) missing.push('Lemons');
          if (s.inv.sugar < 1) missing.push('Sugar');
          notes.push(`Could not fill wholesale order for ${acc.name} (out of ${missing.join(' & ') || 'supplies'})!`);
        }
      }
    }
    const wholesaleNet = wholesaleGross - packagingCosts;

    let patentUnitsSold = 0;
    let patentRoyalties = 0;
    if (s.phase >= 4 && this.patent.licensed) {
      const p = b.patent;
      let multiplier = 1.0;
      if (s.flags.hasTeslaModelX) multiplier += p.teslaBonus;
      if (s.flags.hasPrivateJet) multiplier *= p.privateJetMult;

      patentUnitsSold = Math.round(this.patent.baseUnitsPerDay * (p.randomMin + this.rand() * p.randomRange) * multiplier);
      patentRoyalties = patentUnitsSold * this.patent.royaltyPerUnit;
      s.totalSqueezersSold += patentUnitsSold;
    }

    let copackerCasesSold = 0;
    let copackerNet = 0;
    if (s.phase >= 5 && this.copacker.active) {
      const c = b.copacker;
      const arenaMult = s.flags.hasArenaNaming ? c.arenaMult : 1.0;
      copackerCasesSold = Math.round(this.copacker.casesPerDay * (c.randomMin + this.rand() * c.randomRange) * arenaMult);
      copackerNet = copackerCasesSold * this.copacker.netPerCase;
    }

    // What the stand upgrades saved today, in cubes, lemons and dollars (for the Day Report).
    const perCube = this.supplyPack('ice').cost / this.supplyPack('ice').qty;
    const perLemon = this.supplyPack('lemons').cost / this.supplyPack('lemons').qty;
    const iceKeptByCooler = s.flags.hasCooler && !s.flags.hasAutoIce ? s.inv.ice : 0;
    const lemonsKeptByFridge = s.flags.hasMiniFridge && !s.flags.hasLemonGrove
      ? Math.ceil(s.inv.lemons * b.spoilage.lemonRotFraction) : 0;
    // Unsold drinks do not save ice: unused machine ice melts at the end of the day.
    const iceUsed = (drivewayCupsSold + franchiseCupsSold) * s.recipe.icePerCup;
    const freeIceUsed = Math.min(iceMadeByMachine, Math.max(0, iceUsed - iceAtOpening));
    const upgradeSavings = +((freeIceUsed + iceKeptByCooler) * perCube + lemonsKeptByFridge * perLemon).toFixed(2);
    if (upgradeSavings >= 0.01) {
      const parts: string[] = [];
      if (freeIceUsed > 0) parts.push(`${freeIceUsed.toLocaleString('en-US')} free ice cubes`);
      if (iceKeptByCooler > 0) parts.push(`${iceKeptByCooler.toLocaleString('en-US')} cubes kept frozen`);
      if (lemonsKeptByFridge > 0) parts.push(`${lemonsKeptByFridge} lemons kept fresh`);
      notes.push(`Your upgrades saved $${upgradeSavings.toFixed(2)} today: ${parts.join(', ')}.`);
    }

    // Overnight spoilage. Each tip says what to do (the ice machine and fridge are in the
    // kid shop). Ice from the machine melts too, but it was free, so nothing is said. The full tip shows the first TIP_FULL_TIMES days it happens; after that both
    // go on one short line.
    const TIP_FULL_TIMES = 2;
    s.tipCounts = s.tipCounts ?? {};
    const shortSpoil: string[] = [];
    const spoilNote = (key: string, full: string, short: string) => {
      const seen = s.tipCounts![key] ?? 0;
      s.tipCounts![key] = seen + 1;
      if (seen < TIP_FULL_TIMES) notes.push(full);
      else shortSpoil.push(short);
    };
    if (!s.flags.hasCooler && s.inv.ice > 0) {
      const cubes = `${s.inv.ice} ice ${s.inv.ice === 1 ? 'cube' : 'cubes'}`;
      if (!s.flags.hasAutoIce) {
        spoilNote('melt', `${cubes} melted overnight. Ice only lasts one day, so buy just what today needs (an ice machine makes fresh ice every day).`, `${cubes} melted`);
      }
      s.inv.ice = 0;
    }
    if (!s.flags.hasMiniFridge && s.inv.lemons > 0 && !s.flags.hasLemonGrove) {
      const rotted = Math.ceil(s.inv.lemons * b.spoilage.lemonRotFraction);
      s.inv.lemons -= rotted;
      const lemons = `${rotted} ${rotted === 1 ? 'lemon' : 'lemons'}`;
      spoilNote('rot', `${lemons} went bad overnight. Lemons spoil, so don't stock up too far ahead (a mini-fridge keeps them fresh).`, `${lemons} went bad`);
    }
    if (shortSpoil.length) notes.push(`Overnight: ${shortSpoil.join(', ')}.`);

    const totalRevenue = (drivewayRevenue + franchiseGross + wholesaleGross + patentRoyalties + copackerNet) * s.brandMultiplier;
    const totalExpenses = franchiseWages + packagingCosts;
    const netProfit = totalRevenue - totalExpenses;

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
    // Close today's money diary: the morning's shopping is already in it.
    const led = this.ledger;
    led.sales += totalRevenue;
    led.cups += totalCupsToday;
    led.wages += franchiseWages;
    led.packaging += packagingCosts;
    s.lastLedger = led;
    s.upgradeSavingsTotal = (s.upgradeSavingsTotal ?? 0) + upgradeSavings;
    s.grossProfitTotal = (s.grossProfitTotal ?? 0) + ledgerGrossProfit(led);
    s.totalBottlesSold += bottlesSold;
    s.totalStandCupsSold += drivewayCupsSold + franchiseCupsSold;
    s.totalCupsSold = s.totalCupsSold.add(totalCupsToday);
    s.totalRevenueEarned = s.totalRevenueEarned.add(totalRevenue);

    // Golden streak: only days when somebody tasted it count; a day with no sales leaves it alone.
    const exactGolden = this.isExactGolden();
    let recipeJustLocked = false;
    if (drivewayCupsSold + franchiseCupsSold > 0) {
      s.goldenStreak = exactGolden ? (s.goldenStreak ?? 0) + 1 : 0;
      if (!s.recipeLocked && s.goldenStreak >= b.recipe.lockStreak) {
        s.recipeLocked = true;
        recipeJustLocked = true;
        this.log(`Recipe locked golden (${s.goldenRecipe.lemons} lemons : ${s.goldenRecipe.sugar} sugar) after ${s.goldenStreak} golden days in a row.`);
      }
    }

    const customerScore = dailyCustomerScore({
      quality,
      exactGolden,
      pricePerCup: s.recipe.pricePerCup,
      fairPrice,
      cupsWanted: totalCupDemand,
      cupsSold: drivewayCupsSold + franchiseCupsSold
    }, b);
    if (!s.flags.hasPaidMortgage) {
      const excessivePriceSeen = totalTraffic > 0 && s.recipe.pricePerCup >= fairPrice * b.reputation.excessivePriceRatio;
      s.reputation = nextReputation(s, customerScore, b, excessivePriceSeen);
    }
    const recentRatings = (s.reputationHistory ?? []).filter(Number.isFinite).slice(-4);
    if (!recentRatings.length || Math.abs(recentRatings[recentRatings.length - 1] - reputationBefore) > 1e-9) {
      recentRatings.push(reputationBefore);
    }
    recentRatings.push(s.reputation);
    s.reputationHistory = recentRatings.slice(-4);
    const ratingTrend = reputationTrend(s.reputationHistory);
    // Happy driveway customers tell their neighbors (franchise stands are in other neighborhoods).
    const buzzBefore = s.buzz ?? 0;
    s.buzz = nextBuzz(buzzBefore, drivewayCupsSold * (customerScore ?? 0), b);

    const reviews = this.generateCustomerReviews({
      tempF: s.tempF,
      quality,
      pricePerCup: s.recipe.pricePerCup,
      fairPrice,
      totalTraffic,
      drivewayCupsSold,
      franchiseCupsSold,
      soldOutStands,
      bottleneck: primaryBottleneck,
      recipeJustLocked
    });

    const seasonInfo = this.getSeasonInfo(s.day);

    const summary: DaySummary = {
      soldOutItem: primaryBottleneck.toLowerCase() || undefined,
      standVisits: activeStands.map(st => ({
        id: st.id, traffic: st.traffic, wanted: st.demand,
        sold: st.isDriveway ? drivewayCupsSold : (soldByStand[st.id] ?? 0)
      })),
      day: s.day,
      tempF: s.tempF,
      weather: s.weather,
      seasonInfo,
      seasonBadge: seasonInfo.badge,
      drivewayCupsSold,
      drivewayRevenue,
      franchiseCupsSold,
      franchiseGrossRevenue: franchiseGross,
      franchiseWagesPaid: franchiseWages,
      franchiseNet,
      friends: Object.values(this.franchiseStands).filter(st => st.hired).map(st => {
        const cups = soldByStand[st.id] ?? 0;
        return {
          id: st.id, workerName: st.workerName, standName: st.name, cups,
          revenue: cups * s.recipe.pricePerCup,
          wage: st.dayOff ? 0 : st.dailyWage,
          dayOff: !!st.dayOff,
        };
      }),
      stores: storeResults,
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
      reputationBefore,
      reputationAfter: s.reputation,
      reputationTrend: ratingTrend,
      buzzBefore,
      buzzAfter: s.buzz,
      goldenStreak: s.goldenStreak,
      recipeJustLocked,
      iceMadeByMachine,
      iceKeptByCooler,
      lemonsKeptByFridge,
      upgradeSavings,
      storageShort,
      soldOut: totalCupDemand > 0 && soldOutStands.length > 0,
      reviews,
      notes: notes.length ? notes : ['All operations ran smoothly!']
    };

    s.lastDaySummary = summary;
    s.day += 1;
    s.elapsedSec += b.secondsPerDay;

    if (reviews.length > 0) {
      const topCust = reviews.find(r => !r.reviewer.includes('(')) || reviews[0];
      this.log(`Review (${topCust.stars}/5): "${topCust.quote}" -- ${topCust.reviewer}`);
      const teamMsg = reviews.find(r => r.reviewer.includes('('));
      if (teamMsg) {
        this.log(`Team: "${teamMsg.quote}" -- ${teamMsg.reviewer}`);
      }
    }

    this.rollNextForecast();
    // A new day: chores are ready again and the rest time goes back to normal.
    if (s.currentChore) {
      s.currentChore.remainingSec = 0;
    }
    s.choresToday = 0;

    return summary;
  }

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

function emptyLedger(day: number): MoneyLedger {
  return {
    day, sales: 0, cups: 0, chores: 0,
    supplies: { lemons: 0, sugar: 0, ice: 0, cups: 0, bottles: 0 },
    shop: 0, shopIds: [], treats: 0, hiring: 0, wages: 0, packaging: 0,
  };
}

// Money in minus money out for one ledger (what the kid really kept that day).
export function ledgerKept(l: MoneyLedger): number {
  const out = Object.values(l.supplies).reduce((a, b) => a + b, 0) + l.shop + l.treats + l.hiring + (l.storeUpgrades ?? 0) + (l.house ?? 0) + l.wages + l.packaging;
  return l.sales + l.chores - out;
}

// Gross profit for one ledger: sales minus what making them cost (supplies, workers' pay,
// bottles). Upgrades, hiring, prizes and chores are left out.
export function ledgerGrossProfit(l: MoneyLedger): number {
  const supplies = Object.values(l.supplies).reduce((a, b) => a + b, 0);
  return l.sales - supplies - l.wages - l.packaging;
}

// src/engine.ts — Lemonade Business Simulation Engine Facade & API
import { BigNum } from './bignum';
import type {
  GameState,
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
  SupplyItem,
  SeasonInfo
} from './types';

import { rollChore } from './data/chores';
import { createInitialFranchiseStands } from './data/franchise';
import { createInitialWholesaleAccounts } from './data/wholesale';
import { createInitialProjects } from './data/projects';
import { createInitialTrophies } from './data/trophies';
import { rollWeatherForecast, computeIdealIce, getSeasonInfo } from './simulation/weather';
import { computeRecipeQuality, getRecipeProfile } from './simulation/recipe';
import { getDailyDemandEstimate, getKidDemandAdvice, getMaxPourableCups } from './simulation/demand';
import { generateDailyReviews } from './simulation/reviews';
import { ewma, dailyCustomerScore, nextReputation } from './simulation/reputation';
import { computeDayDemand } from './simulation/demand';
import { cupsPerPitcher as pitcherCups } from './simulation/recipe';
import { BALANCE, type Balance } from './balance';

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
      bestRecipeQuality: 0,
      avgRecipeQuality: 0,
      totalQualityDays: 0,
      totalQualitySum: 0,
      brandMultiplier: 1.0,
      gameWon: false,

      cash: BigNum.fromNumber(start.cash),
      totalCupsSold: new BigNum(0, 0),
      totalRevenueEarned: new BigNum(0, 0),

      inv: { ...start.inventory },
      recipe: { ...start.recipe },

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
    this.log(`Completed chore: ${name} (Earned +$${reward.toFixed(2)})`);

    const cd = chore.cooldownSec;
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
    return { qty: Math.round(base.qty * bikeBonus), cost: +(base.cost * discount).toFixed(2) };
  }

  public buySupplies(item: SupplyItem, packs: number = 1): boolean {
    if (!this.balance.supplies[item]) return false;
    const entry = this.supplyPack(item);

    const totalCost = entry.cost * packs;
    if (this.state.cash.lt(totalCost)) return false;

    this.state.cash = this.state.cash.sub(totalCost);
    this.state.inv[item] += entry.qty * packs;
    return true;
  }

  // Franchise & Wholesale Actions
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

    this.log(`🎉 TROPHY PURCHASED: ${t.emoji} ${t.name} ($${t.costCash.toLocaleString()})! ${t.perkDesc}`);
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

  public computeRecipeQuality(tempF: number = this.state.tempF): number {
    return computeRecipeQuality(this.state.recipe, tempF, this.balance);
  }

  public getRecipeProfile(tempF: number = this.state.tempF): RecipeProfile {
    return getRecipeProfile(this.state.recipe, tempF, this.balance);
  }

  public getDailyDemandEstimate(): DailyDemandEstimate {
    return getDailyDemandEstimate(this.state, this.franchiseStands, this.balance);
  }

  public getKidDemandAdvice(): KidDemandAdvice {
    return getKidDemandAdvice(this.state, this.franchiseStands, this.balance);
  }

  public getMaxPourableCups(): PourableCapacity {
    return getMaxPourableCups(this.state, this.balance);
  }

  public autoRestockForToday(): { success: boolean; message: string } {
    const est = this.getDailyDemandEstimate();
    const s = this.state;
    const L = this.supplyPack('lemons'), S = this.supplyPack('sugar'), I = this.supplyPack('ice'), C = this.supplyPack('cups');
    const packSizes = { lemons: L.qty, sugar: S.qty, ice: I.qty, cups: C.qty };
    const packCosts = { lemons: L.cost, sugar: S.cost, ice: I.cost, cups: C.cost };

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

  public generateCustomerReviews(info: {
    tempF: number;
    quality: number;
    pricePerCup: number;
    fairPrice: number;
    drivewayCupsSold: number;
    franchiseCupsSold: number;
    soldOutStands: string[];
    bottleneck?: string;
  }): CustomerReview[] {
    return generateDailyReviews({
      state: this.state,
      franchiseStands: this.franchiseStands,
      tempF: info.tempF,
      quality: info.quality,
      pricePerCup: info.pricePerCup,
      fairPrice: info.fairPrice,
      drivewayCupsSold: info.drivewayCupsSold,
      franchiseCupsSold: info.franchiseCupsSold,
      soldOutStands: info.soldOutStands,
      bottleneck: info.bottleneck,
      rand: () => this.rand()
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

    const b = this.balance;
    // Same function as the morning forecast (src/simulation/demand.ts).
    const demand = computeDayDemand(s, this.franchiseStands, b);
    const { weatherMult, quality, fairPrice, totalCupDemand } = demand;
    const activeStands = demand.stands;
    const franchiseWages = activeStands.reduce((sum, st) => sum + st.wage, 0);

    s.bestRecipeQuality = Math.max(s.bestRecipeQuality, quality);
    s.totalQualityDays = (s.totalQualityDays || 0) + 1;
    s.totalQualitySum = (s.totalQualitySum || 0) + quality;
    // Recent recipes count most: an EWMA, seeded with the first day's quality.
    s.avgRecipeQuality = s.totalQualityDays === 1 || !s.avgRecipeQuality
      ? quality
      : ewma(s.avgRecipeQuality, quality, b.reputation.alpha);

    const reputationBefore = s.reputation;

    const cupsPerPitcher = pitcherCups(s.recipe.icePerCup, b);
    const maxByCups = s.inv.cups;
    const maxByIce = s.recipe.icePerCup > 0 ? Math.floor(s.inv.ice / s.recipe.icePerCup) : Infinity;
    const maxByLemons = Math.floor(s.inv.lemons / Math.max(1, s.recipe.lemonsPerPitcher)) * cupsPerPitcher;
    const maxBySugar = Math.floor(s.inv.sugar / Math.max(1, s.recipe.sugarPerPitcher)) * cupsPerPitcher;
    const maxTotalPour = Math.min(totalCupDemand, maxByCups, maxByIce, maxByLemons, maxBySugar);

    const soldOutStands: string[] = [];
    let drivewayCupsSold = 0;
    let franchiseCupsSold = 0;
    let franchiseGross = 0;
    let primaryBottleneck = '';

    if (maxTotalPour <= 0 && totalCupDemand > 0) {
      const missing: string[] = [];
      if (s.inv.cups <= 0) missing.push('Cups');
      if (s.inv.lemons < s.recipe.lemonsPerPitcher) missing.push('Lemons');
      if (s.inv.sugar < s.recipe.sugarPerPitcher) missing.push('Sugar');
      if (s.recipe.icePerCup > 0 && s.inv.ice < s.recipe.icePerCup) missing.push('Ice');
      primaryBottleneck = missing[0] || 'supplies';
      notes.push(`All stands had 0 sales (out of ${missing.join(' & ') || 'supplies'})! Full worker wages paid: -$${franchiseWages.toFixed(2)}.`);
      activeStands.forEach(st => { if (!st.isDriveway) soldOutStands.push(st.name); });
    } else {
      const ratio = totalCupDemand > 0 ? Math.min(1.0, maxTotalPour / totalCupDemand) : 0;
      let remainingPour = maxTotalPour;

      activeStands.forEach((st, idx) => {
        const sold = (idx === activeStands.length - 1)
          ? remainingPour
          : Math.min(st.demand, Math.floor(st.demand * ratio));
        remainingPour = Math.max(0, remainingPour - sold);

        if (!st.isDriveway) {
          franchiseCupsSold += sold;
          franchiseGross += sold * s.recipe.pricePerCup;
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
        notes.push(`Stands sold out early: out of ${bottlenecks.join(' & ') || 'supplies'}! Sold ${totalSold}/${totalCupDemand} cups. Leftover supplies could not be poured without matching ingredients.`);
      }
    }

    const drivewayRevenue = drivewayCupsSold * s.recipe.pricePerCup;
    const franchiseNet = franchiseGross - franchiseWages;

    let bottlesSold = 0;
    let wholesaleGross = 0;
    let packagingCosts = 0;

    if (s.phase >= 3) {
      const w = b.wholesale;
      const civicCostDiscount = s.flags.hasHondaCivic ? w.civicPackagingMult : 1.0;

      for (const acc of Object.values(this.wholesaleAccounts)) {
        if (!acc.active) continue;

        const bottleDemand = Math.round(acc.bottlesPerDay * Math.pow(weatherMult, acc.weatherSens));
        const maxByL = Math.floor(s.inv.lemons / w.lemonsPerBottle);
        const maxByS = Math.floor(s.inv.sugar / w.sugarPerBottle);
        const maxBottles = Math.min(bottleDemand, s.inv.bottles, maxByL, maxByS);

        if (maxBottles > 0) {
          s.inv.bottles -= maxBottles;
          s.inv.lemons -= Math.ceil(maxBottles * w.lemonsPerBottle);
          s.inv.sugar -= Math.ceil(maxBottles * w.sugarPerBottle);

          bottlesSold += maxBottles;
          wholesaleGross += maxBottles * acc.wholesalePrice;
          packagingCosts += maxBottles * (acc.packagingCost * civicCostDiscount);
        } else if (bottleDemand > 0) {
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
    }

    let copackerCasesSold = 0;
    let copackerNet = 0;
    if (s.phase >= 5 && this.copacker.active) {
      const c = b.copacker;
      const arenaMult = s.flags.hasArenaNaming ? c.arenaMult : 1.0;
      copackerCasesSold = Math.round(this.copacker.casesPerDay * (c.randomMin + this.rand() * c.randomRange) * arenaMult);
      copackerNet = copackerCasesSold * this.copacker.netPerCase;
    }

    if (!s.flags.hasCooler && s.inv.ice > 0) {
      // Kid-facing: the cooler upgrade is not on the kid's screen, so the tip says what to do today.
      notes.push(`${s.inv.ice} ice ${s.inv.ice === 1 ? 'cube' : 'cubes'} melted overnight. Ice only lasts one day, so buy just what today needs.`);
      s.inv.ice = 0;
    }
    if (!s.flags.hasMiniFridge && s.inv.lemons > 0 && !s.flags.hasLemonGrove) {
      const rotted = Math.ceil(s.inv.lemons * b.spoilage.lemonRotFraction);
      s.inv.lemons -= rotted;
      notes.push(`${rotted} ${rotted === 1 ? 'lemon' : 'lemons'} went bad overnight. Lemons spoil, so don't stock up too far ahead.`);
    }

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
    s.totalCupsSold = s.totalCupsSold.add(totalCupsToday);
    s.totalRevenueEarned = s.totalRevenueEarned.add(totalRevenue);

    if (!s.flags.hasPaidMortgage) {
      s.reputation = nextReputation(s, dailyCustomerScore({
        quality,
        pricePerCup: s.recipe.pricePerCup,
        fairPrice,
        cupsWanted: totalCupDemand,
        cupsSold: drivewayCupsSold + franchiseCupsSold
      }, b), b);
    }

    const reviews = this.generateCustomerReviews({
      tempF: s.tempF,
      quality,
      pricePerCup: s.recipe.pricePerCup,
      fairPrice,
      drivewayCupsSold,
      franchiseCupsSold,
      soldOutStands,
      bottleneck: primaryBottleneck
    });

    const seasonInfo = this.getSeasonInfo(s.day);

    const summary: DaySummary = {
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
      reviews,
      notes: notes.length ? notes : ['All operations ran smoothly!']
    };

    s.lastDaySummary = summary;
    s.day += 1;
    s.elapsedSec += b.secondsPerDay;

    if (reviews.length > 0) {
      const topCust = reviews.find(r => !r.reviewer.includes('(')) || reviews[0];
      this.log(`Review: ${'★'.repeat(topCust.stars)} "${topCust.quote}" — ${topCust.reviewer}`);
      const teamMsg = reviews.find(r => r.reviewer.includes('('));
      if (teamMsg) {
        this.log(`Team: "${teamMsg.quote}" — ${teamMsg.reviewer}`);
      }
    }

    this.rollNextForecast();
    if (s.currentChore) {
      s.currentChore.remainingSec = 0;
    }

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

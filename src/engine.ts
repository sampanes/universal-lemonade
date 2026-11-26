// src/engine.ts -- the game engine: state, days, buying, helpers, saving. No DOM.
import { BigNum } from './bignum';
import type {
  GameState,
  FranchiseStand,
  WholesaleAccount,
  PatentSystem,
  CoPackerSystem,
  ProjectDef,
  DailyDemandEstimate,
  KidDemandAdvice,
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
import { createInitialProjects } from './data/projects';
import { HOUSE_STEPS, HOUSE_COLORS, FIRST_HOUSE_COLOR, HOUSE_OPENS_AT_SALES, HOUSE_OPENS_ANYWAY_AT_SALES, type HouseStep } from './data/house';
import { otherUnlockToday } from './unlocks';
import { FLAVORS, FLAVOR_START, FLAVOR_BOOST, FLAVOR_MAX_SCOOPS, flavorGoldenMix, type Flavor } from './data/flavors';
import { BRAND_STEPS, BRAND_OPENS_WITH, type BrandStep } from './data/brand';
import { TROPHIES, WALLPAPERS } from './data/trophies';
import { YARD_THINGS, YARD_STEPS, YARD_DAYS_BETWEEN, type YardThing } from './data/yard';
import { rollWeatherForecast, computeIdealIce, getSeasonInfo } from './simulation/weather';
import { iceHint, crowdLevel, type IceHint } from './simulation/hints';
import { computeRecipeQuality, getRecipeProfile, cupsPerPitcher as pitcherCups, rollGoldenRecipe } from './simulation/recipe';
import { getDailyDemandEstimate, getKidDemandAdvice, allocateStandSales, computeDayDemand, storeDemand } from './simulation/demand';
import { generateDailyReviews, flavorTasteReview } from './simulation/reviews';
import { ewma, dailyCustomerScore, nextReputation, nextBuzz, reputationTrend } from './simulation/reputation';
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

// The recipe card's steps: the price moves a quarter at a time; ice per cup tops out here.
const PRICE_STEP = 0.25;
const MAX_ICE_PER_CUP = 8;

// Bump whenever the save changes shape. An older save is not upgraded: it is dropped and a new
// game starts (src/storage.ts also clears every other stored setting when that version moves).
const SAVE_VERSION = 8;

interface EngineSave {
  v: number;
  seed: number;
  rngSeed: number;
  state: GameState;
  projects: string[];
  franchiseStands: Record<string, FranchiseStand>;
  wholesaleAccounts: Record<string, WholesaleAccount>;
  patent: PatentSystem;
  copacker: CoPackerSystem;
}

export class LemonadeEngine {
  public state: GameState;
  public projects: ProjectDef[];
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
    this.state = this.createInitialState();
    this.rollNextForecast();
    this.rollNextChore();
  }

  // ---- Saving ----
  // A save is plain JSON: the game state, which projects were bought, and the
  // franchise, wholesale, patent and co-packer details (upgrades change those in place, so
  // they are saved as they are rather than replayed). Loading starts from a fresh engine and
  // lays the save on top. Only saves of this SAVE_VERSION load.
  public toSave(): EngineSave {
    return {
      v: SAVE_VERSION,
      seed: this.seed,
      rngSeed: this.rngSeed,
      state: this.state,
      projects: this.projects.filter(p => p.purchased).map(p => p.id),
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
    Object.assign(e.copacker, d.copacker || {});
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
      day: 1,
      tempF: 78,
      weather: 'SUNNY',
      reputation: start.reputation,
      buzz: this.balance.buzz.start,
      bestRecipeQuality: 0,
      avgRecipeQuality: 0,
      gameWon: false,
      endingSeen: false,

      cash: BigNum.fromNumber(start.cash),
      totalCupsSold: new BigNum(0, 0),
      totalRevenueEarned: new BigNum(0, 0),
      totalBottlesSold: 0,
      totalSqueezersSold: 0,
      boughtOn: {},
      trophyDays: [],
      wallpaper: 'plain',
      houseOpen: false,
      houseLevel: 0,
      houseColor: FIRST_HOUSE_COLOR,
      yard: [],
      flavorsLaunched: [],
      flavorMix: { ...FLAVOR_START },
      brandLevel: 0,
      reputationHistory: [],
      tipCounts: {},
      upgradeSavingsTotal: 0,
      totalStandCupsSold: 0,

      inv: { ...start.inventory },
      recipe: { ...start.recipe },
      goldenRecipe: rollGoldenRecipe(this.seed, this.balance),
      goldenStreak: 0,
      recipeLocked: false,

      flags: {
        hasMiniFridge: false,
        hasClubCard: false,
        hasCommercialLabeler: false,
        hasAutoIce: false,
        hasSupplyTruck: false,
        hasStandCaptain: false,
        hasDeliveryRoute: false,
        hasFlavorLab: false,
        hasPrivateJet: false,
        hasArenaNaming: false
      },

      currentChore: {
        name: "Mow Neighbor's Lawn",
        reward: 11.00,
        cooldownSec: 10,
        remainingSec: 0
      },
      choresToday: 0,
      lastDaySummary: null,
    };
  }

  // Today's money diary (created on first use).
  public get ledger(): MoneyLedger {
    const s = this.state;
    if (!s.ledger || s.ledger.day !== s.day) s.ledger = emptyLedger(s.day);
    return s.ledger;
  }

  // Chore Actions
  private rollNextChore(): void {
    this.state.currentChore = rollChore(() => this.rand(), this.balance);
  }

  public doChore(): { name: string; reward: number } | null {
    const chore = this.state.currentChore;
    if (chore.remainingSec > 0) return null;

    const reward = chore.reward;
    const name = chore.name;
    this.state.cash = this.state.cash.add(reward);
    this.ledger.chores += reward;

    // The more chores today, the longer the rest before the next one (resets each new day).
    this.state.choresToday += 1;
    const cd = chore.cooldownSec * Math.pow(this.balance.chores.cooldownGrowth, this.state.choresToday - 1);
    this.rollNextChore();
    this.state.currentChore.remainingSec = cd;
    return { name, reward };
  }

  // Supply Actions
  // What one pack of an item holds and costs right now, after upgrades.
  public supplyPack(item: SupplyItem): { qty: number; cost: number } {
    const b = this.balance;
    const base = b.supplies[item];
    let mult = this.state.flags.hasClubCard ? b.clubCardPriceMult : 1.0;
    if (item === 'bottles' && this.state.flags.hasCommercialLabeler) mult *= b.wholesale.labelerBottleMult;
    return { qty: base.qty, cost: +(base.cost * mult).toFixed(2) };
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
    return true;
  }

  public upgradeWholesaleAccount(id: string): boolean {
    const account = this.wholesaleAccounts[id];
    if (this.state.phase < 3 || !account || !account.active) return false;
    const next = account.levels[account.level];
    const goal = this.storeExpansionGoal();
    if (!next || goal.remaining || goal.days || this.state.cash.lt(next.cost)) return false;
    this.state.cash = this.state.cash.sub(next.cost);
    this.ledger.storeUpgrades += next.cost;
    account.level += 1;
    account.bottlesPerDay = next.bottlesPerDay;
    this.state.storeExpansion = { day: this.state.day, bottles: this.state.totalBottlesSold };
    return true;
  }

  // The family house (src/data/house.ts): the next step to buy, or null when all are bought.
  public nextHouseStep(): HouseStep | null {
    return HOUSE_STEPS[this.state.houseLevel] ?? null;
  }

  public buyHouseStep(): boolean {
    const step = this.nextHouseStep();
    if (!step || !this.state.houseOpen || this.state.phase < step.phase || this.state.cash.lt(step.cost)) return false;
    this.state.cash = this.state.cash.sub(step.cost);
    this.ledger.house += step.cost;
    this.state.houseLevel += 1;
    return true;
  }

  // Repaint the house (free, any time after Fresh Paint, which starts it FIRST_HOUSE_COLOR).
  public setHouseColor(id: string): boolean {
    if (this.state.houseLevel < 1 || !HOUSE_COLORS.some(c => c.id === id)) return false;
    this.state.houseColor = id;
    return true;
  }

  // The yard (src/data/yard.ts): once the house is paid off, the next step's price, what it
  // offers (two things for a choice, else one) and the days until it opens; null before the
  // house is paid off and after the last step.
  public nextYardStep(): { cost: number; things: YardThing[]; waitDays: number } | null {
    const s = this.state;
    const step = YARD_STEPS[s.yard.length];
    if (!step || s.houseLevel < HOUSE_STEPS.length) return null;
    const last = s.yard.length ? s.boughtOn[`yard:${s.yard[s.yard.length - 1]}`] : null;
    return {
      cost: step.cost,
      things: step.pick.filter(id => !s.yard.includes(id)).map(id => YARD_THINGS[id]),
      waitDays: last == null ? 0 : Math.max(0, last + YARD_DAYS_BETWEEN - s.day),
    };
  }

  public buyYardThing(id: string): boolean {
    const s = this.state;
    const step = this.nextYardStep();
    const thing = step?.things.find(t => t.id === id);
    if (!step || !thing || step.waitDays || s.cash.lt(step.cost)) return false;
    s.cash = s.cash.sub(step.cost);
    this.ledger.house += step.cost;
    s.yard.push(id);
    s.boughtOn[`yard:${id}`] = s.day;
    return true;
  }

  // The wallpapers open so far: Plain, and each one a trophy won brought (src/data/trophies.ts).
  public wallpapersOpen(): string[] {
    const won = TROPHIES.slice(0, this.state.trophyDays.length);
    return WALLPAPERS.filter(w => w.id === 'plain' || won.some(t => t.wallpaper === w.id)).map(w => w.id);
  }

  public setWallpaper(id: string): boolean {
    if (!this.wallpapersOpen().includes(id)) return false;
    this.state.wallpaper = id;
    return true;
  }

  public buyProject(id: string): boolean {
    const p = this.projects.find(x => x.id === id);
    if (!p || p.purchased || !p.unlocked(this.state) || this.state.cash.lt(p.costCash)) return false;

    this.state.cash = this.state.cash.sub(p.costCash);
    this.ledger.shop += p.costCash;
    this.ledger.shopIds.push(p.id);
    this.state.lastShopPurchaseDay = this.state.day;
    this.state.boughtOn[p.id] = this.state.day;
    p.purchased = true;
    p.effect(this);
    return true;
  }

  // Weather & Calculations
  private rollNextForecast(): void {
    const { weather, tempF } = rollWeatherForecast(() => this.rand(), this.state.day, this.balance);
    this.state.weather = weather;
    this.state.tempF = tempF;
    // The ice machine picks the ice for the new weather right away, so the morning's supply
    // advice is right before the stand opens.
    if (this.state.flags.hasAutoIce) this.state.recipe.icePerCup = this.computeIdealIce(tempF);
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
    return this.state.buzz;
  }

  // The lemon:sugar recipe that tastes best.
  public getGoldenRecipe(): { lemons: number; sugar: number } {
    return { ...this.state.goldenRecipe };
  }

  private isExactGolden(): boolean {
    const r = this.state.recipe, g = this.state.goldenRecipe;
    return r.lemonsPerPitcher === g.lemons && r.sugarPerPitcher === g.sugar;
  }

  // True once the neighbors asked the kid to keep the golden recipe (see balance.recipe.lockStreak).
  public isRecipeLocked(): boolean {
    return this.state.recipeLocked;
  }

  // The recipe card's + and - buttons (delta: steps up or down): lemons or sugar per pitcher
  // (never below 1, and not once the recipe is locked), ice per cup (0 to MAX_ICE_PER_CUP; the
  // ice machine picks it), or the price (a quarter at a time, never below a quarter). Returns
  // whether it changed.
  public adjustRecipe(item: 'lemons' | 'sugar' | 'ice' | 'price', delta: number): boolean {
    const r = this.state.recipe;
    const before = { ...r };
    if (item === 'price') {
      r.pricePerCup = Math.max(PRICE_STEP, +(r.pricePerCup + delta * PRICE_STEP).toFixed(2));
    } else if (item === 'ice') {
      if (!this.state.flags.hasAutoIce) r.icePerCup = Math.max(0, Math.min(MAX_ICE_PER_CUP, r.icePerCup + delta));
    } else if (!this.state.recipeLocked) {
      const key = item === 'lemons' ? 'lemonsPerPitcher' : 'sugarPerPitcher';
      r[key] = Math.max(1, r[key] + delta);
    }
    return (Object.keys(r) as (keyof typeof r)[]).some(k => r[k] !== before[k]);
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

  // The packs of each supply still needed to cover today's forecast (as much as storage
  // holds; the ice machine makes ice itself), and what they cost.
  private restockPlan(): { packs: [SupplyItem, number][]; totalCost: number } {
    const est = this.getDailyDemandEstimate();
    const s = this.state;
    const need: Record<SupplyItem, number> = {
      lemons: est.neededLemons, sugar: est.neededSugar, ice: s.flags.hasAutoIce ? 0 : est.neededIce,
      cups: est.neededCups, bottles: est.neededBottles,
    };
    const packs: [SupplyItem, number][] = [];
    let totalCost = 0;
    for (const item of Object.keys(need) as SupplyItem[]) {
      const n = Math.ceil(Math.max(0, need[item] - s.inv[item]) / this.supplyPack(item).qty);
      if (n > 0) { packs.push([item, n]); totalCost += this.buyOffer(item, n).cost; }
    }
    return { packs, totalCost: +totalCost.toFixed(2) };
  }

  // Money today's supplies will still cost (0 once the stand is stocked for the forecast).
  // The kid shop keeps this much back, so an upgrade never eats the lemon money.
  public restockCostForToday(): number {
    return this.restockPlan().totalCost;
  }

  // Buys everything today's forecast still needs (the Supply Truck, and the simulator's bots).
  // false, and nothing bought, when the cash does not cover all of it.
  public autoRestockForToday(): boolean {
    const { packs, totalCost } = this.restockPlan();
    if (this.state.cash.lt(totalCost)) return false;
    for (const [item, n] of packs) this.buySupplies(item, n);
    return true;
  }

  // ---- Helpers (src/data/projects.ts): by Stage 4 the stands and stores earn pocket change
  // next to the squeezer and the factory, so helpers bought in the Stand Shop take over their
  // daily jobs. runDay runs them for the new morning and again just before the stand opens
  // (so a change made during the morning is covered too); buying one runs them right away.
  // Stores first (a new store needs bottles), then the stands (the price and who works decide
  // how many cups), then the truck buys what all of that needs.
  public runHelpers(): void {
    const f = this.state.flags;
    if (f.hasDeliveryRoute) this.routeStores();
    if (f.hasStandCaptain) this.captainStands();
    if (f.hasSupplyTruck) this.autoRestockForToday();
  }

  // Money left after today's supplies (below 0 when the cash does not cover them). Nothing
  // the kid or a helper buys spends the lemon money: the shop, the house, the brand, the
  // squeezer steps and the helpers all go by this.
  public spareCash(): number {
    return this.state.cash.toNumber() - this.restockCostForToday();
  }

  // Delivery Route: signs up every store, then grows each shelf, as soon as the store rules
  // allow the next move (storeExpansionGoal) and the money is there.
  private routeStores(): void {
    const goal = this.storeExpansionGoal();
    if (goal.remaining || goal.days) return;
    const accounts = Object.values(this.wholesaleAccounts);
    const sign = accounts.find(acc => !acc.active);
    if (sign) {
      if (this.spareCash() >= sign.setupCost) this.signWholesaleAccount(sign.id);
      return;
    }
    const grow = accounts.find(acc => acc.levels[acc.level]);
    if (grow && this.spareCash() >= grow.levels[grow.level].cost) this.upgradeWholesaleAccount(grow.id);
  }

  // Stand Captain: hires the friends not hired yet (when the next hire is open), picks the
  // price, and gives the day off to a friend whose stand would not earn their pay today.
  private captainStands(): void {
    const s = this.state;
    for (const st of Object.values(this.franchiseStands)) {
      if (!st.hired && this.spareCash() >= st.setupCost + st.dailyWage * 3) this.hireFranchiseStand(st.id);
    }
    const hired = Object.values(this.franchiseStands).filter(st => st.hired);
    hired.forEach(st => { st.dayOff = false; });
    s.recipe.pricePerCup = this.captainPrice();
    const est = this.getDailyDemandEstimate().franchiseEstimates;
    for (const st of hired) {
      const cups = est.find(x => x.id === st.id)?.estCups ?? 0;
      st.dayOff = cups * s.recipe.pricePerCup < st.dailyWage;
    }
  }

  // The price the forecast says earns the most today, in quarter steps, never above what
  // customers think is fair (a higher price makes them grumpy: src/simulation/reputation.ts).
  public captainPrice(): number {
    const s = this.state;
    const keep = s.recipe.pricePerCup;
    const fair = computeDayDemand(s, this.franchiseStands, this.balance).fairPrice;
    let best = keep, bestRevenue = -1;
    for (let q = 1; q <= Math.max(1, Math.floor(fair * 4 + 1e-9)); q++) {
      s.recipe.pricePerCup = q / 4;
      const revenue = this.getDailyDemandEstimate().totalEstCups * s.recipe.pricePerCup;
      if (revenue > bestRevenue) { bestRevenue = revenue; best = s.recipe.pricePerCup; }
    }
    s.recipe.pricePerCup = keep;
    return best;
  }

  // ---- The famous brand (src/data/brand.ts) ----
  public brandOpen(): boolean {
    return !!this.projects.find(p => p.id === BRAND_OPENS_WITH)?.purchased;
  }

  public nextBrandStep(): BrandStep | null {
    return BRAND_STEPS[this.state.brandLevel] ?? null;
  }

  // What the brand moves bought so far multiply all sales by.
  public brandMultiplier(): number {
    return BRAND_STEPS.slice(0, this.state.brandLevel).reduce((m, step) => m * (1 + step.bonus), 1);
  }

  // 1 on the day a brand move was bought (the next one opens tomorrow), else 0.
  public brandWaitDays(): number {
    const last = this.state.lastBrandDay;
    return last != null && this.state.day <= last ? 1 : 0;
  }

  public buyBrandStep(): boolean {
    const s = this.state;
    const step = this.nextBrandStep();
    if (!step || !this.brandOpen() || this.brandWaitDays() || s.cash.lt(step.cost)) return false;
    s.cash = s.cash.sub(step.cost);
    this.ledger.shop += step.cost;
    this.ledger.shopIds.push(`brand:${step.id}`);
    s.brandLevel += 1;
    s.lastBrandDay = s.day;
    s.boughtOn[`brand:${step.id}`] = s.day;
    return true;
  }

  // ---- The Flavor Lab (src/data/flavors.ts) ----
  // The flavor being tasted now, or null (no lab yet, or every flavor is in the stores).
  public currentFlavor(): Flavor | null {
    if (!this.state.flags.hasFlavorLab) return null;
    return FLAVORS[this.state.flavorsLaunched.length] ?? null;
  }

  // The best fruit:sugar for the flavor being tasted (null when there is none).
  public flavorGolden(): { fruit: number; sugar: number } | null {
    return this.currentFlavor() ? flavorGoldenMix(this.seed, this.state.flavorsLaunched.length) : null;
  }

  // One scoop of fruit or sugar more or less (1 to FLAVOR_MAX_SCOOPS); returns whether it changed.
  public adjustFlavor(item: 'fruit' | 'sugar', delta: number): boolean {
    if (!this.currentFlavor()) return false;
    const mix = this.state.flavorMix;
    const next = Math.max(1, Math.min(FLAVOR_MAX_SCOOPS, mix[item] + delta));
    if (next === mix[item]) return false;
    mix[item] = next;
    return true;
  }

  // How much more the factory sells for the flavors in stores (1 = none yet).
  public flavorMult(): number {
    return 1 + FLAVOR_BOOST * this.state.flavorsLaunched.length;
  }

  // The taste testers try today's mix (runDay). Exactly right: the flavor goes to the stores
  // and the next one starts at FLAVOR_START tomorrow.
  private tasteFlavor(): DaySummary['flavorTaste'] {
    const flavor = this.currentFlavor(), golden = this.flavorGolden();
    if (!flavor || !golden) return null;
    const s = this.state;
    const { fruit, sugar } = s.flavorMix;
    const review = flavorTasteReview(fruit - golden.fruit, sugar - golden.sugar, flavor.word, flavor.name);
    const launched = fruit === golden.fruit && sugar === golden.sugar;
    if (launched) {
      s.flavorsLaunched = [...s.flavorsLaunched, flavor.id];
      s.flavorMix = { ...FLAVOR_START };
    }
    return { id: flavor.id, fruit, sugar, review, launched };
  }

  // ---- The day: the stands, the stores, the squeezer and the factory sell; the night spoils
  // ice and lemons; the neighbors talk. Returns the Day Report's summary. ----
  public runDay(): DaySummary {
    const s = this.state;
    const notes: string[] = [];
    this.runHelpers();

    if (s.flags.hasAutoIce) s.recipe.icePerCup = this.computeIdealIce(s.tempF);

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
    // Recent recipes count most: an EWMA, seeded with the first day's quality (it starts at 0).
    s.avgRecipeQuality = s.avgRecipeQuality === 0 ? quality : ewma(s.avgRecipeQuality, quality, b.reputation.qualityAlpha);

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
          notes.push(`Sold ${totalSold} of ${totalCupDemand} cups, then ran out of ${full}: your ${storageName(full)} only holds ${this.storageCap(full).toLocaleString('en-US')}. ${storageUpgradeHint(full)}`);
        } else {
          notes.push(`Stands sold out early: out of ${bottlenecks.join(' & ') || 'supplies'}! Sold ${totalSold}/${totalCupDemand} cups. Leftover supplies could not be poured without matching ingredients.`);
        }
      }
    }

    const drivewayRevenue = drivewayCupsSold * s.recipe.pricePerCup;

    let bottlesSold = 0;
    let wholesaleGross = 0;
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
    let patentUnitsSold = 0;
    let patentRoyalties = 0;
    if (s.phase >= 4 && this.patent.licensed) {
      const p = b.patent;
      const multiplier = s.flags.hasPrivateJet ? p.privateJetMult : 1.0;
      patentUnitsSold = Math.round(this.patent.baseUnitsPerDay * (p.randomMin + this.rand() * p.randomRange) * multiplier);
      patentRoyalties = patentUnitsSold * this.patent.royaltyPerUnit;
      s.totalSqueezersSold += patentUnitsSold;
    }

    let copackerCasesSold = 0;
    let copackerNet = 0;
    if (s.phase >= 5 && this.copacker.active) {
      const c = b.copacker;
      const arenaMult = s.flags.hasArenaNaming ? c.arenaMult : 1.0;
      copackerCasesSold = Math.round(this.copacker.casesPerDay * (c.randomMin + this.rand() * c.randomRange) * arenaMult * this.flavorMult());
      copackerNet = copackerCasesSold * this.copacker.netPerCase;
    }

    // What the stand upgrades saved today, in cubes, lemons and dollars (for the Day Report).
    const perCube = this.supplyPack('ice').cost / this.supplyPack('ice').qty;
    const perLemon = this.supplyPack('lemons').cost / this.supplyPack('lemons').qty;
    const lemonsKeptByFridge = s.flags.hasMiniFridge ? Math.ceil(s.inv.lemons * b.spoilage.lemonRotFraction) : 0;
    // Unsold drinks do not save ice: unused machine ice melts at the end of the day.
    const iceUsed = (drivewayCupsSold + franchiseCupsSold) * s.recipe.icePerCup;
    const freeIceUsed = Math.min(iceMadeByMachine, Math.max(0, iceUsed - iceAtOpening));
    const upgradeSavings = +(freeIceUsed * perCube + lemonsKeptByFridge * perLemon).toFixed(2);
    if (upgradeSavings >= 0.01) {
      const parts: string[] = [];
      if (freeIceUsed > 0) parts.push(`${freeIceUsed.toLocaleString('en-US')} free ice cubes`);
      if (lemonsKeptByFridge > 0) parts.push(`${lemonsKeptByFridge} lemons kept fresh`);
      notes.push(`Your upgrades saved $${upgradeSavings.toFixed(2)} today: ${parts.join(', ')}.`);
    }

    // Overnight spoilage. Each tip says what to do (the ice machine and fridge are in the
    // kid shop). Ice from the machine melts too, but it was free, so nothing is said. The full tip shows the first TIP_FULL_TIMES days it happens; after that both
    // go on one short line.
    const TIP_FULL_TIMES = 2;
    const shortSpoil: string[] = [];
    const spoilNote = (key: string, full: string, short: string) => {
      const seen = s.tipCounts[key] ?? 0;
      s.tipCounts[key] = seen + 1;
      if (seen < TIP_FULL_TIMES) notes.push(full);
      else shortSpoil.push(short);
    };
    if (s.inv.ice > 0) {
      const cubes = `${s.inv.ice} ice ${s.inv.ice === 1 ? 'cube' : 'cubes'}`;
      if (!s.flags.hasAutoIce) {
        spoilNote('melt', `${cubes} melted overnight. Ice only lasts one day, so buy just what today needs (an ice machine makes fresh ice every day).`, `${cubes} melted`);
      }
      s.inv.ice = 0;
    }
    if (!s.flags.hasMiniFridge && s.inv.lemons > 0) {
      const rotted = Math.ceil(s.inv.lemons * b.spoilage.lemonRotFraction);
      s.inv.lemons -= rotted;
      const lemons = `${rotted} ${rotted === 1 ? 'lemon' : 'lemons'}`;
      spoilNote('rot', `${lemons} went bad overnight. Lemons spoil, so don't stock up too far ahead (a mini-fridge keeps them fresh).`, `${lemons} went bad`);
    }
    if (shortSpoil.length) notes.push(`Overnight: ${shortSpoil.join(', ')}.`);

    const totalRevenue = (drivewayRevenue + franchiseGross + wholesaleGross + patentRoyalties + copackerNet) * this.brandMultiplier();
    const netProfit = totalRevenue - franchiseWages;

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
    s.lastLedger = led;
    s.upgradeSavingsTotal += upgradeSavings;
    s.totalBottlesSold += bottlesSold;
    s.totalStandCupsSold += drivewayCupsSold + franchiseCupsSold;
    s.totalCupsSold = s.totalCupsSold.add(totalCupsToday);
    s.totalRevenueEarned = s.totalRevenueEarned.add(totalRevenue);

    // Golden streak: only days when somebody tasted it count; a day with no sales leaves it alone.
    const exactGolden = this.isExactGolden();
    let recipeJustLocked = false;
    if (drivewayCupsSold + franchiseCupsSold > 0) {
      s.goldenStreak = exactGolden ? s.goldenStreak + 1 : 0;
      if (!s.recipeLocked && s.goldenStreak >= b.recipe.lockStreak) {
        s.recipeLocked = true;
        recipeJustLocked = true;
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
    const excessivePriceSeen = totalTraffic > 0 && s.recipe.pricePerCup >= fairPrice * b.reputation.excessivePriceRatio;
    s.reputation = nextReputation(s, customerScore, b, excessivePriceSeen);
    const recentRatings = s.reputationHistory.slice(-4);
    if (!recentRatings.length || Math.abs(recentRatings[recentRatings.length - 1] - reputationBefore) > 1e-9) {
      recentRatings.push(reputationBefore);
    }
    recentRatings.push(s.reputation);
    s.reputationHistory = recentRatings.slice(-4);
    const ratingTrend = reputationTrend(s.reputationHistory);
    // Happy driveway customers tell their neighbors (franchise stands are in other neighborhoods).
    const buzzBefore = s.buzz;
    s.buzz = nextBuzz(buzzBefore, drivewayCupsSold * (customerScore ?? 0), b);

    const reviews = generateDailyReviews({
      state: s,
      franchiseStands: this.franchiseStands,
      tempF: s.tempF,
      pricePerCup: s.recipe.pricePerCup,
      fairPrice,
      totalTraffic,
      drivewayCupsSold,
      franchiseCupsSold,
      soldOutStands,
      bottleneck: primaryBottleneck,
      recipeJustLocked,
      rand: () => this.rand(),
      balance: b,
    });

    const summary: DaySummary = {
      soldOutItem: primaryBottleneck.toLowerCase() || undefined,
      standVisits: activeStands.map(st => ({
        id: st.id, traffic: st.traffic, wanted: st.demand,
        sold: st.isDriveway ? drivewayCupsSold : (soldByStand[st.id] ?? 0)
      })),
      day: s.day,
      tempF: s.tempF,
      weather: s.weather,
      seasonInfo: this.getSeasonInfo(s.day),
      drivewayCupsSold,
      drivewayRevenue,
      franchiseCupsSold,
      franchiseGrossRevenue: franchiseGross,
      franchiseWagesPaid: franchiseWages,
      friends: Object.values(this.franchiseStands).filter(st => st.hired).map(st => {
        const cups = soldByStand[st.id] ?? 0;
        return {
          id: st.id, workerName: st.workerName, cups,
          revenue: cups * s.recipe.pricePerCup,
          wage: st.dayOff ? 0 : st.dailyWage,
          dayOff: !!st.dayOff,
        };
      }),
      stores: storeResults,
      bottlesSold,
      wholesaleRevenue: wholesaleGross,
      patentUnitsSold,
      patentRoyalties,
      copackerCasesSold,
      copackerNet,
      totalRevenue,
      netProfit,
      recipeQuality: quality,
      reputationAfter: s.reputation,
      reputationTrend: ratingTrend,
      goldenStreak: s.goldenStreak,
      recipeJustLocked,
      houseOpened: false,
      trophyWon: null,
      flavorTaste: this.tasteFlavor(),   // after the factory sold: a new flavor counts from tomorrow
      upgradeSavings,
      soldOut: totalCupDemand > 0 && soldOutStands.length > 0,
      reviews,
      notes,
    };

    // The next money trophy (src/data/trophies.ts), once My Shelf is there to hold it: never on
    // the day the house opens (that is checked after this), and one a day at most.
    const trophy = TROPHIES[s.trophyDays.length];
    if (trophy && s.houseOpen && s.totalRevenueEarned.gte(trophy.sales)) {
      s.trophyDays.push(s.day);
      summary.trophyWon = trophy.id;
    }

    // My House opens on its own, on a day with nothing else to announce, or on any day once
    // sales pass the cap (src/data/house.ts).
    if (!s.houseOpen && s.totalRevenueEarned.gte(HOUSE_OPENS_AT_SALES) &&
        (s.totalRevenueEarned.gte(HOUSE_OPENS_ANYWAY_AT_SALES) || !otherUnlockToday(s, summary))) {
      s.houseOpen = true;
      summary.houseOpened = true;
    }

    s.lastDaySummary = summary;
    s.day += 1;

    this.rollNextForecast();
    // A new day: chores are ready again and the rest time goes back to normal.
    s.currentChore.remainingSec = 0;
    s.choresToday = 0;
    this.runHelpers();   // the new morning: helpers shop and set up before the kid looks

    return summary;
  }

  // Real time passing (seconds): the kid rests between chores.
  public tick(dt: number): void {
    const chore = this.state.currentChore;
    if (chore.remainingSec > 0) chore.remainingSec = Math.max(0, chore.remainingSec - dt);
  }
}

function emptyLedger(day: number): MoneyLedger {
  return {
    day, sales: 0, cups: 0, chores: 0,
    supplies: { lemons: 0, sugar: 0, ice: 0, cups: 0, bottles: 0 },
    shop: 0, shopIds: [], hiring: 0, storeUpgrades: 0, house: 0, wages: 0,
  };
}

// What one ledger spent on supplies, all of them together.
export function ledgerSupplies(l: MoneyLedger): number {
  return Object.values(l.supplies).reduce((a, b) => a + b, 0);
}

// Everything one ledger spent but wages (what the morning's shopping cost before the stand opens).
export function ledgerSpent(l: MoneyLedger): number {
  return ledgerSupplies(l) + l.shop + l.hiring + l.storeUpgrades + l.house;
}

// Money in minus money out for one ledger (what the kid really kept that day).
export function ledgerKept(l: MoneyLedger): number {
  return l.sales + l.chores - ledgerSpent(l) - l.wages;
}

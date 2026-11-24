import type { BigNum } from './bignum';

export type WeatherCondition = 'SUNNY' | 'CLOUDY' | 'RAINY';
export type SeasonName = 'SPRING' | 'SUMMER' | 'FALL' | 'WINTER';

export interface SeasonInfo {
  season: SeasonName;
  displayName: string;
  icon: string;
  dayInSeason: number;
  seasonLength: number;
  year: number;
  badge: string;
}

export type GamePhase = 1 | 2 | 3 | 4 | 5;
export type SupplyItem = 'lemons' | 'sugar' | 'ice' | 'cups' | 'bottles';

export interface CharacterProfile {
  hat?: string;
  sunglasses?: boolean;
  name: string;
  hairStyle: number; // index into the hair art (wraps around)
  skinTone: number;  // 0..4
  hairColor: number; // 0..4
  uniformColor: number; // 0..4
}

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
  dayOff?: boolean;      // stays off until toggled back: no sales or pay
}

// How one hired friend's stand did today (for the Day Report).
export interface FriendDayResult {
  id: string;
  workerName: string;
  standName: string;
  cups: number;
  revenue: number;
  wage: number;
  dayOff: boolean;
}

// How one signed store did today (for the Day Report).
export interface StoreDayResult {
  id: string;
  name: string;
  bottles: number;   // bottles sold
  wanted: number;    // bottles the store asked for
  revenue: number;
}

export interface WholesaleAccount {
  id: string;
  name: string;
  active: boolean;
  setupCost: number;
  bottlesPerDay: number;
  level: number;
  levels: { cost: number; bottlesPerDay: number }[];
  wholesalePrice: number;
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
  effect: (engine: any) => void;
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
  bubble?: string; // Short spoken version for the open-for-business scene.
  reviewer: string;
  sentiment: 'positive' | 'mixed' | 'negative';
  // What the review is about. The recipe card shows yesterday's 'taste' review.
  topic?: 'taste' | 'ice' | 'price' | 'team' | 'stock';
  // Taste reviews only: which taste-tester face goes with the comment.
  face?: 'happy' | 'sour' | 'sweet' | 'watery';
}

export interface DailyDemandEstimate {
  estDrivewayCups: number;
  franchiseEstimates: { id: string; name: string; workerName: string; estCups: number }[];
  storeEstimates: { id: string; name: string; estBottles: number }[];
  totalEstCups: number;
  neededLemons: number;
  neededSugar: number;
  neededIce: number;
  neededCups: number;
  neededBottles: number;
}

export interface PourableCapacity {
  maxCups: number;
  bottleneck: string;
  byCups: number;
  byIce: number;
  byLemons: number;
  bySugar: number;
}

export interface KidDemandAdvice {
  phrase: string;
  emoji: string;
  lowItems: ('lemons' | 'sugar' | 'ice' | 'cups' | 'bottles')[];
  fullItems: ('lemons' | 'ice')[];   // low, but storage is full (only an upgrade helps)
  isFullyStocked: boolean;
  estTotalCups: number;
}

export interface RecipeProfile {
  quality: number;
  tasteName: string;
  liquidColor: string;
}

export interface DaySummary {
  soldOutItem?: string;
  standVisits: import('./scene/dayScene').StandVisits[];
  day: number;
  tempF: number;
  weather: WeatherCondition;
  seasonInfo: SeasonInfo;
  seasonBadge: string;

  // Driveway Stand
  drivewayCupsSold: number;
  drivewayRevenue: number;

  // Franchise Stands (Phase 2+)
  franchiseCupsSold: number;
  franchiseGrossRevenue: number;
  franchiseWagesPaid: number;
  franchiseNet: number;
  friends: FriendDayResult[];    // each hired friend, in hiring-list order

  // Wholesale Bottling (Phase 3+)
  stores: StoreDayResult[];      // each signed store, in list order
  bottlesSold: number;
  wholesaleRevenue: number;
  packagingCosts: number;         // always 0 now (caps and labels are in the bottle price)
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
  // Reputation and buzz at the start and end of the day (0..1).
  reputationBefore: number;
  reputationAfter: number;
  reputationTrend: 'up' | 'down' | 'steady';
  buzzBefore: number;
  buzzAfter: number;
  goldenStreak: number;         // golden open days in a row, counting today
  recipeJustLocked: boolean;    // today the neighbors asked to keep the recipe forever
  houseOpened: boolean;         // the My House column opened at the end of today
  // Stand upgrades.
  iceMadeByMachine: number;     // cubes the ice machine made today
  iceKeptByCooler: number;      // leftover cubes the cooler kept frozen overnight
  lemonsKeptByFridge: number;   // lemons that would have gone bad without the mini-fridge
  upgradeSavings: number;       // what those were worth at store prices
  storageShort: '' | 'ice' | 'lemons';   // sold out because the stand could not hold more
  soldOut: boolean;             // some stand ran out before every customer got a cup
  reviews: CustomerReview[];
  notes: string[];
}

// Where one day's money came from and went (the Money Bag). A day's ledger starts after the
// previous day closes, so it holds that morning's shopping and that day's sales.
export interface MoneyLedger {
  day: number;
  sales: number;        // everything the business earned (lemonade, and later bottles etc.)
  cups: number;         // drinks sold
  chores: number;
  supplies: Record<SupplyItem, number>;
  shop: number;         // stand upgrades and business projects
  shopIds: string[];    // which ones, for the picture
  treats: number;       // trophies
  hiring: number;       // franchise stand setup and wholesale sign-up
  storeUpgrades: number; // expanded store shelves
  house: number;        // house upgrades (src/data/house.ts)
  wages: number;        // franchise workers
  packaging: number;    // wholesale bottles
}

export interface GoldenRecipe {
  lemons: number;
  sugar: number;
}

export interface GameState {
  phase: GamePhase;
  elapsedSec: number;
  day: number;
  tempF: number;
  weather: WeatherCondition;
  seasonInfo?: SeasonInfo;
  reputation: number;        // [0.1, 1.0] what neighbors say about the lemonade
  buzz: number;              // [0, 1] share of the neighborhood that knows the stand exists
  choresToday: number;       // chores done since the day started; each makes the next rest longer
  bestRecipeQuality: number;
  avgRecipeQuality: number;
  totalQualityDays: number;
  totalQualitySum: number;
  brandMultiplier: number;
  gameWon: boolean;

  // Working Capital & Inventory
  cash: BigNum;
  totalCupsSold: BigNum;
  reputationHistory: number[];  // recent daily ratings, for the report trend
  totalRevenueEarned: BigNum;
  totalBottlesSold: number;
  totalSqueezersSold: number;   // lifetime lemon squeezers sold (opens the squeezer steps)
  totalStandCupsSold: number;

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
  // This game's best-tasting lemons:sugar per pitcher (picked from the seed at the start).
  goldenRecipe: GoldenRecipe;
  goldenStreak: number;
  // How many days each kid tip has been shown ('melt', 'rot'), so long tips can get shorter.
  tipCounts: Record<string, number>;
  recipeLocked: boolean;     // neighbors asked to keep it: lemons:sugar stay golden for good

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
    // Helpers that take over the small daily jobs (src/data/projects.ts, engine.runHelpers).
    hasSupplyTruck: boolean;     // buys each morning's supplies
    hasStandCaptain: boolean;    // runs the stands: the price, who works, hiring
    hasDeliveryRoute: boolean;   // runs the stores: signing up and bigger shelves

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
  lastShopPurchaseDay?: number; // spaces the next kid shop item
  friendExpansion?: { day: number; cups: number };
  storeExpansion?: { day: number; bottles: number };
  houseOpen: boolean;    // the My House column is open (HOUSE_OPENS_AT_SALES, src/data/house.ts)
  houseLevel: number;    // house steps bought (src/data/house.ts); 0: none
  houseColor: string;    // wall color id (HOUSE_COLORS), shown once Fresh Paint is bought
  ledger?: MoneyLedger;         // today so far
  lastLedger?: MoneyLedger;     // the last finished day
  upgradeSavingsTotal: number;  // everything the stand upgrades have saved, all game
  grossProfitTotal: number;     // sales minus supplies, wages and bottles, all game
  logs: string[];
}

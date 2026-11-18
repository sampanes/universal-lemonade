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
  name: string;
  hairStyle: number; // 0..11
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
  totalEstCups: number;
  neededLemons: number;
  neededSugar: number;
  neededIce: number;
  neededCups: number;
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
  lowItems: ('lemons' | 'sugar' | 'ice' | 'cups')[];
  isFullyStocked: boolean;
  estTotalCups: number;
}

export interface RecipeProfile {
  quality: number;
  tasteName: string;
  liquidColor: string;
}

export interface DaySummary {
  day: number;
  tempF: number;
  weather: WeatherCondition;
  seasonInfo?: SeasonInfo;
  seasonBadge?: string;

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
  // Reputation at the start and end of the day (0..1). Optional so older saves still load.
  reputationBefore?: number;
  reputationAfter?: number;
  buzzBefore?: number;
  buzzAfter?: number;
  goldenStreak?: number;        // golden open days in a row, counting today
  recipeJustLocked?: boolean;   // today the neighbors asked to keep the recipe forever
  reviews: CustomerReview[];
  notes: string[];
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
  // This game's best-tasting lemons:sugar per pitcher (picked from the seed at the start).
  goldenRecipe: GoldenRecipe;
  goldenStreak: number;      // open days in a row sold at the exact golden lemons:sugar
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

import type { BigNum } from './bignum';
import type { LemonadeEngine } from './engine';
import type { StandVisits } from './scene/dayScene';

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
  hairStyle: number; // index into the hair art (wraps around)
  skinTone: number;  // 0..4
  hairColor: number; // 0..4
  uniformColor: number; // 0..4
}

export interface FranchiseStand {
  id: string;
  name: string;          // the place ("Elm Street")
  workerName: string;
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

// Something the Stand Shop sells (src/data/projects.ts).
export interface ProjectDef {
  id: string;
  name: string;
  desc: string;
  phase: GamePhase;      // the stage it is bought in (sim/jump.ts buys the earlier ones)
  costCash: number;
  purchased: boolean;
  unlocked: (state: GameState) => boolean;
  effect: (engine: LemonadeEngine) => void;
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

export interface KidDemandAdvice {
  phrase: string;
  lowItems: SupplyItem[];
  fullItems: ('lemons' | 'ice')[];   // low, but storage is full (only an upgrade helps)
  isFullyStocked: boolean;
}

export interface RecipeProfile {
  quality: number;
  tasteName: string;
  liquidColor: string;
}

// What the Flavor Lab's taste testers said about today's mix (src/data/flavors.ts).
export interface FlavorTaste {
  id: string;            // the flavor
  fruit: number;         // the mix they tasted
  sugar: number;
  review: CustomerReview;
  launched: boolean;     // it was just right: the flavor went to the stores today
}

export interface DaySummary {
  soldOutItem?: string;
  standVisits: StandVisits[];
  day: number;
  tempF: number;
  weather: WeatherCondition;
  seasonInfo: SeasonInfo;

  // The kid's own stand
  drivewayCupsSold: number;
  drivewayRevenue: number;

  // Friends' stands (Stage 2+)
  franchiseCupsSold: number;
  franchiseGrossRevenue: number;
  franchiseWagesPaid: number;
  friends: FriendDayResult[];    // each hired friend, in hiring-list order

  // Stores (Stage 3+)
  stores: StoreDayResult[];      // each signed store, in list order
  bottlesSold: number;
  wholesaleRevenue: number;

  // The lemon squeezer (Stage 4+)
  patentUnitsSold: number;
  patentRoyalties: number;

  // The lemonade factory (Stage 5)
  copackerCasesSold: number;
  copackerNet: number;

  // The day's totals (the friends' wages are the only cost the day itself has)
  totalRevenue: number;
  netProfit: number;

  recipeQuality: number;
  reputationAfter: number;      // what the neighbors say at the end of the day (0..1)
  reputationTrend: 'up' | 'down' | 'steady';
  goldenStreak: number;         // golden open days in a row, counting today
  recipeJustLocked: boolean;    // today the neighbors asked to keep the recipe forever
  houseOpened: boolean;         // the My House column opened at the end of today
  trophyWon: string | null;     // the money trophy won today (src/data/trophies.ts)
  flavorTaste?: FlavorTaste | null;   // the Flavor Lab's tasting today (Stage 5)
  upgradeSavings: number;       // free ice used and lemons the fridge kept, at store prices
  soldOut: boolean;            // some stand ran out before every customer got a cup
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
  shop: number;         // the Stand Shop (src/data/projects.ts) and brand moves
  shopIds: string[];    // which ones, for the picture ("brand:<id>" for a brand move)
  hiring: number;       // franchise stand setup and wholesale sign-up
  storeUpgrades: number; // expanded store shelves
  house: number;        // house upgrades and yard things (src/data/house.ts, src/data/yard.ts)
  wages: number;        // franchise workers
}

export interface GoldenRecipe {
  lemons: number;
  sugar: number;
}

export interface GameState {
  phase: GamePhase;
  day: number;
  tempF: number;
  weather: WeatherCondition;
  reputation: number;        // [0.1, 1.0] what neighbors say about the lemonade
  buzz: number;              // [0, 1] share of the neighborhood that knows the stand exists
  choresToday: number;       // chores done since the day started; each makes the next rest longer
  // How good the recipe has tasted: the best day, and recent days (an EWMA). A tasty recipe
  // opens the second stand (src/data/projects.ts).
  bestRecipeQuality: number;
  avgRecipeQuality: number;
  gameWon: boolean;      // Citrus Cay was bought
  endingSeen: boolean;   // the Citrus Cay ending was shown (it plays once; then the game goes on)

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

  // What the Stand Shop's upgrades turned on (src/data/projects.ts)
  flags: {
    hasMiniFridge: boolean;
    hasClubCard: boolean;
    hasCommercialLabeler: boolean;
    hasAutoIce: boolean;         // the ice machine: makes the ice and picks how much per cup
    // Helpers that take over the small daily jobs (src/data/projects.ts, engine.runHelpers).
    hasSupplyTruck: boolean;     // buys each morning's supplies
    hasStandCaptain: boolean;    // runs the stands: the price, who works, hiring
    hasDeliveryRoute: boolean;   // runs the stores: signing up and bigger shelves
    hasFlavorLab: boolean;       // the factory invents flavors (src/data/flavors.ts)

    // Two of the big dreams (the third, Citrus Cay, sets gameWon)
    hasPrivateJet: boolean;
    hasArenaNaming: boolean;
  };

  currentChore: ChoreState;
  lastDaySummary: DaySummary | null;
  lastShopPurchaseDay?: number; // spaces the next kid shop item
  // The day each thing on My Shelf (src/ui/shelf.js) was bought: a project id, "brand:<id>"
  // for a brand move, "yard:<id>" for a yard thing.
  boughtOn: Record<string, number>;
  trophyDays: number[];  // the day each money trophy was won, in TROPHIES order (src/data/trophies.ts)
  wallpaper: string;     // the page's wallpaper (WALLPAPERS); 'plain' until a trophy brings one
  friendExpansion?: { day: number; cups: number };
  storeExpansion?: { day: number; bottles: number };
  houseOpen: boolean;    // the My House column is open (HOUSE_OPENS_AT_SALES, src/data/house.ts)
  houseLevel: number;    // house steps bought (src/data/house.ts); 0: none
  houseColor: string;    // wall color id (HOUSE_COLORS), shown once Fresh Paint is bought
  yard: string[];        // yard things bought, in YARD_STEPS order (src/data/yard.ts)
  // The Flavor Lab (src/data/flavors.ts): the flavors in stores so far (FLAVORS order), and
  // the fruit and sugar scoops in the flavor being tasted now.
  flavorsLaunched: string[];
  flavorMix: { fruit: number; sugar: number };
  brandLevel: number;        // brand moves bought (src/data/brand.ts); 0: none
  lastBrandDay?: number;     // the day of the last one (the next opens the day after)
  ledger?: MoneyLedger;         // today so far
  lastLedger?: MoneyLedger;     // the last finished day
  upgradeSavingsTotal: number;  // everything the stand upgrades have saved, all game
}

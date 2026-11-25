// src/balance.ts -- Every tuning number for the economy, in one place.
//
// Change a value here, then run the simulator (npm run sim) to see what it does to pacing.
// Content tables (which projects, big dreams, franchise stands, wholesale accounts and chores
// exist, and their prices) live in src/data/. This file holds the formula constants.
//
// The engine takes a Balance in its constructor, so the simulator can try variations
// without editing this file:  new LemonadeEngine({ balance: { ...BALANCE, ... } })

export interface SupplyPack { qty: number; cost: number }

export interface SeasonWeather {
  tempCurve: number[];          // base temperature for each day of the season
  sunnyBelow: number;           // roll < sunnyBelow -> SUNNY
  cloudyBelow: number;          // roll < cloudyBelow -> CLOUDY, else RAINY
  delta: { SUNNY: number; CLOUDY: number; RAINY: number };  // degrees added for the weather
  jitter: number;               // +/- jitter/2 degrees of random noise
}

export const BALANCE = {
  start: {
    cash: 60.0,
    inventory: { lemons: 24, sugar: 20, ice: 200, cups: 50, bottles: 0 },
    recipe: { lemonsPerPitcher: 1, sugarPerPitcher: 1, icePerCup: 1, pricePerCup: 1.0 },
    reputation: 0.5,
  },

  // Sales needed after an expansion. The first friend and store are available immediately.
  expansion: { friendCups: [150, 300], storeBottles: 75, daysBetween: 2 },

  // What one tap of a buy button gets, before upgrades.
  supplies: {
    lemons: { qty: 24, cost: 8.0 },
    sugar: { qty: 20, cost: 6.0 },
    ice: { qty: 200, cost: 4.0 },
    cups: { qty: 50, cost: 4.0 },
    // A ready-to-fill bottle: glass, cap and label in one price (about what the empty
    // bottle plus the old separate packing charge came to).
    bottles: { qty: 25, cost: 32.5 },
  } as Record<'lemons' | 'sugar' | 'ice' | 'cups' | 'bottles', SupplyPack>,
  costcoPriceMult: 0.65,        // Costco upgrade: packs cost this much

  recipe: {
    // The golden ratio is picked per game (from the game seed) inside these ranges, so a kid
    // has to taste-test instead of memorizing it. Quality falls off with squared distance.
    goldenLemons: { min: 3, max: 5 },
    goldenSugar: { min: 3, max: 5 },
    lemonWeight: 0.08,
    sugarWeight: 0.08,
    iceWeight: 0.12,
    cupsPerPitcherBase: 10,     // cups per pitcher = this + ice per cup
    // Selling the exact golden lemons:sugar this many open days in a row makes the neighbors
    // ask the kid to never change it: the recipe locks at golden and its controls go away.
    // Only days with at least one cup sold count (nobody tasted otherwise); ice and price
    // do not matter. Changing lemons or sugar away from golden starts the count over.
    lockStreak: 3,
  },

  ice: {
    // Ideal ice per cup = round((tempF - zeroAtF) / degreesPerCube), clamped.
    zeroAtF: 50,
    degreesPerCube: 7,
    min: 1,
    max: 8,
  },

  demand: {
    weatherMult: { SUNNY: 1.0, CLOUDY: 0.65, RAINY: 0.25 },
    // Temperature traffic factor = max(minTempFactor, 1 + tempSlope * (tempF - refF) / tempSpan)
    minTempFactor: 0.3,
    tempSlope: 0.8,
    refF: 70,
    tempSpan: 30,
    // Fair price = fairPriceBase * (1 + fairPriceTempSlope * (tempF - refF)) * reputation factor
    fairPriceBase: 2.0,
    fairPriceTempSlope: 0.02,
    minPriceForRatio: 0.25,
    // buy chance = quality * (fair / price) ^ priceExponent. Charging under the fair price
    // only helps until everyone who walks by buys; below that it just earns less per cup.
    // There is no "too cheap looks fake" penalty: the simulator showed ingredient costs
    // already punish it (always charging 50 cents rarely gets past the driveway stage).
    priceExponent: 1.8,
    fridgeTrafficMult: 1.10,     // more people visit after the fridge upgrade
    // Franchise stand traffic reputation factor = base + perRep * reputation
    franchiseRepBase: 0.6,
    franchiseRepPerRep: 0.4,
  },

  // Buzz: how much of the neighborhood knows the stand exists (0..1). A new stand is a
  // secret, so business starts slow. It spreads like a meme (the Bass diffusion model):
  //   new fans = (1 - buzz) * (discovery + wordOfMouth * happyCustomers / neighbors)
  // where happyCustomers = cups sold today * how happy they were (the reputation day score).
  // Cheap prices mean more customers, so the word spreads faster but each cup earns less.
  // A small share forget each day, so a stand that stops selling slowly fades.
  // Driveway foot traffic = (walkBy + buzz * neighbors * (trafficBase + reputation)) * weather.
  // Tuned with the simulator: a perfect player sells about 10 cups on day 1, 40 on day 5
  // and 85 on day 10 (a hot summer day); buzz is around 0.9 by day 10.
  buzz: {
    start: 0.0,
    walkBy: 18,                 // people who pass by anyway, before weather
    neighbors: 60,              // people who would come if the whole neighborhood knew
    discovery: 0.02,            // share of the unaware who notice the stand each day
    wordOfMouth: 0.25,          // how strongly each happy customer spreads the word
    forget: 0.02,               // share of buzz lost each day
  },

  reputation: {
    alpha: 0.25,               // EWMA weight of today's customer score
    qualityAlpha: 0.3,         // recipe quality keeps its existing responsiveness
    excessivePriceRatio: 1.4,   // same threshold as the strongest price complaint
    excessivePriceDrop: 0.02,   // minimum reputation loss when people see that price
    min: 0.1,
    max: 1.0,
    // Pricing power: fair price is multiplied by priceBase + pricePerRep * reputation
    priceBase: 0.75,
    pricePerRep: 0.5,
    // Neighbors who know the stand come more if they hear good things: trafficBase + reputation
    trafficBase: 0.5,
    // Day score = taste * value * (servedBase + servedPerServed * fraction served), where
    // taste = quality ^ tasteExponent. A higher exponent makes word of mouth pickier: a
    // "close to golden" recipe sells almost as well today but builds less reputation, so it
    // earns clearly less over time than the exact golden recipe.
    tasteExponent: 1,
    // Word of mouth only raves about the exact golden lemons:sugar. Any other recipe's taste
    // score is multiplied by this, so "almost golden" builds noticeably less reputation
    // while far-off recipes (already low) are barely affected. 1 = no golden bonus.
    offGoldenTasteMult: 0.75,
    servedBase: 0.75,
    servedPerServed: 0.25,
  },

  // How much the stand can hold (src/simulation/storage.ts). The ice machine and the
  // mini-fridge remove the limit for ice and lemons. A buy button only sells what fits
  // (a part pack costs its share), so leftovers never waste room.
  storage: {
    iceBucket: 400,             // cubes, before the ice machine (2 bags)
    lemonBowl: 24,              // lemons, before the mini-fridge (one bag)
  },

  spoilage: {
    lemonRotFraction: 0.30,     // share of leftover lemons lost overnight without a fridge
  },

  wholesale: {
    lemonsPerBottle: 0.5,
    sugarPerBottle: 0.4,
    labelerBottleMult: 0.70,    // the labeler: bottles cost this much of the price
  },

  patent: {
    royaltyPerUnit: 2.5,
    baseUnitsPerDay: 50,         // SQUEEZER_LEVELS level 1 (src/data/projects.ts)
    randomMin: 0.8,             // units = base * (randomMin + rand * randomRange) * boosts
    randomRange: 0.4,
    privateJetMult: 2.0,        // the Lemonade Jet dream
  },

  copacker: {
    casesPerDay: 40,
    netPerCase: 18.0,
    randomMin: 0.85,
    randomRange: 0.3,
    arenaMult: 2.0,             // the Lemonade Arena dream
  },

  chores: {
    rewardMult: 0.6,            // chore pay = the chore's listed dollars * this, rounded
    cooldownMinSec: 8,
    cooldownRandomSec: 10,
    // Each chore done today makes the next rest longer: rest = rolled rest * growth^(chores
    // done today - 1). It resets when a new day starts. No hard limit, but tapping chores
    // all day stops paying: with 1.8 the 6th chore of a day rests about 2 minutes, the 10th
    // about 25 minutes.
    cooldownGrowth: 1.8,
  },

  weather: {
    seasonLength: 5,
    minF: 32,
    maxF: 108,
    seasons: {
      SPRING: { tempCurve: [53, 58, 64, 69, 75], sunnyBelow: 0.55, cloudyBelow: 0.80, delta: { SUNNY: 3, CLOUDY: -2, RAINY: -6 }, jitter: 5 },
      SUMMER: { tempCurve: [82, 88, 96, 92, 85], sunnyBelow: 0.70, cloudyBelow: 0.85, delta: { SUNNY: 4, CLOUDY: -2, RAINY: -5 }, jitter: 6 },
      FALL: { tempCurve: [76, 70, 63, 56, 49], sunnyBelow: 0.55, cloudyBelow: 0.85, delta: { SUNNY: 2, CLOUDY: -2, RAINY: -5 }, jitter: 5 },
      WINTER: { tempCurve: [46, 41, 36, 42, 47], sunnyBelow: 0.45, cloudyBelow: 0.80, delta: { SUNNY: 2, CLOUDY: -2, RAINY: -5 }, jitter: 5 },
    } as Record<'SPRING' | 'SUMMER' | 'FALL' | 'WINTER', SeasonWeather>,
  },

  secondsPerDay: 30,
};

export type Balance = typeof BALANCE;

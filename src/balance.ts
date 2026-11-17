// src/balance.ts -- Every tuning number for the economy, in one place.
//
// Change a value here, then run the simulator (npm run sim) to see what it does to pacing.
// Content tables (which projects, trophies, franchise stands, wholesale accounts and chores
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

  // What one tap of a buy button gets, before upgrades.
  supplies: {
    lemons: { qty: 24, cost: 8.0 },
    sugar: { qty: 20, cost: 6.0 },
    ice: { qty: 200, cost: 4.0 },
    cups: { qty: 50, cost: 4.0 },
    bottles: { qty: 25, cost: 10.0 },
  } as Record<'lemons' | 'sugar' | 'ice' | 'cups' | 'bottles', SupplyPack>,
  costcoPriceMult: 0.65,        // Costco upgrade: packs cost this much
  bikePackMult: 1.25,           // Mountain bike trophy: packs hold this much more

  recipe: {
    // The golden ratio. Quality falls off with squared distance from it.
    idealLemons: 4,
    idealSugar: 4,
    lemonWeight: 0.08,
    sugarWeight: 0.08,
    iceWeight: 0.12,
    cupsPerPitcherBase: 10,     // cups per pitcher = this + ice per cup
  },

  ice: {
    // Ideal ice per cup = round((tempF - zeroAtF) / degreesPerCube), clamped.
    zeroAtF: 50,
    degreesPerCube: 7,
    min: 1,
    max: 8,
  },

  demand: {
    drivewayBaseTraffic: 65,
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
    priceExponent: 1.8,         // buy chance = quality * (fair / price) ^ priceExponent
    // Franchise stand traffic reputation factor = base + perRep * reputation
    franchiseRepBase: 0.6,
    franchiseRepPerRep: 0.4,
    ipadFranchiseMult: 1.10,
  },

  reputation: {
    alpha: 0.3,                 // EWMA weight of today's customer score
    min: 0.1,
    max: 1.0,
    // Pricing power: fair price is multiplied by priceBase + pricePerRep * reputation
    priceBase: 0.75,
    pricePerRep: 0.5,
    // Driveway traffic multiplier = trafficBase + reputation
    trafficBase: 0.5,
    // Day score = taste * value * (servedBase + servedPerServed * fraction served)
    servedBase: 0.75,
    servedPerServed: 0.25,
    // Lasting boosts added to every day's score
    bonusMiniFridge: 0.10,
    bonusNintendoSwitch: 0.05,
    bonusDisneyTrip: 0.15,
  },

  spoilage: {
    lemonRotFraction: 0.20,     // share of leftover lemons lost overnight without a fridge
  },

  wholesale: {
    lemonsPerBottle: 0.5,
    sugarPerBottle: 0.4,
    civicPackagingMult: 0.70,
  },

  patent: {
    royaltyPerUnit: 2.5,
    baseUnitsPerDay: 16,
    randomMin: 0.8,             // units = base * (randomMin + rand * randomRange) * boosts
    randomRange: 0.4,
    teslaBonus: 0.20,
    privateJetMult: 2.0,
  },

  copacker: {
    casesPerDay: 40,
    netPerCase: 18.0,
    randomMin: 0.85,
    randomRange: 0.3,
    arenaMult: 2.0,
  },

  // One-time effects when a trophy is bought (lasting reputation boosts are above).
  trophies: {
    nintendoReputationBump: 0.05,
    disneyReputationBump: 0.15,
    scooterCapacityMult: 1.15,
    arcadeBrandMult: 1.15,
    collegeBrandMult: 1.25,
  },

  projects: {
    fridgeReputationBump: 0.1,
  },

  chores: {
    cooldownMinSec: 8,
    cooldownRandomSec: 10,
    skateboardCooldownMult: 0.75,
    skateboardMinCooldownSec: 5,
  },

  weather: {
    seasonLength: 5,
    minF: 32,
    maxF: 108,
    lockedTempF: 95,            // weather control upgrade
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

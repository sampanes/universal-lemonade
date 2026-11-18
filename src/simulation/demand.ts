// src/simulation/demand.ts -- How many cups people want, for the forecast and the real day.
import type { GameState, FranchiseStand, DailyDemandEstimate, KidDemandAdvice, PourableCapacity } from '../types';
import { computeRecipeQuality, cupsPerPitcher as pitcherCups } from './recipe';
import { buyProbability, drivewayPeople, fairPriceFor } from './reputation';
import { BALANCE, type Balance } from '../balance';

export interface StandDemand {
  id: string;
  name: string;
  workerName: string;
  demand: number;
  wage: number;
  isDriveway: boolean;
}

export interface DayDemand {
  weatherMult: number;
  tempFactor: number;
  quality: number;
  fairPrice: number;
  buyProb: number;
  stands: StandDemand[];       // driveway first, then hired franchise stands
  totalCupDemand: number;
}

// The one place cup demand is computed. Engine.runDay sells against it and the morning
// forecast shows it, so the two cannot disagree.
export function computeDayDemand(
  s: GameState,
  franchiseStands: Record<string, FranchiseStand>,
  b: Balance = BALANCE
): DayDemand {
  const d = b.demand;
  const weatherMult = d.weatherMult[s.weather];
  const tempFactor = Math.max(d.minTempFactor, 1 + d.tempSlope * ((s.tempF - d.refF) / d.tempSpan));
  const quality = computeRecipeQuality(s.recipe, s.tempF, s.goldenRecipe, b);
  const fairPrice = fairPriceFor(s.tempF, s.reputation, b);
  const buyProb = buyProbability(quality, s.tempF, s.recipe.pricePerCup, s.reputation, b);

  const drivewayTraffic = Math.floor(drivewayPeople(s.buzz ?? 0, s.reputation, b) * weatherMult * tempFactor);
  const stands: StandDemand[] = [
    { id: 'driveway', name: 'Driveway Stand', workerName: 'You', demand: Math.floor(drivewayTraffic * buyProb), wage: 0, isDriveway: true }
  ];

  if (s.phase >= 2) {
    const efficiencyBonus = s.flags.hasIpadPro ? d.ipadFranchiseMult : 1.0;
    for (const stand of Object.values(franchiseStands)) {
      if (!stand.hired) continue;
      const standTraffic = Math.floor(
        stand.baseCapacity *
        Math.pow(weatherMult * tempFactor, stand.weatherSens) *
        (d.franchiseRepBase + s.reputation * d.franchiseRepPerRep) *
        efficiencyBonus
      );
      stands.push({
        id: stand.id,
        name: stand.name,
        workerName: stand.workerName,
        demand: Math.floor(standTraffic * buyProb),
        wage: stand.dailyWage,
        isDriveway: false
      });
    }
  }

  const totalCupDemand = stands.reduce((sum, st) => sum + st.demand, 0);
  return { weatherMult, tempFactor, quality, fairPrice, buyProb, stands, totalCupDemand };
}

export function getDailyDemandEstimate(
  state: GameState,
  franchiseStands: Record<string, FranchiseStand>,
  b: Balance = BALANCE
): DailyDemandEstimate {
  const s = state;
  const day = computeDayDemand(s, franchiseStands, b);
  const estDriveway = day.stands[0].demand;
  const franchiseEstimates = day.stands
    .filter(st => !st.isDriveway)
    .map(st => ({ id: st.id, name: st.name, workerName: st.workerName, estCups: st.demand }));
  const totalCups = day.totalCupDemand;

  const cupsPerPitcher = pitcherCups(s.recipe.icePerCup, b);
  const pitchers = Math.ceil(totalCups / cupsPerPitcher);
  const neededLemons = pitchers * s.recipe.lemonsPerPitcher;
  const neededSugar = pitchers * s.recipe.sugarPerPitcher;
  const neededIce = totalCups * s.recipe.icePerCup;
  const neededCups = totalCups;

  return {
    estDrivewayCups: estDriveway,
    franchiseEstimates,
    totalEstCups: totalCups,
    neededLemons,
    neededSugar,
    neededIce,
    neededCups
  };
}

export function getKidDemandAdvice(
  state: GameState,
  franchiseStands: Record<string, FranchiseStand>,
  b: Balance = BALANCE
): KidDemandAdvice {
  const est = getDailyDemandEstimate(state, franchiseStands, b);
  const s = state;

  const lowItems: ('lemons' | 'sugar' | 'ice' | 'cups')[] = [];
  if (s.inv.lemons < est.neededLemons) lowItems.push('lemons');
  if (s.inv.sugar < est.neededSugar) lowItems.push('sugar');
  if (s.inv.ice < est.neededIce) lowItems.push('ice');
  if (s.inv.cups < est.neededCups) lowItems.push('cups');

  if (lowItems.length === 0) {
    return {
      phrase: "Pantry is fully stocked and ready to pour!",
      emoji: "✨",
      lowItems: [],
      isFullyStocked: true,
      estTotalCups: est.totalEstCups
    };
  }

  if (lowItems.length === 4) {
    return {
      phrase: "You need more of everything today!",
      emoji: "📦",
      lowItems,
      isFullyStocked: false,
      estTotalCups: est.totalEstCups
    };
  }

  if (lowItems.length === 1) {
    const single = lowItems[0];
    if (single === 'ice') {
      return {
        phrase: s.tempF >= 80 ? "You'll need a lot more ice for today's heat!" : "Running low on ice cubes!",
        emoji: "🧊",
        lowItems,
        isFullyStocked: false,
        estTotalCups: est.totalEstCups
      };
    }
    if (single === 'lemons') {
      return {
        phrase: "Almost out of lemons! Squeeze some more into the pantry!",
        emoji: "🍋",
        lowItems,
        isFullyStocked: false,
        estTotalCups: est.totalEstCups
      };
    }
    if (single === 'sugar') {
      return {
        phrase: "Need a little more sugar to keep the lemonade sweet!",
        emoji: "🍬",
        lowItems,
        isFullyStocked: false,
        estTotalCups: est.totalEstCups
      };
    }
    if (single === 'cups') {
      return {
        phrase: "Running low on paper cups! Grab another pack!",
        emoji: "🥤",
        lowItems,
        isFullyStocked: false,
        estTotalCups: est.totalEstCups
      };
    }
  }

  // 2 or 3 items low
  const itemNames = lowItems.map(i => {
    if (i === 'lemons') return 'lemons';
    if (i === 'sugar') return 'sugar';
    if (i === 'ice') return 'ice';
    return 'cups';
  });

  const readable = itemNames.length === 2
    ? `${itemNames[0]} and ${itemNames[1]}`
    : `${itemNames[0]}, ${itemNames[1]}, and ${itemNames[2]}`;

  return {
    phrase: `Stock up on ${readable} before opening!`,
    emoji: "🛒",
    lowItems,
    isFullyStocked: false,
    estTotalCups: est.totalEstCups
  };
}

export function getMaxPourableCups(state: GameState, b: Balance = BALANCE): PourableCapacity {
  const s = state;
  const cupsPerPitcher = pitcherCups(s.recipe.icePerCup, b);
  const byCups = s.inv.cups;
  const byIce = s.recipe.icePerCup > 0 ? Math.floor(s.inv.ice / s.recipe.icePerCup) : 999999;
  const byLemons = Math.floor(s.inv.lemons / Math.max(1, s.recipe.lemonsPerPitcher)) * cupsPerPitcher;
  const bySugar = Math.floor(s.inv.sugar / Math.max(1, s.recipe.sugarPerPitcher)) * cupsPerPitcher;
  const maxCups = Math.min(byCups, byIce, byLemons, bySugar);

  const bottlenecks: string[] = [];
  if (byCups === maxCups) bottlenecks.push('Cups');
  if (byIce === maxCups) bottlenecks.push(`Ice (${s.recipe.icePerCup} cubes/cup)`);
  if (byLemons === maxCups) bottlenecks.push('Lemons');
  if (bySugar === maxCups) bottlenecks.push('Sugar');

  return {
    maxCups,
    bottleneck: bottlenecks.join(' & '),
    byCups,
    byIce,
    byLemons,
    bySugar
  };
}

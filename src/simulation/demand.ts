// src/simulation/demand.ts -- How many cups people want, for the forecast and the real day.
import type { GameState, FranchiseStand, DailyDemandEstimate, KidDemandAdvice, PourableCapacity } from '../types';
import { computeRecipeQuality, cupsPerPitcher as pitcherCups } from './recipe';
import { buyProbability, drivewayPeople, fairPriceFor } from './reputation';
import { BALANCE, type Balance } from '../balance';
import { storageCap } from './storage';

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
  if (s.inv.ice < est.neededIce && !s.flags.hasAutoIce) lowItems.push('ice');   // the machine makes it
  if (s.inv.cups < est.neededCups) lowItems.push('cups');
  // Low, but the stand cannot hold any more: only an upgrade fixes it.
  const fullItems = lowItems.filter(i => s.inv[i] >= storageCap(s, i, b)) as ('lemons' | 'ice')[];

  if (lowItems.length === 0) {
    return {
      phrase: "Pantry is fully stocked and ready to pour!",
      emoji: "✨",
      lowItems: [],
      fullItems: [],
      isFullyStocked: true,
      estTotalCups: est.totalEstCups
    };
  }

  if (fullItems.length === lowItems.length) {
    const item = fullItems[0];
    return {
      // Short enough for one line in the tip row (the Day Report spells it out).
      phrase: item === 'ice'
        ? (s.flags.hasCooler ? "Cooler full! An ice machine makes all you need!" : "Ice bucket full! An ice machine makes all you need!")
        : "Fruit bowl full! A mini-fridge holds all you want!",
      emoji: "",
      lowItems,
      fullItems,
      isFullyStocked: false,
      estTotalCups: est.totalEstCups
    };
  }

  const buyable = lowItems.filter(i => !(fullItems as string[]).includes(i));

  if (buyable.length === 4) {
    return {
      phrase: "You need more of everything today!",
      emoji: "📦",
      lowItems,
      fullItems,
      isFullyStocked: false,
      estTotalCups: est.totalEstCups
    };
  }

  if (buyable.length === 1) {
    const single = buyable[0];
    if (single === 'ice') {
      return {
        phrase: s.tempF >= 80 ? "You'll need a lot more ice for today's heat!" : "Running low on ice cubes!",
        emoji: "🧊",
        lowItems,
        fullItems,
        isFullyStocked: false,
        estTotalCups: est.totalEstCups
      };
    }
    if (single === 'lemons') {
      return {
        phrase: "Almost out of lemons! Grab another bag!",
        emoji: "🍋",
        lowItems,
        fullItems,
        isFullyStocked: false,
        estTotalCups: est.totalEstCups
      };
    }
    if (single === 'sugar') {
      return {
        phrase: "Need more sugar to keep it sweet!",
        emoji: "🍬",
        lowItems,
        fullItems,
        isFullyStocked: false,
        estTotalCups: est.totalEstCups
      };
    }
    if (single === 'cups') {
      return {
        phrase: "Running low on paper cups! Grab another pack!",
        emoji: "🥤",
        lowItems,
        fullItems,
        isFullyStocked: false,
        estTotalCups: est.totalEstCups
      };
    }
  }

  // 2 or 3 items low
  const itemNames = buyable.map(i => {
    if (i === 'lemons') return 'lemons';
    if (i === 'sugar') return 'sugar';
    if (i === 'ice') return 'ice';
    return 'cups';
  });

  const readable = itemNames.length === 2
    ? `${itemNames[0]} and ${itemNames[1]}`
    : `${itemNames[0]}, ${itemNames[1]}, and ${itemNames[2]}`;

  return {
    phrase: itemNames.length === 2 ? `Stock up on ${readable} before opening!` : `Stock up on ${readable}!`,
    emoji: "🛒",
    lowItems,
    fullItems,
    isFullyStocked: false,
    estTotalCups: est.totalEstCups
  };
}

export function getMaxPourableCups(state: GameState, b: Balance = BALANCE): PourableCapacity {
  const s = state;
  const cupsPerPitcher = pitcherCups(s.recipe.icePerCup, b);
  const byCups = s.inv.cups;
  const byIce = s.recipe.icePerCup > 0 && !s.flags.hasAutoIce ? Math.floor(s.inv.ice / s.recipe.icePerCup) : 999999;
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

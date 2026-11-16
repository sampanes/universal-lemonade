// src/simulation/demand.ts — Demand Estimation & Kid-Friendly Advisor
import type { GameState, FranchiseStand, DailyDemandEstimate, KidDemandAdvice, PourableCapacity } from '../types';
import { computeRecipeQuality } from './recipe';

export function getDailyDemandEstimate(
  state: GameState,
  franchiseStands: Record<string, FranchiseStand>
): DailyDemandEstimate {
  const s = state;
  const weatherMult = s.weather === 'SUNNY' ? 1.0 : s.weather === 'CLOUDY' ? 0.65 : 0.25;
  const tempFactor = Math.max(0.3, 1 + 0.8 * ((s.tempF - 70) / 30));
  const quality = computeRecipeQuality(s.recipe, s.tempF);
  const fairPrice = 2.00 * (1 + 0.02 * (s.tempF - 70));
  const priceRatio = fairPrice / Math.max(0.25, s.recipe.pricePerCup);
  const buyProb = Math.max(0, Math.min(1, quality * Math.pow(priceRatio, 1.8)));

  const estDriveway = Math.floor(65 * weatherMult * tempFactor * (0.5 + s.reputation) * buyProb);
  let totalCups = estDriveway;

  const franchiseEstimates: { id: string; name: string; workerName: string; estCups: number }[] = [];
  if (s.phase >= 2) {
    const efficiencyBonus = s.flags.hasIpadPro ? 1.10 : 1.0;
    for (const stand of Object.values(franchiseStands)) {
      if (!stand.hired) continue;
      const standTraffic = Math.floor(
        stand.baseCapacity *
        Math.pow(weatherMult * tempFactor, stand.weatherSens) *
        (0.6 + s.reputation * 0.4) *
        efficiencyBonus
      );
      const estStand = Math.floor(standTraffic * buyProb);
      franchiseEstimates.push({ id: stand.id, name: stand.name, workerName: stand.workerName, estCups: estStand });
      totalCups += estStand;
    }
  }

  const cupsPerPitcher = 10 + s.recipe.icePerCup;
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
  franchiseStands: Record<string, FranchiseStand>
): KidDemandAdvice {
  const est = getDailyDemandEstimate(state, franchiseStands);
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

export function getMaxPourableCups(state: GameState): PourableCapacity {
  const s = state;
  const cupsPerPitcher = 10 + s.recipe.icePerCup;
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

// src/simulation/demand.ts -- How many cups people want, for the forecast and the real day.
import type { GameState, FranchiseStand, WholesaleAccount, DailyDemandEstimate, KidDemandAdvice } from '../types';
import { computeRecipeQuality, cupsPerPitcher as pitcherCups } from './recipe';
import { buyProbability, drivewayPeople, fairPriceFor } from './reputation';
import { BALANCE, type Balance } from '../balance';
import { storageCap } from './storage';

export interface StandDemand {
  id: string;
  name: string;
  workerName: string;
  demand: number;
  traffic: number;
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
  totalTraffic: number;        // people who saw a stand, including those who did not buy
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

  const fridgeTraffic = s.flags.hasMiniFridge ? d.fridgeTrafficMult : 1;
  const drivewayTraffic = Math.floor(drivewayPeople(s.buzz, s.reputation, b) * weatherMult * tempFactor * fridgeTraffic);
  let totalTraffic = drivewayTraffic;
  const stands: StandDemand[] = [
    { id: 'driveway', name: 'Driveway Stand', workerName: 'You', traffic: drivewayTraffic, demand: Math.floor(drivewayTraffic * buyProb), wage: 0, isDriveway: true }
  ];

  if (s.phase >= 2) {
    for (const stand of Object.values(franchiseStands)) {
      if (!stand.hired || stand.dayOff) continue;
      const standTraffic = Math.floor(
        stand.baseCapacity *
        Math.pow(weatherMult * tempFactor, stand.weatherSens) *
        (d.franchiseRepBase + s.reputation * d.franchiseRepPerRep) *
        fridgeTraffic
      );
      totalTraffic += standTraffic;
      stands.push({
        id: stand.id,
        name: stand.name,
        workerName: stand.workerName,
        traffic: standTraffic,
        demand: Math.floor(standTraffic * buyProb),
        wage: stand.dailyWage,
        isDriveway: false
      });
    }
  }

  const totalCupDemand = stands.reduce((sum, st) => sum + st.demand, 0);
  return { weatherMult, tempFactor, quality, fairPrice, buyProb, stands, totalCupDemand, totalTraffic };
}

// Share limited cups in proportion to each stand's demand. Largest remainders receive
// any cups left after rounding, without giving a stand more than its customers wanted.
export function allocateStandSales(stands: readonly StandDemand[], available: number): number[] {
  const demand = stands.reduce((sum, stand) => sum + stand.demand, 0);
  if (demand <= 0) return stands.map(() => 0);
  const total = Math.max(0, Math.min(available, demand));
  const shares = stands.map((stand, index) => {
    const exact = stand.demand * total / demand;
    const sold = Math.floor(exact);
    return { index, sold, remainder: exact - sold };
  });
  let left = total - shares.reduce((sum, share) => sum + share.sold, 0);
  const order = [...shares].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const share of order) {
    if (left <= 0) break;
    if (share.sold < stands[share.index].demand) { share.sold++; left--; }
  }
  return shares.map(share => share.sold);
}

// Bottles each signed store wants today (Stage 3+). Same weather pull as the stands, each
// store by its own amount. runDay sells against this and the forecast shows it.
export function storeDemand(
  s: GameState,
  accounts: Record<string, WholesaleAccount>,
  weatherMult: number
): { id: string; name: string; bottles: number }[] {
  if (s.phase < 3) return [];
  return Object.values(accounts).filter(a => a.active).map(a => ({
    id: a.id, name: a.name, bottles: Math.round(a.bottlesPerDay * Math.pow(weatherMult, a.weatherSens)),
  }));
}

export function getDailyDemandEstimate(
  state: GameState,
  franchiseStands: Record<string, FranchiseStand>,
  b: Balance = BALANCE,
  accounts: Record<string, WholesaleAccount> = {}
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
  let neededLemons = pitchers * s.recipe.lemonsPerPitcher;
  let neededSugar = pitchers * s.recipe.sugarPerPitcher;
  const neededIce = totalCups * s.recipe.icePerCup;
  const neededCups = totalCups;

  // Bottles use lemons and sugar from the same pantry (filled after the stands sell).
  const stores = storeDemand(s, accounts, day.weatherMult);
  const storeEstimates = stores.map(st => ({ id: st.id, name: st.name, estBottles: st.bottles }));
  const neededBottles = stores.reduce((n, st) => n + st.bottles, 0);
  for (const st of stores) {
    neededLemons += Math.ceil(st.bottles * b.wholesale.lemonsPerBottle);
    neededSugar += Math.ceil(st.bottles * b.wholesale.sugarPerBottle);
  }

  return {
    estDrivewayCups: estDriveway,
    franchiseEstimates,
    storeEstimates,
    totalEstCups: totalCups,
    neededLemons,
    neededSugar,
    neededIce,
    neededCups,
    neededBottles
  };
}

export function getKidDemandAdvice(
  state: GameState,
  franchiseStands: Record<string, FranchiseStand>,
  b: Balance = BALANCE,
  accounts: Record<string, WholesaleAccount> = {}
): KidDemandAdvice {
  const est = getDailyDemandEstimate(state, franchiseStands, b, accounts);
  const s = state;

  const lowItems: KidDemandAdvice['lowItems'] = [];
  if (s.inv.lemons < est.neededLemons) lowItems.push('lemons');
  if (s.inv.sugar < est.neededSugar) lowItems.push('sugar');
  if (s.inv.ice < est.neededIce && !s.flags.hasAutoIce) lowItems.push('ice');   // the machine makes it
  if (s.inv.cups < est.neededCups) lowItems.push('cups');
  if (s.inv.bottles < est.neededBottles) lowItems.push('bottles');
  // Low, but the stand cannot hold any more: only an upgrade fixes it.
  const fullItems = lowItems.filter(i => s.inv[i] >= storageCap(s, i, b)) as ('lemons' | 'ice')[];
  const buyable = lowItems.filter(i => !(fullItems as string[]).includes(i));
  return { phrase: advicePhrase(buyable, fullItems, s.tempF), lowItems, fullItems, isFullyStocked: lowItems.length === 0 };
}

// What the lemon in the weather card says about the supplies still to buy (buyable) and
// those the stand is too small for (full). Short enough for one line in the tip row.
const ONE_LOW: Record<string, string> = {
  lemons: 'Almost out of lemons! Grab another bag!',
  sugar: 'Need more sugar to keep it sweet!',
  cups: 'Running low on paper cups! Grab another pack!',
  bottles: 'The stores need more bottles today!',
};
function advicePhrase(buyable: KidDemandAdvice['lowItems'], full: KidDemandAdvice['fullItems'], tempF: number): string {
  if (buyable.length === 0) {
    if (full.length === 0) return 'Pantry is fully stocked and ready to pour!';
    // (The Day Report spells this one out.)
    return full[0] === 'ice' ? 'Ice bucket full! An ice machine makes all you need!' : 'Fruit bowl full! A mini-fridge holds all you want!';
  }
  if (buyable.length >= 4) return 'You need more of everything today!';
  if (buyable.length === 1) {
    if (buyable[0] === 'ice') return tempF >= 80 ? "You'll need a lot more ice for today's heat!" : 'Running low on ice cubes!';
    return ONE_LOW[buyable[0]];
  }
  return buyable.length === 2
    ? `Stock up on ${buyable[0]} and ${buyable[1]} before opening!`
    : `Stock up on ${buyable[0]}, ${buyable[1]}, and ${buyable[2]}!`;
}

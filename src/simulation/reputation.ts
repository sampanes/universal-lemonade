// src/simulation/reputation.ts -- Neighborhood reputation and what customers will pay.
//
// Reputation is an exponentially weighted moving average (EWMA) of how happy each day's
// customers were:  newRep = (1 - alpha) * oldRep + alpha * todayScore.
// Recent days count the most and older days fade out smoothly, so a kid who fixes a bad
// recipe sees their reputation recover within a few days instead of being stuck with a
// lifetime average.
//
// Reputation drives two things, and both the morning forecast and the real day use the
// functions below so they always agree:
//   1. Foot traffic: how many people stop by (see drivewayTrafficMult).
//   2. Pricing power: the price people consider fair goes up with reputation.
// All the numbers are in src/balance.ts.

import type { GameState } from '../types';
import { BALANCE, type Balance } from '../balance';

export function ewma(previous: number, current: number, alpha: number): number {
  return (1 - alpha) * previous + alpha * current;
}

// Price a typical customer thinks is fair. At the starting reputation (0.5) this is the
// weather-only price; a beloved stand can charge more, a disliked one has to charge less.
export function fairPriceFor(tempF: number, reputation: number, b: Balance = BALANCE): number {
  const d = b.demand;
  const weatherPrice = d.fairPriceBase * (1 + d.fairPriceTempSlope * (tempF - d.refF));
  return weatherPrice * (b.reputation.priceBase + b.reputation.pricePerRep * reputation);
}

// Chance that someone who walks by actually buys a cup.
export function buyProbability(quality: number, tempF: number, pricePerCup: number, reputation: number, b: Balance = BALANCE): number {
  const priceRatio = fairPriceFor(tempF, reputation, b) / Math.max(b.demand.minPriceForRatio, pricePerCup);
  return Math.max(0, Math.min(1, quality * Math.pow(priceRatio, b.demand.priceExponent)));
}

// Multiplier on how many people walk past the driveway stand.
export function drivewayTrafficMult(reputation: number, b: Balance = BALANCE): number {
  return b.reputation.trafficBase + reputation;
}

// Lasting reputation boosts from upgrades and trophies. Under an EWMA a one-time bump
// fades within a week, so these are added to every day's score instead.
export function reputationBonus(s: GameState, b: Balance = BALANCE): number {
  const r = b.reputation;
  let bonus = 0;
  if (s.flags.hasMiniFridge) bonus += r.bonusMiniFridge;
  if (s.flags.hasNintendoSwitch) bonus += r.bonusNintendoSwitch;
  if (s.flags.hasDisneyTrip) bonus += r.bonusDisneyTrip;
  return bonus;
}

export interface DayCustomerOutcome {
  quality: number;       // recipe quality, 0..1
  pricePerCup: number;
  fairPrice: number;     // fairPriceFor() at the start of the day
  cupsWanted: number;    // demand across all cup stands
  cupsSold: number;
}

// How happy today's customers were, 0..1. Returns null when nobody came to buy, because
// a day with no customers says nothing about the stand.
export function dailyCustomerScore(o: DayCustomerOutcome, b: Balance = BALANCE): number | null {
  if (o.cupsWanted <= 0) return null;
  const taste = o.quality;
  // Paying more than they think is fair leaves buyers a bit grumpy; a bargain does not
  // make them happier than "fair".
  const value = Math.sqrt(Math.min(1, o.fairPrice / Math.max(0.01, o.pricePerCup)));
  // People who were turned away because the stand ran out are disappointed.
  const served = Math.min(1, o.cupsSold / o.cupsWanted);
  return taste * value * (b.reputation.servedBase + b.reputation.servedPerServed * served);
}

// Applies one day's customer score to the reputation. Returns the new reputation.
export function nextReputation(s: GameState, todayScore: number | null, b: Balance = BALANCE): number {
  if (todayScore === null) return s.reputation;
  const r = b.reputation;
  const target = Math.min(r.max, todayScore + reputationBonus(s, b));
  const next = ewma(s.reputation, target, r.alpha);
  return Math.max(r.min, Math.min(r.max, next));
}

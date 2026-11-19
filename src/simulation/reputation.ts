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
//   1. Foot traffic: neighbors who know the stand (buzz) come more often (drivewayPeople).
//   2. Pricing power: the price people consider fair goes up with reputation.
// Buzz (how many neighbors know the stand at all) is updated by nextBuzz below.
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

// People who come by the driveway stand before weather: a few passers-by, plus the
// neighbors who know about it (buzz), who come more often when they hear good things.
export function drivewayPeople(buzz: number, reputation: number, b: Balance = BALANCE): number {
  return b.buzz.walkBy + buzz * b.buzz.neighbors * (b.reputation.trafficBase + reputation);
}

// Tomorrow's buzz after today's happy customers (Bass diffusion plus a little forgetting).
export function nextBuzz(buzz: number, happyCustomers: number, b: Balance = BALANCE): number {
  const z = b.buzz;
  const spread = (1 - buzz) * Math.min(1, z.discovery + z.wordOfMouth * happyCustomers / z.neighbors);
  return Math.max(0, Math.min(1, (buzz + spread) * (1 - z.forget)));
}

// Lasting reputation boosts from upgrades and trophies. Under an EWMA a one-time bump
// fades within a week, so these are added to every day's score instead.
export function reputationBonus(s: GameState, b: Balance = BALANCE): number {
  const r = b.reputation;
  let bonus = 0;
  if (s.flags.hasNintendoSwitch) bonus += r.bonusNintendoSwitch;
  if (s.flags.hasDisneyTrip) bonus += r.bonusDisneyTrip;
  return bonus;
}

export interface DayCustomerOutcome {
  quality: number;       // recipe quality, 0..1
  exactGolden: boolean;  // lemons and sugar exactly on this game's golden recipe
  pricePerCup: number;
  fairPrice: number;     // fairPriceFor() at the start of the day
  cupsWanted: number;    // demand across all cup stands
  cupsSold: number;
}

// How happy today's customers were, 0..1. Returns null when nobody came to buy, because
// a day with no customers says nothing about the stand.
export function dailyCustomerScore(o: DayCustomerOutcome, b: Balance = BALANCE): number | null {
  if (o.cupsWanted <= 0) return null;
  const taste = Math.pow(o.quality, b.reputation.tasteExponent) * (o.exactGolden ? 1 : b.reputation.offGoldenTasteMult);
  // Paying more than they think is fair leaves buyers a bit grumpy; a bargain does not
  // make them happier than "fair".
  const value = Math.sqrt(Math.min(1, o.fairPrice / Math.max(0.01, o.pricePerCup)));
  // People who were turned away because the stand ran out are disappointed.
  const served = Math.min(1, o.cupsSold / o.cupsWanted);
  return taste * value * (b.reputation.servedBase + b.reputation.servedPerServed * served);
}

// Describe a real trend rather than a tiny daily wobble. Keep high ratings encouraging;
// below 4.5 stars, warn for a sharp drop or a sustained decline over several days.
export function reputationTrend(history: readonly number[]): 'up' | 'down' | 'steady' {
  const recent = history.slice(-4);
  if (recent.length < 2) return 'steady';
  const last = recent[recent.length - 1], before = recent[recent.length - 2];
  const change = last - before;
  if (change > 0.005) return 'up';
  if (change >= -0.005 || last >= 0.9) return 'steady';
  if (change <= -0.08) return 'down';
  const downDays = recent.slice(1).filter((value, i) => value - recent[i] < -0.005).length;
  return downDays >= 2 && last - recent[0] <= -0.04 + 1e-9 ? 'down' : 'steady';
}

// Applies one day's customer score to the reputation. Returns the new reputation.
export function nextReputation(
  s: GameState, todayScore: number | null, b: Balance = BALANCE, excessivePriceSeen = false
): number {
  const r = b.reputation;
  const target = todayScore === null ? s.reputation : Math.min(r.max, todayScore + reputationBonus(s, b));
  let next = ewma(s.reputation, target, r.alpha);
  // A very high price can turn people away even when nobody buys a cup.
  if (excessivePriceSeen) next = Math.min(next, s.reputation - r.excessivePriceDrop);
  return Math.max(r.min, Math.min(r.max, next));
}

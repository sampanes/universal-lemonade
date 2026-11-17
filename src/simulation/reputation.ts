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

import type { GameState } from '../types';

// Share of today's score that goes into the new reputation. 0.3 means a day's effect is
// about half gone after two more days and mostly gone after a week.
export const REPUTATION_ALPHA = 0.3;
export const MIN_REPUTATION = 0.1;
export const MAX_REPUTATION = 1.0;

export function ewma(previous: number, current: number, alpha: number): number {
  return (1 - alpha) * previous + alpha * current;
}

// Price a typical customer thinks is fair. At the starting reputation (0.5) this is the
// original weather-only price; a beloved stand (1.0) can charge 25% more, a disliked one
// (0.1) has to charge 20% less.
export function fairPriceFor(tempF: number, reputation: number): number {
  const weatherPrice = 2.0 * (1 + 0.02 * (tempF - 70));
  return weatherPrice * (0.75 + 0.5 * reputation);
}

// Chance that someone who walks by actually buys a cup.
export function buyProbability(quality: number, tempF: number, pricePerCup: number, reputation: number): number {
  const priceRatio = fairPriceFor(tempF, reputation) / Math.max(0.25, pricePerCup);
  return Math.max(0, Math.min(1, quality * Math.pow(priceRatio, 1.8)));
}

// Multiplier on how many people walk past the driveway stand.
export function drivewayTrafficMult(reputation: number): number {
  return 0.5 + reputation;
}

// Lasting reputation boosts from upgrades and trophies. Under an EWMA a one-time bump
// fades within a week, so these are added to every day's score instead.
export function reputationBonus(s: GameState): number {
  let bonus = 0;
  if (s.flags.hasMiniFridge) bonus += 0.10;
  if (s.flags.hasNintendoSwitch) bonus += 0.05;
  if (s.flags.hasDisneyTrip) bonus += 0.15;
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
export function dailyCustomerScore(o: DayCustomerOutcome): number | null {
  if (o.cupsWanted <= 0) return null;
  const taste = o.quality;
  // Paying more than they think is fair leaves buyers a bit grumpy; a bargain does not
  // make them happier than "fair".
  const value = Math.sqrt(Math.min(1, o.fairPrice / Math.max(0.01, o.pricePerCup)));
  // People who were turned away because the stand ran out are disappointed.
  const served = Math.min(1, o.cupsSold / o.cupsWanted);
  return taste * value * (0.75 + 0.25 * served);
}

// Applies one day's customer score to the reputation. Returns the new reputation.
export function nextReputation(s: GameState, todayScore: number | null): number {
  if (todayScore === null) return s.reputation;
  const target = Math.min(MAX_REPUTATION, todayScore + reputationBonus(s));
  const next = ewma(s.reputation, target, REPUTATION_ALPHA);
  return Math.max(MIN_REPUTATION, Math.min(MAX_REPUTATION, next));
}

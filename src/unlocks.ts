// src/unlocks.ts -- secret looks for the mirror. Some hair styles and hair colors are hidden
// until the kid happens to hit a milestone; then they appear in the mirror like magic. The
// game never says what the next one is or how to get it.
//
// Looks are ids: 'hair:<style id>' (from kid.json) or 'color:<hair color id>' (character.ts).
// Unlocks belong to the player, not to one game, so a new game keeps them.
import type { DaySummary, GameState } from './types';

export interface UnlockCheck {
  summary: DaySummary;     // the day that just ended
  totalCupsSold: number;   // all game long
  cash: number;
  reputation: number;      // 0..1
  bestReviews: boolean;    // the customers' stars averaged five today
  hasTreat: boolean;       // bought any trophy (skateboard, bike, ...)
}

/** Every secret look and the milestone that brings it. Order is the usual order kids meet them. */
export const MILESTONES: { look: string; earned: (c: UnlockCheck) => boolean }[] = [
  { look: 'color:grape', earned: c => c.summary.netProfit > 0 },
  { look: 'hair:spiky', earned: c => c.totalCupsSold >= 100 },
  { look: 'hair:messybun', earned: c => !!c.summary.soldOut },
  { look: 'color:ocean', earned: c => c.summary.weather === 'RAINY' && c.summary.netProfit > 0 },
  { look: 'color:mint', earned: c => c.summary.tempF >= 90 },
  { look: 'hair:bangs', earned: c => c.summary.day >= 5 },
  { look: 'color:candy', earned: c => c.bestReviews },
  { look: 'hair:wavybob', earned: c => c.reputation >= 0.8 },
  { look: 'color:glitter', earned: c => (c.summary.goldenStreak ?? 0) >= 3 },
  { look: 'hair:crownbraid', earned: c => c.cash >= 500 },
  { look: 'hair:shaggy', earned: c => c.hasTreat },
  { look: 'color:rainbow', earned: c => !!c.summary.recipeJustLocked },
  { look: 'color:snow', earned: c => c.summary.day >= 20 },
  { look: 'color:galaxy', earned: c => c.totalCupsSold >= 1000 },
];

const TREAT_FLAGS = ['hasSkateboard', 'hasMountainBike', 'hasNintendoSwitch', 'hasElectricScooter',
  'hasIpadPro', 'hasDisneyTrip', 'hasHondaCivic', 'hasGarageArcade', 'hasCollegePrepaid',
  'hasPaidMortgage', 'hasLemonGrove', 'hasTeslaModelX', 'hasPrivateJet', 'hasArenaNaming',
  'hasPrivateIsland'] as const;

/** The check for the day that just ended. bestReviews: today's customer stars averaged five. */
export function unlockCheckFrom(s: GameState, summary: DaySummary, bestReviews: boolean): UnlockCheck {
  return {
    summary,
    totalCupsSold: s.totalCupsSold.toNumber(),
    cash: s.cash.toNumber(),
    reputation: s.reputation,
    bestReviews,
    hasTreat: TREAT_FLAGS.some(f => s.flags[f]),
  };
}

/** Every look that starts hidden. */
export const SECRET_LOOKS: ReadonlySet<string> = new Set(MILESTONES.map(m => m.look));

/** The looks this day just earned (not already had), in milestone order. */
export function newUnlocks(have: ReadonlySet<string>, c: UnlockCheck): string[] {
  return MILESTONES.filter(m => !have.has(m.look) && m.earned(c)).map(m => m.look);
}

export interface Unlocks {
  have: Set<string>;      // earned looks
  unseen: Set<string>;    // earned but not yet looked at in the mirror (they get a sparkle)
}

const STORAGE_KEY = 'universal_lemonade_unlocks';

export function loadUnlocks(): Unlocks {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const ok = (a: unknown) => (Array.isArray(a) ? a.filter(x => typeof x === 'string') : []);
      return { have: new Set(ok(p.have)), unseen: new Set(ok(p.unseen)) };
    }
  } catch (e) {
    console.warn('[Unlocks] Error reading saved unlocks:', e);
  }
  return { have: new Set(), unseen: new Set() };
}

export function saveUnlocks(u: Unlocks): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ have: [...u.have], unseen: [...u.unseen] }));
  } catch (e) {
    console.warn('[Unlocks] Error saving unlocks:', e);
  }
}

/** Forget every earned look (Reset). */
export function clearUnlocks(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[Unlocks] Error clearing unlocks:', e);
  }
}

/** True when the look is free or already earned. */
export function lookOpen(u: Unlocks, look: string): boolean {
  return !SECRET_LOOKS.has(look) || u.have.has(look);
}

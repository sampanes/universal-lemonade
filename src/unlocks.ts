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
  phase: number;           // 1 = driveway stand ... 5 = the last phase
  hasTreat: boolean;       // bought any trophy (skateboard, bike, ...)
}

/**
 * Every secret look and the milestone that brings it, in the usual order kids meet them.
 * Pacing (from the simulator, a careful player; a game runs about 70 to 150 days): plain colors
 * and hair come in the first two weeks so a kid sees early that things change; the special
 * colors (gradients, sparkles, rainbow, galaxy) wait for the big moments of the game.
 */
export const MILESTONES: { look: string; earned: (c: UnlockCheck) => boolean }[] = [
  { look: 'color:grape', earned: c => c.summary.day >= 3 && c.summary.netProfit > 0 },   // about day 3
  { look: 'hair:bangs', earned: c => c.summary.day >= 5 },
  { look: 'color:ocean', earned: c => c.summary.weather === 'RAINY' && c.summary.netProfit > 0 },
  { look: 'hair:spiky', earned: c => c.totalCupsSold >= 100 },                            // about day 7
  { look: 'color:mint', earned: c => c.summary.tempF >= 90 },
  { look: 'hair:messybun', earned: c => !!c.summary.soldOut },
  { look: 'hair:wavybob', earned: c => c.reputation >= 0.8 },
  { look: 'hair:windswept', earned: c => !!c.summary.recipeJustLocked },                  // golden recipe
  { look: 'hair:undercut', earned: c => c.phase >= 2 },                                   // about day 10
  { look: 'hair:mohawk', earned: c => c.totalCupsSold >= 1000 },                          // about day 20
  { look: 'color:snow', earned: c => c.summary.day >= 20 },
  { look: 'hair:crownbraid', earned: c => c.cash >= 500 },
  { look: 'hair:shaggy', earned: c => c.hasTreat },
  { look: 'color:candy', earned: c => c.phase >= 3 },                                     // about day 28
  { look: 'color:glitter', earned: c => c.phase >= 4 },                                   // about day 46
  { look: 'color:rainbow', earned: c => c.phase >= 5 },                                   // about day 68
  { look: 'color:galaxy', earned: c => c.summary.day >= 100 },
];

const TREAT_FLAGS = ['hasSkateboard', 'hasMountainBike', 'hasNintendoSwitch', 'hasElectricScooter',
  'hasIpadPro', 'hasDisneyTrip', 'hasHondaCivic', 'hasGarageArcade', 'hasCollegePrepaid',
  'hasPaidMortgage', 'hasLemonGrove', 'hasTeslaModelX', 'hasPrivateJet', 'hasArenaNaming',
  'hasPrivateIsland'] as const;

/** The check for the day that just ended. */
export function unlockCheckFrom(s: GameState, summary: DaySummary): UnlockCheck {
  return {
    summary,
    totalCupsSold: s.totalCupsSold.toNumber(),
    cash: s.cash.toNumber(),
    reputation: s.reputation,
    phase: s.phase,
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

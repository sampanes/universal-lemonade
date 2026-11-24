// src/unlocks.ts -- secret looks for the mirror. Some hair styles and hair colors are hidden
// until the kid happens to hit a milestone; then they appear in the mirror like magic. The
// game never says what the next one is or how to get it.
//
// Looks are ids: 'hair:<style id>' (from kid.json) or 'color:<hair color id>' (character.ts).
// Unlocks belong to the player, not to one game, so a new game keeps them.
import type { DaySummary, GameState } from './types';
import { STORAGE_KEYS, readStored, writeStored, removeStored } from './storage';

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
  pending?: string[];    // milestones earned but waiting for a quiet day
  lastAwardDay?: number;
  lastBusyDay?: number;
  lastProcessedDay?: number;
}

// A shop item appears after one whole day without another purchase.
export function shopDaysRemaining(s: Pick<GameState, 'day' | 'lastShopPurchaseDay'>): number {
  return s.lastShopPurchaseDay == null ? 0 : Math.max(0, s.lastShopPurchaseDay + 2 - s.day);
}

export function shopReady(s: Pick<GameState, 'day' | 'lastShopPurchaseDay'>): boolean {
  return shopDaysRemaining(s) === 0;
}

// A purchase, recipe lock, the introduction of the next shop item, or My House opening is
// already a big day. (The engine asks this before it opens the house, so it is not counted.)
export function otherUnlockToday(s: GameState, summary: DaySummary): boolean {
  const ledger = s.lastLedger;
  const sincePurchase = s.lastShopPurchaseDay == null ? null : summary.day - s.lastShopPurchaseDay;
  const shopIntro = (s.lastShopPurchaseDay == null && summary.day === 3) || sincePurchase === 1 || sincePurchase === 2;
  return !!summary.recipeJustLocked || !!summary.houseOpened || !!summary.flavorTaste?.launched || !!shopIntro || !!(ledger &&
    (ledger.shop > 0 || ledger.hiring > 0 || ledger.storeUpgrades > 0 || ledger.house > 0));
}

// Remember even one-day milestones, then reveal at most one look on a quiet day.
export function advanceLookUnlocks(u: Unlocks, c: UnlockCheck, otherEvent: boolean): string | null {
  // A new game can keep earned looks, but its day counter starts over.
  if (u.lastProcessedDay != null && c.summary.day < u.lastProcessedDay) {
    u.lastAwardDay = undefined;
    u.lastBusyDay = undefined;
  }
  u.lastProcessedDay = c.summary.day;
  const pending = u.pending ?? (u.pending = []);
  for (const look of newUnlocks(u.have, c)) {
    if (!pending.includes(look)) pending.push(look);
  }
  if (otherEvent) u.lastBusyDay = c.summary.day;
  if (c.summary.day < 4 || otherEvent ||
      (u.lastBusyDay != null && c.summary.day - u.lastBusyDay < 2) ||
      (u.lastAwardDay != null && c.summary.day - u.lastAwardDay < 3)) return null;
  const look = pending.shift();
  if (!look) return null;
  u.have.add(look);
  u.unseen.add(look);
  u.lastAwardDay = c.summary.day;
  return look;
}

export function loadUnlocks(): Unlocks {
  try {
    const raw = readStored(STORAGE_KEYS.unlocks);
    if (raw) {
      const p = JSON.parse(raw);
      const ok = (a: unknown) => (Array.isArray(a) ? a.filter(x => typeof x === 'string') : []);
      const have = new Set(ok(p.have));
      const pending = [...new Set(ok(p.pending))].filter(x => SECRET_LOOKS.has(x) && !have.has(x));
      return { have, unseen: new Set(ok(p.unseen)), pending,
        lastAwardDay: Number.isInteger(p.lastAwardDay) && p.lastAwardDay >= 0 ? p.lastAwardDay : undefined,
        lastBusyDay: Number.isInteger(p.lastBusyDay) && p.lastBusyDay >= 0 ? p.lastBusyDay : undefined,
        lastProcessedDay: Number.isInteger(p.lastProcessedDay) && p.lastProcessedDay >= 0 ? p.lastProcessedDay : undefined };
    }
  } catch (e) {
    console.warn('[Unlocks] Error reading saved unlocks:', e);
  }
  return { have: new Set(), unseen: new Set() };
}

export function saveUnlocks(u: Unlocks): void {
  writeStored(STORAGE_KEYS.unlocks, JSON.stringify({
    have: [...u.have], unseen: [...u.unseen], pending: u.pending ?? [],
    lastAwardDay: u.lastAwardDay, lastBusyDay: u.lastBusyDay, lastProcessedDay: u.lastProcessedDay
  }));
}

/** Forget every earned look (Reset). */
export function clearUnlocks(): void {
  removeStored(STORAGE_KEYS.unlocks);
}

/** True when the look is free or already earned. */
export function lookOpen(u: Unlocks, look: string): boolean {
  return !SECRET_LOOKS.has(look) || u.have.has(look);
}

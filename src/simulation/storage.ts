// src/simulation/storage.ts -- How much ice and how many lemons the stand can hold.
//
// A kid starts with an ice bucket and a fruit bowl. Summer days need more than they hold,
// so the stand upgrades are what lets a stand grow:
//   Ice Machine  makes all the ice a day needs, free (no limit)
//   Mini-Fridge  holds all the lemons you want, and they stop going bad (no limit)
// Sugar and cups keep fine in the garage and have no limit. (A cooler, 1,000 cubes kept
// frozen, is still known here but is no longer sold: the ice machine came right after it.)
import type { GameState, SupplyItem } from '../types';
import { BALANCE, type Balance } from '../balance';

export function storageCap(s: GameState, item: SupplyItem, b: Balance = BALANCE): number {
  if (item === 'ice') {
    if (s.flags.hasAutoIce) return Infinity;
    return s.flags.hasCooler ? b.storage.iceCooler : b.storage.iceBucket;
  }
  if (item === 'lemons') {
    return s.flags.hasMiniFridge || s.flags.hasLemonGrove ? Infinity : b.storage.lemonBowl;
  }
  return Infinity;
}

// What the kid keeps the item in right now, for messages ("your ice bucket is full").
export function storageName(s: GameState, item: SupplyItem): string {
  if (item === 'ice') return s.flags.hasCooler ? 'cooler' : 'ice bucket';
  if (item === 'lemons') return 'fruit bowl';
  return 'garage';
}

// The upgrade that holds more, for the "is full" hint.
export function storageUpgradeHint(item: SupplyItem): string {
  if (item === 'ice') return 'An ice machine makes all the ice you need!';
  if (item === 'lemons') return 'A mini-fridge holds all you want!';
  return '';
}

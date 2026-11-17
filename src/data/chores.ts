// src/data/chores.ts — Emergency kid chore definitions & rolling logic
import type { ChoreState } from '../types';
import { BALANCE, type Balance } from '../balance';

export const CHORE_DEFS: { name: string; min: number; max: number }[] = [
  { name: "Mow Neighbor's Lawn", min: 15, max: 25 },
  { name: "Rake Autumn Leaves", min: 10, max: 18 },
  { name: "Wash Dad's SUV", min: 12, max: 20 },
  { name: "Walk Mrs. Higgins' Dog", min: 8, max: 15 },
  { name: "Weed the Garden Beds", min: 8, max: 15 },
  { name: "Clean Out the Garage", min: 15, max: 25 },
  { name: "Sort Recycling Cans", min: 5, max: 10 },
  { name: "Shovel Neighbor's Walkway", min: 15, max: 25 },
  { name: "Help Carry Heavy Groceries", min: 6, max: 12 },
  { name: "Sweep the Deck & Porch", min: 5, max: 10 }
];

export function rollChore(rand: () => number, hasSkateboard: boolean = false, b: Balance = BALANCE): ChoreState {
  const c = b.chores;
  const chore = CHORE_DEFS[Math.floor(rand() * CHORE_DEFS.length)];
  const reward = chore.min + Math.floor(rand() * (chore.max - chore.min + 1));
  let cooldownSec = c.cooldownMinSec + Math.floor(rand() * c.cooldownRandomSec);
  if (hasSkateboard) {
    cooldownSec = Math.max(c.skateboardMinCooldownSec, Math.round(cooldownSec * c.skateboardCooldownMult));
  }
  return {
    name: chore.name,
    reward,
    cooldownSec,
    remainingSec: 0
  };
}

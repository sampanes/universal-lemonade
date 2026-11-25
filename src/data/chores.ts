// src/data/chores.ts -- Kid chore definitions and rolling logic. The dollar ranges below are
// scaled by balance.chores.rewardMult; the rest grows with each chore done in a day (engine).
import type { ChoreState } from '../types';
import { BALANCE, type Balance } from '../balance';

const CHORE_DEFS: { name: string; min: number; max: number }[] = [
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

export function rollChore(rand: () => number, b: Balance = BALANCE): ChoreState {
  const c = b.chores;
  const chore = CHORE_DEFS[Math.floor(rand() * CHORE_DEFS.length)];
  const listed = chore.min + Math.floor(rand() * (chore.max - chore.min + 1));
  const reward = Math.max(1, Math.round(listed * c.rewardMult));
  const cooldownSec = c.cooldownMinSec + Math.floor(rand() * c.cooldownRandomSec);
  return {
    name: chore.name,
    reward,
    cooldownSec,
    remainingSec: 0
  };
}

// src/data/trophies.ts -- the three big dreams at the end of the kid's Stand Shop
// (src/ui/kidShop.js). The last one, Citrus Cay, is the ending.
import type { LifestyleTrophy } from '../types';

// Citrus Cay, the ending. Played through by a careful kid (the careful bot's mornings, the
// Stand Shop in order, following the flavor comments, a brand move whenever the money is
// there), the island comes about 12 days after the last factory step, around day 136 to 145.
export const ISLAND_COST = 1000000000;

export function createInitialTrophies(): LifestyleTrophy[] {
  return [
    {
      id: 'private_jet',
      name: 'Lemonade Jet',
      emoji: '\u{2708}\u{FE0F}',
      costCash: 65000000,
      purchased: false,
      desc: 'A sunshine-yellow jet to sell the lemon squeezer all around the world.',
      perkDesc: 'Squeezers sell twice as much.',
      phaseRequired: 5
    },
    {
      id: 'arena_naming',
      name: 'The Lemonade Arena',
      emoji: '\u{1F3DF}\u{FE0F}',
      costCash: 80000000,
      purchased: false,
      desc: 'Your name in lights over a giant arena downtown.',
      perkDesc: 'The factory sells twice as much.',
      phaseRequired: 5
    },
    {
      id: 'private_island',
      name: 'Citrus Cay',
      emoji: '\u{1F3DD}\u{FE0F}',
      costCash: ISLAND_COST,
      purchased: false,
      desc: 'Your very own lemonade island, with lemon trees, white sand and a pool of iced lemonade.',
      perkDesc: 'You won the game! (Keep playing as long as you like.)',
      phaseRequired: 5
    }
  ];
}

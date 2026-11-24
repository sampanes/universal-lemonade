// src/data/brand.ts -- the famous brand (Stage 5).
//
// Once the lemonade is in stores across the country (BRAND_OPENS_WITH), the partners card
// gets a Brand tab: the kid makes the lemonade famous one move at a time, each adding its
// bonus to everything sold (the Day Report's "Famous brand bonus" line). The next move opens
// the day after the last one. The moves cost about what the factory steps around them do, so
// the kid chooses between growing the factory and growing the brand.
export interface BrandStep {
  id: string;
  name: string;
  desc: string;
  cost: number;
  bonus: number;   // 0.10 = everything sells 10% more (it multiplies the bonus so far)
}

export const BRAND_OPENS_WITH = 'national_bigbox';

export const BRAND_STEPS: readonly BrandStep[] = [
  { id: 'billboard', name: 'Giant Billboard', desc: 'Your lemonade, ten feet tall by the highway!', cost: 250000, bonus: 0.10 },
  { id: 'jingle', name: 'Radio Jingle', desc: 'A catchy lemonade song on every radio!', cost: 750000, bonus: 0.10 },
  { id: 'tv', name: 'TV Commercial', desc: 'Your lemonade on TV, coast to coast!', cost: 2000000, bonus: 0.15 },
  { id: 'team', name: 'Ballpark Team Sponsor', desc: 'Your lemon on every jersey!', cost: 5000000, bonus: 0.15 },
  { id: 'parade', name: 'Parade Float', desc: 'A giant lemon float in the big parade!', cost: 12000000, bonus: 0.20 },
  { id: 'blimp', name: 'Lemonade Blimp', desc: 'A lemon blimp over every big game!', cost: 30000000, bonus: 0.20 },
  { id: 'big_game', name: 'Big Game Commercial', desc: 'The most famous commercial of the year!', cost: 75000000, bonus: 0.25 },
];

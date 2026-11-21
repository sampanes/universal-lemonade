// src/data/house.ts -- the family house, upgraded with the kid's own money.
//
// The house is a money sink: each step only changes how the house looks (in the kid's My
// House column, the build scene, and behind the driveway stand in the day scene). Steps are
// bought in order; each waits for its stage, so the big ones wait for the money the later
// stages bring in. state.houseLevel is how many steps are bought (0: the house on Day 1).
export interface HouseStep {
  id: string;
  name: string;     // the button and the build scene ("Treehouse")
  desc: string;
  cost: number;
  phase: number;    // the stage it opens in
}

export const HOUSE_STEPS: readonly HouseStep[] = [
  { id: 'paint', name: 'Fresh Paint', desc: 'Paint the house any color you like!', cost: 250, phase: 2 },
  { id: 'treehouse', name: 'Treehouse', desc: 'A treehouse in the big backyard tree.', cost: 1500, phase: 2 },
  { id: 'hq', name: 'Lemon HQ', desc: 'Turn the garage into your lemonade headquarters.', cost: 10000, phase: 3 },
  { id: 'paid_off', name: 'Pay Off the House', desc: 'Pay off the house for Mom and Dad!', cost: 500000, phase: 4 },
];

// Wall colors once Fresh Paint is bought ('cream' is the house's own color). The kid can
// switch any time for free.
export const HOUSE_COLORS: readonly { id: string; name: string; hex: string }[] = [
  { id: 'cream', name: 'Cream', hex: '#f8dcb9' },
  { id: 'mint', name: 'Mint', hex: '#5fd6a0' },
  { id: 'sky', name: 'Sky', hex: '#5cb4f0' },
  { id: 'pink', name: 'Pink', hex: '#f47fb8' },
  { id: 'lavender', name: 'Lavender', hex: '#a585ee' },
  { id: 'lemon', name: 'Lemon', hex: '#ffd23f' },
  { id: 'peach', name: 'Peach', hex: '#ff9a62' },
];
export const FIRST_HOUSE_COLOR = 'mint';   // the color Fresh Paint starts with

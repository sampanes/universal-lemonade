// src/data/house.ts -- the family house, upgraded with the kid's own money.
//
// The house is a money sink: each step only changes how the house looks (a new picture and a
// short build scene in the kid's My House column). Steps are bought in order; each waits for
// its stage, so the big ones wait for the money the later stages bring in. state.houseLevel
// is how many steps are bought (0: the house as it was on Day 1).
export interface HouseStep {
  id: string;
  name: string;     // the button and the build scene ("Treehouse")
  desc: string;
  cost: number;
  phase: number;    // the stage it opens in
}

export const HOUSE_STEPS: readonly HouseStep[] = [
  { id: 'paint', name: 'Fresh Paint', desc: 'Paint the house a bright new color!', cost: 250, phase: 2 },
  { id: 'treehouse', name: 'Treehouse', desc: 'A treehouse in the big backyard tree.', cost: 1500, phase: 2 },
  { id: 'pool', name: 'Backyard Pool', desc: 'A swimming pool with a slide!', cost: 8000, phase: 3 },
  { id: 'hq', name: 'Lemon HQ', desc: 'Turn the garage into your lemonade headquarters.', cost: 25000, phase: 4 },
  { id: 'second_floor', name: 'Second Floor', desc: 'A whole new floor with a balcony.', cost: 100000, phase: 4 },
  { id: 'paid_off', name: 'Pay Off the House', desc: 'Pay off the house for Mom and Dad!', cost: 500000, phase: 4 },
];

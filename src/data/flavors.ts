// src/data/flavors.ts -- the Flavor Lab (Stage 5, bought in the Stand Shop).
//
// The factory invents new flavors, one at a time, in this order. Each one has a secret best
// mix of fruit and sugar (picked from the game's seed, like the golden recipe), found the same
// way: the taste testers try the mix every day the stand opens and say which way to go ("a
// little more strawberry and way less sugar"). The day they taste the exact mix, the flavor
// goes to the stores and the factory sells FLAVOR_BOOST more cases from then on.
export interface Flavor {
  id: string;        // also the fruit's picture: public/sprites/flavors/<id>.png
  name: string;      // "Strawberry Lemonade"
  fruit: string;     // the ingredient row's label ("Strawberries")
  word: string;      // in the testers' comments ("a little more strawberry")
  color: string;     // the drink's color in the pitcher
}

export const FLAVORS: readonly Flavor[] = [
  { id: 'strawberry', name: 'Strawberry Lemonade', fruit: 'Strawberries', word: 'strawberry', color: '#fb7185' },
  { id: 'peach', name: 'Peach Lemonade', fruit: 'Peaches', word: 'peach', color: '#fdba74' },
  { id: 'mint', name: 'Mint Lemonade', fruit: 'Mint', word: 'mint', color: '#86efac' },
  { id: 'blueberry', name: 'Blueberry Lemonade', fruit: 'Blueberries', word: 'blueberry', color: '#a5b4fc' },
  { id: 'watermelon', name: 'Watermelon Lemonade', fruit: 'Watermelon', word: 'watermelon', color: '#f472b6' },
  { id: 'mango', name: 'Mango Lemonade', fruit: 'Mango', word: 'mango', color: '#fbbf24' },
];

// Every new flavor starts here; the best mix is never exactly this, so it takes some tasting.
export const FLAVOR_START = { fruit: 3, sugar: 3 } as const;
const FLAVOR_FRUIT = { min: 1, max: 6 } as const;
const FLAVOR_SUGAR = { min: 1, max: 5 } as const;
export const FLAVOR_MAX_SCOOPS = 8;   // the + buttons stop here
export const FLAVOR_BOOST = 0.2;      // each flavor in stores: the factory sells 20% more

// The best fruit:sugar for flavor number `index` in this game. Its own hash of the seed, so
// the game's random stream (weather, chores) stays the same.
export function flavorGoldenMix(seed: number, index: number): { fruit: number; sugar: number } {
  const nF = FLAVOR_FRUIT.max - FLAVOR_FRUIT.min + 1, nS = FLAVOR_SUGAR.max - FLAVOR_SUGAR.min + 1;
  let h = Math.imul(seed ^ Math.imul(index + 1, 0x27D4EB2F), 0x9E3779B1);
  h = Math.imul(h ^ (h >>> 15), 0x85EBCA6B);
  h ^= h >>> 13;
  const idx = (h >>> 0) % (nF * nS);
  let fruit = FLAVOR_FRUIT.min + (idx % nF);
  const sugar = FLAVOR_SUGAR.min + Math.floor(idx / nF);
  if (fruit === FLAVOR_START.fruit && sugar === FLAVOR_START.sugar) fruit += 2;
  return { fruit, sugar };
}

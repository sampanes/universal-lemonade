// src/data/yard.ts -- the yard: rich-kid things bought with the kid's own money once the
// house is paid off (src/data/house.ts).
//
// Like the house steps, they only change how things look: each stands on the grass under the
// house in My House, and on My Shelf. They come one at a time, in YARD_STEPS order, the next
// one YARD_DAYS_BETWEEN days after the last. The wait matters more than the price: late-game
// money grows fast because it is spent growing the business (brand moves, factory steps), so
// a toy bought the moment it is affordable takes that money and slows everything after it.
// Waiting a few days, the money has grown well past the toy's price. (The simulator's
// homeowner bot, careful plus every house step and yard thing as soon as it can: the yard
// about days 109 to 134, one every 4 days, and the island about day 150 against careful's
// 138; the house steps cost most of that, the yard about a day.) The first step is a choice
// between the puppy and the kitten; the pet not picked comes later, in the second pet step.
// state.yard lists the things bought, in step order.
export interface YardThing {
  id: string;
  name: string;
  desc: string;
}

export const YARD_THINGS: Readonly<Record<string, YardThing>> = {
  puppy: { id: 'puppy', name: 'Puppy', desc: 'A puppy with a doghouse of its own!' },
  kitten: { id: 'kitten', name: 'Kitten', desc: 'A kitten with a cat tower to climb!' },
  trampoline: { id: 'trampoline', name: 'Trampoline', desc: 'Bounce, bounce, bounce!' },
  go_kart: { id: 'go_kart', name: 'Go-Kart', desc: 'Zoom around the yard!' },
  bouncy_castle: { id: 'bouncy_castle', name: 'Bouncy Castle', desc: 'A whole castle to bounce in!' },
  robot: { id: 'robot', name: 'Robot Helper', desc: 'It brings you lemonade!' },
  balloon: { id: 'balloon', name: 'Lemon Balloon', desc: 'A hot-air balloon shaped like a lemon!' },
};

export const YARD_DAYS_BETWEEN = 4;

// pick: the things this step offers (two: the kid picks one; a thing already bought drops
// out, so the second pet step offers the pet not picked).
export const YARD_STEPS: readonly { pick: readonly string[]; cost: number }[] = [
  { pick: ['puppy', 'kitten'], cost: 50000 },
  { pick: ['trampoline'], cost: 100000 },
  { pick: ['go_kart'], cost: 250000 },
  { pick: ['puppy', 'kitten'], cost: 500000 },
  { pick: ['bouncy_castle'], cost: 1000000 },
  { pick: ['robot'], cost: 2500000 },
  { pick: ['balloon'], cost: 5000000 },
];

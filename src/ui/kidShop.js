// src/ui/kidShop.js -- the Stand Shop card: one project at a time, in this order. The names,
// prices and what each one does are in src/data/projects.ts; this list adds the picture and
// the pacing.
import { FIRST_CHOICE } from '../data/projects.ts';
import { BOTTLES_FOR_INVENTION } from '../data/wholesale.ts';
import { shopReady } from '../unlocks.ts';

// An item shows once the game unlocks it (from Day 3; the labeler once BOTTLES_FOR_LABELER
// bottles have sold), so the card can be hidden for a while between buys; an "early" item
// shows as a savings goal before it unlocks. The second stand starts Stage 2 (the friends'
// stands); bottling starts Stage 3 (the stores). In Stages 4 and 5 helpers take over the
// daily jobs (engine.runHelpers): the Supply Truck (Morning Prep), the Stand Captain (the
// price and the friends) and the Delivery Route (the stores), each folding its part of the
// page away. After the last factory step come the three big dreams; the last, Citrus Cay,
// is the ending.
// The first two are a choice (FIRST_CHOICE): both show side by side, the kid picks one, and
// the other one comes next. pick: the short line under each in the choice.
// pic: the picture. friends: N hides the item until N friends are hired. cheer: the kid
// cheers when it is bought. notYet(s): what to do first, for an "early" item that has the
// money but is not open.
export const KID_SHOP = [
  { id: 'auto_ice_dispenser', pick: 'Free ice, all day!', pic: './sprites/shop/ice_dispenser.png' },
  { id: 'fridge', pick: 'More customers!', pic: './sprites/shop/mini_fridge.png' },
  { id: 'franchise_license', pic: './sprites/shop/second_stand.png', early: true,
    notYet: () => 'Make your recipe tastier first!' },
  { id: 'club_card', pic: './sprites/shop/club_card.png' },
  { id: 'cargo_wagon', pic: './sprites/shop/big_wagon.png', friends: 2 },
  { id: 'bottling_rig', pic: './sprites/shop/bottles.png', early: true,
    notYet: (s) => `Sell ${Math.max(1, 250 - Math.floor(s.totalCupsSold.toNumber()))} more cups first!` },
  { id: 'commercial_labeler', pic: './sprites/shop/labeler.png' },
  { id: 'patent_filing', pic: './sprites/shop/invent_it.png', early: true,
    notYet: (s) => `${Math.max(0, BOTTLES_FOR_INVENTION - s.totalBottlesSold).toLocaleString('en-US')} bottles to go` },
  { id: 'supply_truck', pic: './sprites/supplies.png' },
  { id: 'stand_captain', pic: './sprites/shop/second_stand.png' },
  { id: 'copacker_deal', pic: './sprites/shop/bottles.png', early: true },
  { id: 'regional_supermarkets', pic: './sprites/shop/bottles.png', early: true },
  { id: 'delivery_route', pic: './sprites/shop/big_wagon.png' },
  { id: 'automated_canning_line', pic: './sprites/shop/bottles.png', early: true },
  { id: 'flavor_lab', pic: './sprites/lemon_wheel.png', early: true },
  { id: 'national_bigbox', pic: './sprites/shop/bottles.png', early: true },
  { id: 'club_store_pallets', pic: './sprites/shop/bottles.png', early: true },
  { id: 'qsr_fountain_licensing', pic: './sprites/shop/bottles.png', early: true },
  { id: 'global_beverage_jv', pic: './sprites/shop/bottles.png', early: true },
  { id: 'private_jet', pic: './sprites/shop/worldwide.png', early: true, cheer: true },
  { id: 'arena_naming', pic: './sprites/franchise/ballpark.png', early: true, cheer: true },
  { id: 'private_island', pic: './sprites/lemon.png', early: true, cheer: true },
];

// Returns { item, p } for the next project (p from engine.projects), or, while neither of the
// first choice is bought, { item, p, choices: [{ item, p }, { item, p }] } (item and p are then
// the first of them).
export function kidShopNext(engine, s) {
  // Leave a whole day between buying an upgrade and introducing the next one.
  if (!shopReady(s)) return null;
  const project = id => engine.projects.find(x => x.id === id);
  const choices = FIRST_CHOICE.map(id => ({ item: KID_SHOP.find(x => x.id === id), p: project(id) }));
  if (choices.every(c => c.p && !c.p.purchased)) {
    return choices.every(c => c.p.unlocked(s)) ? { ...choices[0], choices } : null;
  }
  for (const item of KID_SHOP) {
    const p = project(item.id);
    if (!p || p.purchased) continue;
    // The factory waits until the squeezer sells worldwide.
    if (item.id === 'copacker_deal' && !project('global_licensing').purchased) return null;
    if (item.early) return { item, p };
    // friends: N waits until that many friends are hired (the wagon only helps them).
    const hired = Object.values(engine.franchiseStands).filter(st => st.hired).length;
    if (item.friends && hired < item.friends) return null;
    return p.unlocked(s) ? { item, p } : null;
  }
  return null;
}

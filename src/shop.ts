// src/shop.ts -- the Stand Shop's order: one project at a time, in this order. The names,
// prices and what each one does are in src/data/projects.ts; this list adds the picture and
// the pacing. The page's Stand Shop card (src/ui/standShop.js) and the simulator's bots
// (sim/bots.ts) both shop from nextShopOffer.
import type { LemonadeEngine } from './engine';
import type { GameState, ProjectDef } from './types';
import { FIRST_CHOICE } from './data/projects';
import { BOTTLES_FOR_INVENTION } from './data/wholesale';
import { shopReady } from './unlocks';

// An item shows once the game unlocks it (from Day 3; the labeler once BOTTLES_FOR_LABELER
// bottles have sold), so the card can be hidden for a while between buys; an "early" item
// shows as a savings goal before it unlocks. The second stand starts Stage 2 (the friends'
// stands); bottling starts Stage 3 (the stores). In Stages 4 and 5 helpers take over the
// daily jobs (engine.runHelpers): the Supply Truck (Morning Prep), the Stand Captain (the
// price and the friends) and the Delivery Route (the stores), each folding its part of the
// page away. After the last factory step come the three big dreams; the last, Citrus Cay,
// is the ending.
// The first two are a choice (FIRST_CHOICE): both show side by side, the kid picks one, and
// the other one comes next.
export interface ShopItem {
  id: string;
  pic: string;
  pick?: string;                           // the short line under it in the first choice
  early?: boolean;
  friends?: number;                        // hidden until this many friends are hired
  cheer?: boolean;                         // the kid cheers when it is bought
  notYet?: (s: GameState) => string;       // what to do first: an early item with the money but not open
}

export const SHOP_ITEMS: readonly ShopItem[] = [
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
  { id: 'supply_truck', pic: './sprites/shop/supply_truck.png' },
  { id: 'stand_captain', pic: './sprites/shop/stand_captain.png' },
  { id: 'copacker_deal', pic: './sprites/shop/lemonade_factory.png', early: true },
  { id: 'regional_supermarkets', pic: './sprites/shop/more_supermarkets.png', early: true },
  { id: 'delivery_route', pic: './sprites/shop/delivery_route.png' },
  { id: 'automated_canning_line', pic: './sprites/shop/canning_line.png', early: true },
  { id: 'flavor_lab', pic: './sprites/shop/flavor_lab.png', early: true },
  { id: 'national_bigbox', pic: './sprites/shop/stores_across_the_country.png', early: true },
  { id: 'club_store_pallets', pic: './sprites/shop/club_store_pallets.png', early: true },
  { id: 'qsr_fountain_licensing', pic: './sprites/shop/restaurant_fountains.png', early: true },
  { id: 'global_beverage_jv', pic: './sprites/shop/factories_around_the_world.png', early: true },
  { id: 'private_jet', pic: './sprites/shop/lemonade_jet.png', early: true, cheer: true },
  { id: 'arena_naming', pic: './sprites/shop/lemonade_arena.png', early: true, cheer: true },
  { id: 'private_island', pic: './sprites/shop/citrus_cay.png', early: true, cheer: true },
];

// The Invention card's squeezer picture (Stage 4); once it sells worldwide, the globe of
// squeezers (also its picture on My Shelf).
export const INVENTION = { name: 'Lemon Squeezer', pic: './sprites/shop/squeezer.png', worldPic: './sprites/shop/worldwide.png' };

export interface ShopChoice { item: ShopItem; p: ProjectDef }
// The next project (p from engine.projects), or, while neither of the first choice is
// bought, both of them in `choices` (item and p are then the first of them). null: nothing to
// show today.
export type ShopOffer = ShopChoice & { choices?: ShopChoice[] };

export function nextShopOffer(engine: LemonadeEngine): ShopOffer | null {
  const s = engine.state;
  // Leave a whole day between buying an upgrade and introducing the next one.
  if (!shopReady(s)) return null;
  const project = (id: string) => engine.projects.find(x => x.id === id);
  const choices = FIRST_CHOICE.map(id => ({ item: SHOP_ITEMS.find(x => x.id === id)!, p: project(id)! }));
  if (choices.every(c => !c.p.purchased)) {
    return choices.every(c => c.p.unlocked(s)) ? { ...choices[0], choices } : null;
  }
  for (const item of SHOP_ITEMS) {
    const p = project(item.id);
    if (!p || p.purchased) continue;
    // The factory waits until the squeezer sells worldwide.
    if (item.id === 'copacker_deal' && !project('global_licensing')?.purchased) return null;
    if (item.early) return { item, p };
    // friends: N waits until that many friends are hired (the wagon only helps them).
    const hired = Object.values(engine.franchiseStands).filter(st => st.hired).length;
    if (item.friends && hired < item.friends) return null;
    return p.unlocked(s) ? { item, p } : null;
  }
  return null;
}

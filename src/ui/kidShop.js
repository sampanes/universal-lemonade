// src/ui/kidShop.js -- the Stand Shop card: one upgrade at a time, in this order.
import { FIRST_CHOICE } from '../data/projects.ts';
import { BOTTLES_FOR_INVENTION } from '../data/wholesale.ts';
import { shopReady } from '../unlocks.ts';

// Kid Stand Shop: the next upgrade in this order, one at a time. An item shows once the
// game unlocks it (from Day 3; the labeler once BOTTLES_FOR_LABELER bottles have sold), so
// the card can be hidden for a while between buys; an "early" item shows as a savings goal
// before it unlocks. The second stand starts Stage 2 (the friends' stands); bottling starts
// Stage 3 (the stores). In Stages 4 and 5 helpers take over the daily jobs (engine.runHelpers):
// the Supply Truck (Morning Prep), the Stand Captain (the price and the friends) and the
// Delivery Route (the stores), each folding its part of the page away.
// The first two are a choice (FIRST_CHOICE): both show side by side, the kid picks one, and
// the other one comes next. pick: the short line under each in the choice.
// pic: null shows no picture. friends: N hides the item until N friends are hired.
// notYet(s): what to do first, for an "early" item that has the money but is not open.
export const KID_SHOP = [
  { id: 'auto_ice_dispenser', name: 'Ice Machine', desc: 'Makes all the ice you need, free, and picks the right amount.', pick: 'Free ice, all day!', pic: './sprites/shop/ice_dispenser.png' },
  { id: 'fridge', name: 'Mini-Fridge', desc: 'Unlimited lemons, no spoilage, +10% customers!', pick: 'More customers!', pic: './sprites/shop/mini_fridge.png' },
  { id: 'franchise_license', name: 'A Second Stand', desc: 'Friends can run stands around town for you!', pic: './sprites/shop/second_stand.png', early: true },
  { id: 'costco_card', name: 'Supply Club Card', desc: 'Lemons, sugar and cups cost a lot less!', pic: './sprites/shop/club_card.png' },
  { id: 'cargo_wagon', name: 'Big Wagon', desc: "Haul more to your friends' stands: they each sell more!", pic: './sprites/shop/big_wagon.png', friends: 2 },
  { id: 'bottling_rig', name: 'Bottle It!', desc: 'Bottle your lemonade and sell it to stores!', pic: './sprites/shop/bottles.png', early: true,
    notYet: (s) => `Sell ${Math.max(1, 250 - Math.floor(s.totalCupsSold.toNumber()))} more cups first!` },
  { id: 'commercial_labeler', name: 'Bottle Labeler', desc: 'Labels bottles by machine: bottles cost 30% less!', pic: './sprites/shop/labeler.png' },
  { id: 'patent_filing', name: 'Invent It!', desc: 'Invent a lemon squeezer! Stores sell it, and you get money for every one.', pic: './sprites/shop/invent_it.png', early: true,
    notYet: (s) => `${Math.max(0, BOTTLES_FOR_INVENTION - s.totalBottlesSold).toLocaleString('en-US')} bottles to go` },
  { id: 'supply_truck', name: 'Supply Truck', desc: 'Brings the lemons, sugar, cups and bottles every morning. No more buying!', pic: './sprites/supplies.png' },
  { id: 'stand_captain', name: 'Stand Captain', desc: 'Runs your stands: picks the price and who works each day!', pic: './sprites/shop/second_stand.png' },
  { id: 'copacker_deal', name: 'Lemonade Factory', desc: 'A factory makes your lemonade for stores, with its own supplies!', pic: './sprites/shop/bottles.png', early: true },
  { id: 'regional_supermarkets', name: 'More Supermarkets', desc: 'Send about 300 cases a day to supermarkets!', pic: './sprites/shop/bottles.png', early: true },
  { id: 'delivery_route', name: 'Delivery Route', desc: 'Runs your stores: signs them up and grows their shelves!', pic: './sprites/shop/big_wagon.png' },
  { id: 'automated_canning_line', name: 'Canning Line', desc: 'Make about 1,500 cases a day and earn more per case!', pic: './sprites/shop/bottles.png', early: true },
  { id: 'flavor_lab', name: 'Flavor Lab', desc: 'Invent new flavors! Each one you get just right sells in stores.', pic: './sprites/lemon_wheel.png', early: true },
  { id: 'national_bigbox', name: 'Stores Across the Country', desc: 'Send about 6,000 cases a day across the country!', pic: './sprites/shop/bottles.png', early: true },
  { id: 'club_store_pallets', name: 'Club Store Pallets', desc: 'Ship about 25,000 cases a day to club stores!', pic: './sprites/shop/bottles.png', early: true },
  { id: 'qsr_fountain_licensing', name: 'Restaurant Fountains', desc: 'Serve your lemonade in restaurants around the world!', pic: './sprites/shop/bottles.png', early: true },
  { id: 'global_beverage_jv', name: 'Factories Around the World', desc: 'Make your lemonade around the world!', pic: './sprites/shop/bottles.png', early: true },
];
// Returns { item, p } for the next upgrade, or, while neither of the first choice is bought,
// { item, p, choices: [{ item, p }, { item, p }] } (item and p are then the first of them).
export function kidShopNext(engine, s) {
  // Leave a whole day between buying an upgrade and introducing the next one.
  if (!shopReady(s)) return null;
  const choices = FIRST_CHOICE.map(id => ({ item: KID_SHOP.find(x => x.id === id), p: engine.projects.find(x => x.id === id) }));
  if (choices.every(c => c.p && !c.p.purchased)) {
    return choices.every(c => c.p.unlocked(s)) ? { ...choices[0], choices } : null;
  }
  for (const item of KID_SHOP) {
    const p = engine.projects.find(x => x.id === item.id);
    if (!p || p.purchased) continue;
    if (item.id === 'copacker_deal' && !engine.projects.find(project => project.id === 'global_licensing').purchased) return null;
    if (item.teaser || item.early) return { item, p };
    // friends: N waits until that many friends are hired (the wagon only helps them).
    const hired = Object.values(engine.franchiseStands).filter(st => st.hired).length;
    if (item.friends && hired < item.friends) return null;
    return p.unlocked(s) ? { item, p } : null;
  }
  return null;
}

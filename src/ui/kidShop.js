// src/ui/kidShop.js -- the Stand Shop card: one upgrade at a time, in this order.
import { FIRST_CHOICE } from '../data/projects.ts';
import { BOTTLES_FOR_INVENTION } from '../data/wholesale.ts';
import { shopReady } from '../unlocks.ts';

// Kid Stand Shop: the next upgrade in this order, one at a time. An item shows once the
// game unlocks it (from Day 3), so the card can be hidden for a day between buys; an
// "early" item shows as a savings goal before it unlocks. The second stand starts Stage
// 2 (the friends' stands); bottling starts Stage 3 (the stores).
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
  { id: 'copacker_deal', name: 'Lemonade Factory', desc: 'Coming soon: a real factory bottles your lemonade for supermarkets!', pic: null, teaser: true },
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

// src/ui/shelf.js -- My Shelf: everything the kid buys stays on a shelf instead of just
// leaving the Stand Shop. A small card under My House shows the newest few standing on one
// shelf; tapping it opens the whole shelf (the shelf room), where tapping a thing tells what
// it is, the day it was bought (state.boughtOn) and what it cost, so the shelf reads like the
// story of getting rich. Like My House it waits for the house to open, so the early days stay
// plain.
import { KID_SHOP, INVENTION } from './kidShop.js';
import { fmtWhole } from './format.js';

// What goes on the shelf: the Stand Shop's things, and the squeezer going worldwide (bought on
// the Invention card).
const SHELF = [
  ...KID_SHOP.map(({ id, pic }) => ({ id, pic })),
  { id: 'global_licensing', pic: INVENTION.worldPic },
];
const PEEK = 5;          // things on the card's shelf (the newest)
const PER_SHELF = 6;     // things on each shelf in the shelf room

// The things bought so far, oldest first: { id, pic, name, cost, day } (day: null when a
// Dad Mode jump handed it over).
export function shelfItems(engine) {
  const boughtOn = engine.state.boughtOn;
  return SHELF
    .map(({ id, pic }) => ({ pic, p: engine.projects.find(x => x.id === id) }))
    .filter(({ p }) => p?.purchased)
    .map(({ pic, p }) => ({ id: p.id, pic, name: p.name, cost: p.costCash, day: boughtOn[p.id] ?? null }))
    .sort((a, b) => (a.day ?? 0) - (b.day ?? 0));   // a stable sort: the same day keeps shop order
}

// The card: the newest few (one bought today pops onto the shelf) and how many in all.
export function shelfCardHTML(items, today) {
  const peek = items.slice(-PEEK).map(x =>
    `<img src="${x.pic}" alt=""${x.day === today ? ' class="is-new"' : ''} />`).join('');
  return `<button type="button" class="shelf-card-btn" data-act="shelf-open" aria-label="My Shelf: ${items.length} things. Look at them all">
    <span class="shelf-card-top"><span class="shelf-card-title">My Shelf</span><span class="shelf-card-count">${items.length} ${items.length === 1 ? 'thing' : 'things'}</span></span>
    <span class="shelf-plank">${peek}</span>
  </button>`;
}

// The shelf room: every thing in the order it was bought, a shelf at a time, and always a
// little empty room left to fill.
export function shelfRoomHTML(items) {
  const shelves = Math.max(2, Math.ceil((items.length + 1) / PER_SHELF));
  let rows = '';
  for (let r = 0; r < shelves; r++) {
    let slots = '';
    for (let i = r * PER_SHELF; i < (r + 1) * PER_SHELF; i++) {
      const x = items[i];
      slots += x
        ? `<button type="button" class="shelf-room-item" data-i="${i}" aria-label="${x.name}"><img src="${x.pic}" alt="" /></button>`
        : '<span class="shelf-room-slot"></span>';
    }
    rows += `<div class="shelf-plank shelf-room-row">${slots}</div>`;
  }
  return `<div class="shelf-room-card">
    <div class="shelf-room-title" id="shelf-room-title">My Shelf</div>
    <div class="shelf-room-wall">${rows}</div>
    <div class="shelf-room-caption" aria-live="polite">Tap something on your shelf!</div>
    <button type="button" class="stand-shop-buy" data-act="shelf-close">Done</button>
  </div>`;
}

// What the shelf room says about a thing once it is tapped.
export function shelfCaptionHTML(x) {
  const when = x.day ? `Bought on Day ${x.day} for $${fmtWhole(x.cost)}` : `$${fmtWhole(x.cost)}`;
  return `<b>${x.name}</b><span>${when}</span>`;
}

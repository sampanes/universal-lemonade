// src/ui/shelf.js -- My Shelf: everything the kid buys stays on a shelf instead of just
// leaving the Stand Shop, and the money trophies stand on a shelf of their own. A small card
// under My House shows the newest few standing on one shelf; tapping it opens the whole shelf
// (the shelf room), where tapping a thing tells what it is, the day it was bought
// (state.boughtOn) or won (state.trophyDays) and what it cost, so the shelf reads like the
// story of getting rich. The room also holds the wallpaper picker once a trophy has brought
// one (src/data/trophies.ts). Like My House it waits for the house to open, so the early
// days stay plain.
import { KID_SHOP, INVENTION } from './kidShop.js';
import { BRAND_STEPS } from '../data/brand.ts';
import { TROPHIES, WALLPAPERS } from '../data/trophies.ts';
import { YARD_THINGS, YARD_STEPS } from '../data/yard.ts';
import { fmtWhole } from './format.js';

// Pictures (art_src/cut_sheets.py, build_sticker_art.py, build_wallpaper_art.py).
export const brandPic = (id) => `./sprites/brand/${id}.png`;
export const yardPic = (id) => `./sprites/yard/${id}.png`;
export const trophyPic = (id) => `./sprites/trophies/${id}.png`;
export const wallpaperPic = (id) => `./sprites/wallpapers/${id}.webp`;
// How tall each trophy stands next to the biggest, so the row grows from a little cup to the
// gem statue (each picture is cropped to itself).
const TROPHY_HEIGHT = { bronze: 0.6, silver: 0.68, gold: 0.86, millionaire: 0.9, billionaire: 1 };
export const ALL_SHELF_IMAGES = [
  ...BRAND_STEPS.map(b => brandPic(b.id)), ...Object.keys(YARD_THINGS).map(yardPic),
  ...TROPHIES.map(t => trophyPic(t.id)), ...WALLPAPERS.filter(w => w.id !== 'plain').map(w => wallpaperPic(w.id)),
];

const PEEK = 5;          // things on the card's shelf (the newest)
const PER_SHELF = 6;     // things on each shelf in the shelf room

// The things bought so far, oldest first: { pic, name, cost, day } (day: null when a Dad Mode
// jump handed it over). The Stand Shop's things and the squeezer going worldwide (bought on
// the Invention card), the brand moves and the yard things.
export function shelfItems(engine) {
  const s = engine.state;
  const project = (id, pic) => {
    const p = engine.projects.find(x => x.id === id);
    return p?.purchased ? { pic, name: p.name, cost: p.costCash, day: s.boughtOn[id] ?? null } : null;
  };
  const items = [
    ...KID_SHOP.map(({ id, pic }) => project(id, pic)),
    project('global_licensing', INVENTION.worldPic),
    ...BRAND_STEPS.slice(0, s.brandLevel).map(b => ({ pic: brandPic(b.id), name: b.name, cost: b.cost, day: s.boughtOn[`brand:${b.id}`] ?? null })),
    ...s.yard.map((id, i) => ({ pic: yardPic(id), name: YARD_THINGS[id].name, cost: YARD_STEPS[i].cost, day: s.boughtOn[`yard:${id}`] ?? null })),
  ].filter(Boolean);
  return items.sort((a, b) => (a.day ?? 0) - (b.day ?? 0));   // a stable sort: the same day keeps this order
}

// Every trophy, won or not: { id, pic, name, sales, wallpaper, day } (day: null until won).
export function shelfTrophies(engine) {
  return TROPHIES.map((t, i) => ({ ...t, pic: trophyPic(t.id), day: engine.state.trophyDays[i] ?? null }));
}

// The card: the newest few, trophies too (a thing bought today, or a trophy won yesterday,
// drops onto the shelf), and how many in all.
export function shelfCardHTML(items, trophies, today) {
  const all = [
    ...items.map(x => ({ pic: x.pic, day: x.day ?? 0, fresh: x.day === today })),
    // A trophy is won at the end of its day, after that day's buys.
    ...trophies.filter(t => t.day != null).map(t => ({ pic: t.pic, day: t.day + 0.5, fresh: t.day === today - 1 })),
  ].sort((a, b) => a.day - b.day);
  const peek = all.slice(-PEEK).map(x => `<img src="${x.pic}" alt=""${x.fresh ? ' class="is-new"' : ''} />`).join('');
  return `<button type="button" class="shelf-card-btn" data-act="shelf-open" aria-label="My Shelf: ${all.length} things. Look at them all">
    <span class="shelf-card-top"><span class="shelf-card-title">My Shelf</span><span class="shelf-card-count">${all.length} ${all.length === 1 ? 'thing' : 'things'}</span></span>
    <span class="shelf-plank">${peek}</span>
  </button>`;
}

// The shelf room: the trophy shelf (the ones still to win stand there as shadows), then every
// thing bought in the order it was bought, a shelf at a time with a little empty room left to
// fill, and the wallpapers once there is more than one. newWallpaper: the one a trophy just
// brought (it glows).
export function shelfRoomHTML(items, trophies, wallpapers, current, newWallpaper) {
  const trophySlots = trophies.map((t, i) =>
    `<button type="button" class="shelf-room-item shelf-trophy${t.day == null ? ' not-yet' : ''}" data-trophy="${i}" style="--h:${TROPHY_HEIGHT[t.id]}" aria-label="${t.day == null ? 'A trophy still to win' : t.name}"><img src="${t.pic}" alt="" /></button>`).join('');
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
  const walls = wallpapers.length > 1 ? `<div class="shelf-wallpapers" role="group" aria-label="Wallpaper"><span>Wallpaper</span>${wallpapers.map(id =>
    `<button type="button" class="shelf-wallpaper${id === newWallpaper ? ' is-new' : ''}" data-wallpaper="${id}"${id === 'plain' ? '' : ` style="background-image:url(${wallpaperPic(id)})"`} aria-label="${WALLPAPERS.find(w => w.id === id).name}" aria-pressed="${id === current}"></button>`).join('')}</div>` : '';
  return `<div class="shelf-room-card">
    <div class="shelf-room-title" id="shelf-room-title">My Shelf</div>
    <div class="shelf-plank shelf-trophies">${trophySlots}</div>
    <div class="shelf-room-wall">${rows}</div>
    <div class="shelf-room-caption" aria-live="polite">Tap something on your shelf!</div>
    ${walls}
    <button type="button" class="stand-shop-buy" data-act="shelf-close">Done</button>
  </div>`;
}

// What the shelf room says about a thing once it is tapped.
export function shelfCaptionHTML(x) {
  const when = x.day ? `Bought on Day ${x.day} for $${fmtWhole(x.cost)}` : `$${fmtWhole(x.cost)}`;
  return `<b>${x.name}</b><span>${when}</span>`;
}

// ...and about a trophy: when it was won, or how to win it.
export function trophyCaptionHTML(t) {
  const sales = `$${fmtWhole(t.sales)}`;
  return t.day == null
    ? `<b>A trophy still to win!</b><span>Sell ${sales} since Day 1 to win it.</span>`
    : `<b>${t.name}</b><span>Won on Day ${t.day}: ${sales} sold since Day 1!</span>`;
}

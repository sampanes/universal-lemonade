// src/ui/shelf.js -- My Shelf: everything the kid buys stays on a shelf instead of just
// leaving the Stand Shop, and the money trophies stand on a shelf of their own (what stands
// there: src/shelf.ts). A small card under My House shows the newest few standing on one
// shelf; tapping it opens the whole shelf (the shelf room), where tapping a thing tells what
// it is, the day it was bought or won and what it cost, so the shelf reads like the story of
// getting rich. The room also holds the wallpaper picker once a trophy has brought one
// (src/data/trophies.ts). Like My House it waits for the house to open, so the early days
// stay plain.
import { session } from './session.js';
import { setHTMLIfChanged, setHidden } from './dom.js';
import { fmtWhole } from './format.js';
import { shelfItems, shelfTrophies } from '../shelf.ts';
import { BRAND_STEPS } from '../data/brand.ts';
import { TROPHIES, WALLPAPERS } from '../data/trophies.ts';
import { YARD_THINGS } from '../data/yard.ts';
import { brandPic, yardPic, trophyPic, wallpaperPic } from '../pictures.ts';

// How tall each trophy stands next to the biggest, so the row grows from a little cup to the
// gem statue (each picture is cropped to itself).
const TROPHY_HEIGHT = { bronze: 0.6, silver: 0.68, gold: 0.86, millionaire: 0.9, billionaire: 1 };
export const ALL_SHELF_IMAGES = [
  ...BRAND_STEPS.map(b => brandPic(b.id)), ...Object.keys(YARD_THINGS).map(yardPic),
  ...TROPHIES.map(t => trophyPic(t.id)), ...WALLPAPERS.filter(w => w.id !== 'plain').map(w => wallpaperPic(w.id)),
];

const PEEK = 5;          // things on the card's shelf (the newest)
const PER_SHELF = 6;     // things on each shelf in the shelf room
const $ = (id) => document.getElementById(id);

// The card: the newest few, trophies too (a thing bought today, or a trophy won yesterday,
// drops onto the shelf), and how many in all.
function shelfCardHTML(items, trophies, today) {
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
function shelfRoomHTML(items, trophies, wallpapers, current, newWallpaper) {
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
function itemCaptionHTML(x) {
  const when = x.day ? `Bought on Day ${x.day} for $${fmtWhole(x.cost)}` : `$${fmtWhole(x.cost)}`;
  return `<b>${x.name}</b><span>${when}</span>`;
}

// ...and about a trophy: when it was won, or how to win it.
function trophyCaptionHTML(t) {
  const sales = `$${fmtWhole(t.sales)}`;
  return t.day == null
    ? `<b>A trophy still to win!</b><span>Sell ${sales} since Day 1 to win it.</span>`
    : `<b>${t.name}</b><span>Won on Day ${t.day}: ${sales} sold since Day 1!</span>`;
}

let items = [];
let trophies = [];

export function renderShelf(s) {
  items = shelfItems(session.engine);
  trophies = shelfTrophies(session.engine);
  const show = s.houseOpen && (items.length > 0 || s.trophyDays.length > 0);
  setHidden($('shelf-card'), !show);
  if (show) setHTMLIfChanged($('shelf-card'), shelfCardHTML(items, trophies, s.day));
  if (document.body.dataset.wallpaper !== s.wallpaper) document.body.dataset.wallpaper = s.wallpaper;
}

const room = () => $('shelf-room');

// pick: { trophy: index to show (the Day Report's trophy news), wallpaper: one to make glow }.
export function openShelfRoom(pick = {}) {
  const engine = session.engine;
  room().innerHTML = shelfRoomHTML(items, trophies, engine.wallpapersOpen(), engine.state.wallpaper, pick.wallpaper);
  room().hidden = false;
  room().querySelector('[data-act="shelf-close"]').focus({ preventScroll: true });
  if (pick.trophy != null) pickThing(room().querySelector(`[data-trophy="${pick.trophy}"]`));
}

function closeShelfRoom() {
  if (room().hidden) return;
  room().hidden = true;
  room().innerHTML = '';
  document.querySelector('[data-act="shelf-open"]')?.focus({ preventScroll: true });
}

function pickThing(item) {
  room().querySelector('.shelf-room-caption').innerHTML = item.dataset.trophy != null
    ? trophyCaptionHTML(trophies[+item.dataset.trophy]) : itemCaptionHTML(items[+item.dataset.i]);
  room().querySelector('.shelf-room-item.picked')?.classList.remove('picked');
  void item.offsetWidth;   // restart the wiggle on a second tap
  item.classList.add('picked');
}

// The Day Report banner the day a money trophy is won (src/ui/reportModal.js); its button
// opens the shelf with the new trophy picked (and a wallpaper it brought glowing).
export function trophyNews(id) {
  const t = TROPHIES.find(x => x.id === id);
  const wall = t.wallpaper ? ` And a new ${WALLPAPERS.find(w => w.id === t.wallpaper).name} wallpaper!` : '';
  return {
    cls: 'trophy-news',
    pic: `<div class="trophy-news-pic"><img src="${trophyPic(id)}" alt="" /></div>`,
    title: `${t.name}!`,
    text: `You sold $${fmtWhole(t.sales)} since Day 1!${wall}`,
    button: 'See it!',
    onPress: () => openShelfRoom({ trophy: TROPHIES.indexOf(t), wallpaper: t.wallpaper }),
  };
}

export function initShelf() {
  room().addEventListener('click', (e) => {
    const item = e.target.closest('.shelf-room-item');
    if (item) { pickThing(item); return; }
    const wall = e.target.closest('.shelf-wallpaper');
    if (wall) {
      if (session.engine.setWallpaper(wall.dataset.wallpaper)) {
        for (const b of room().querySelectorAll('.shelf-wallpaper')) b.setAttribute('aria-pressed', String(b === wall));
        wall.classList.remove('is-new');
        document.body.dataset.wallpaper = session.engine.state.wallpaper;
      }
      return;
    }
    // Done, or a tap outside the card.
    if (e.target.closest('[data-act="shelf-close"]') || e.target === room()) closeShelfRoom();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeShelfRoom(); });
}

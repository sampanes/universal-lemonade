// src/main.js -- the game screen: starts the game (src/ui/session.js), wires each part of the
// page (src/ui/), opens the stand each day, and redraws the page every frame. Each part only
// touches the page where something changed (src/ui/dom.js).
import { playDayScene, rehearseDayScene } from './scene/playDayScene.ts';
import { prepareCustomers } from './scene/customerArt.ts';
import { loadKidArt, kidImageURL } from './kid.ts';
import { preloadInBackground, whenIdle } from './preload.ts';
import { FLAVORS } from './data/flavors.ts';
import { SHOP_ITEMS, INVENTION } from './shop.ts';
import { fruitPic } from './pictures.ts';
import { session, startSession, saveGame, newGame } from './ui/session.js';
import { kid, initKidView, renderHeaderKid } from './ui/kidView.js';
import { initMirror, renderMirror, checkMagicLooks, magicLookNews, resetLooks } from './ui/mirror.js';
import { initReportModal, openDayReport } from './ui/reportModal.js';
import { initRecipeCard, renderRecipeCard } from './ui/recipeCard.js';
import { initMorningPrep, renderMorningPrep, resetMorningPrep } from './ui/morningPrep.js';
import { initStandShop, renderStandShop } from './ui/standShop.js';
import { initFlavorLab, renderFlavorLab } from './ui/flavorLab.js';
import { initPartners, renderPartners, resetPartners } from './ui/partners.js';
import { initHouse, renderHouse, houseNews } from './ui/house.js';
import { initShelf, renderShelf, openShelfRoom, trophyNews, ALL_SHELF_IMAGES } from './ui/shelf.js';
import { initMoneyBag, renderMoneyBag, setMoneyBag } from './ui/moneyBag.js';
import { initEnding, renderEnding, hideEnding } from './ui/ending.js';
import { initResetCard } from './ui/resetCard.js';
import { ALL_HOUSE_IMAGES } from './ui/houseArt.js';
import { FRIENDS, ALL_PLACE_IMAGES, friendPortrait, sceneLocation } from './ui/places.js';

startSession();
initKidView();

// Track which input is in use so mouse-only hover styles switch off after a finger tap.
// (The touchscreen all-in-one this is played on has a mouse too, so CSS alone cannot tell.)
const root = document.documentElement;
window.addEventListener('pointerdown', (e) => { root.classList.toggle('touch-input', e.pointerType === 'touch'); }, true);
window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' && root.classList.contains('touch-input')) root.classList.remove('touch-input');
}, true);

const scenePlace = (id) => sceneLocation(id, session.engine, kid.profile);

// ---- Opening the stand: the day is worked out first, then the day scene plays it, then the
// Day Report pops up with any big news on top. While the scene plays the page stays as it was
// that morning (the loop skips its redraw).
let playingDay = false;
async function openForBusiness() {
  if (playingDay) return;
  playingDay = true;
  let summary = null, look = null;
  try {
    summary = session.engine.runDay();
    look = checkMagicLooks(summary);
    saveGame();
    await playDayScene(summary, scenePlace);
  } finally {
    playingDay = false;
    // The report is filled in and shown the moment the scene closes, in the same frame.
    if (summary) {
      const news = [];
      if (look) news.push(magicLookNews(look));
      if (summary.trophyWon) news.push(trophyNews(summary.trophyWon));
      if (summary.houseOpened) news.push(houseNews());
      openDayReport(summary, news, true);
    }
  }
}

// Reset (the hold-to-confirm card): a brand-new game, and the look and secret looks are
// forgotten too, so the mirror greets a new player.
function startOver() {
  newGame();
  resetMorningPrep();
  resetPartners();
  hideEnding();
  resetLooks();
}

function render() {
  const s = session.engine.state;
  renderMoneyBag(s);
  renderHeaderKid(s);
  renderMorningPrep(s);
  renderRecipeCard(s);
  renderStandShop(s);
  renderFlavorLab(s);
  renderPartners(s);
  renderHouse(s);
  renderShelf(s);
  renderEnding(s);
}

let last = performance.now();
let lastSaveAt = last;
function loop(now) {
  session.engine.tick((now - last) / 1000);
  last = now;
  if (now - lastSaveAt >= 1000) { lastSaveAt = now; saveGame(); }
  if (!playingDay) render();
  requestAnimationFrame(loop);
}

initReportModal();
initRecipeCard();
initMorningPrep();
initStandShop();
initFlavorLab();
initPartners();
initHouse({ openShelf: () => openShelfRoom() });
initShelf();
initMoneyBag({ openReport: () => { const d = session.engine.state.lastDaySummary; if (d) openDayReport(d); } });
initEnding();
initMirror({ onOpen: () => setMoneyBag(false) });
initResetCard({ onOpen: () => setMoneyBag(false), onConfirm: startOver });
document.getElementById('btn-run-day').onclick = openForBusiness;

// Pictures that only show up later (the next shop item, stores, friends' stands, every house,
// the Flavor Lab's fruits, the brand moves, the yard, the trophies and wallpapers, the day
// scene's clouds and customers): loaded while the page is idle, so they never pop in.
whenIdle(() => {
  void preloadInBackground([
    ...ALL_HOUSE_IMAGES, ...ALL_PLACE_IMAGES, './sprites/morning_prep/cloud_puff.png',
    ...SHOP_ITEMS.map(item => item.pic), INVENTION.pic, INVENTION.worldPic, ...FLAVORS.map(f => fruitPic(f.id)), ...ALL_SHELF_IMAGES,
  ]).then(prepareCustomers);
});

loadKidArt().then(() => {
  kid.version++;
  renderMirror();
  // The day scene's sellers (the kid and each friend at their stand) are drawn now, while
  // nothing is happening, instead of when the stand opens. Then the scene has a rehearsal, so
  // the first real one starts smoothly (playDayScene.ts).
  whenIdle(() => {
    const sellers = [kidImageURL(kid.profile, 'happy', 'stand'), ...Object.keys(FRIENDS).map(id => friendPortrait(id, 'happy', 'stand'))];
    void preloadInBackground(sellers).then(() => {
      rehearseDayScene(session.engine.state.weather, session.engine.state.tempF, scenePlace);
    });
  });
}).catch((e) => console.warn('[Kid]', e.message));

requestAnimationFrame(loop);

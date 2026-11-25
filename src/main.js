// src/main.js -- the game screen: wires the engine (src/engine.ts) to the page in index.html,
// runs the frame loop, and saves the game.
import { LemonadeEngine } from './engine.ts';
import { SQUEEZER_LEVELS } from './data/projects.ts';
import { FLAVORS, FLAVOR_BOOST } from './data/flavors.ts';
import { BRAND_STEPS } from './data/brand.ts';
import { HOUSE_STEPS, HOUSE_COLORS } from './data/house.ts';
import { TROPHIES, WALLPAPERS } from './data/trophies.ts';
import {
  loadCharacterProfile,
  saveCharacterProfile,
  hasSavedCharacterProfile,
  clearCharacterProfile,
  SKIN_PALETTES,
  HAIR_PALETTES,
  UNIFORM_PALETTES
} from './character.ts';
import { playDayScene, rehearseDayScene } from './scene/playDayScene.ts';
import { skyCondition, temperatureBand } from './scene/forecastArt.ts';
import { HATS, SHADES, accessoryURL } from './headwear.ts';
import { loadKidArt, kidImageURL, kidHairCount, kidHairIds, kidFx } from './kid.ts';
import { fmtWhole, fmtDollars, fmtMoney, fmtCount, fmtSigned, fmtRest } from './ui/format.js';
import { setText, setFitText, setHTMLIfChanged, STORE_LOCK } from './ui/dom.js';
import { housePicHTML, ALL_HOUSE_IMAGES } from './ui/houseArt.js';
import { STORE_PICS, FRIENDS, ALL_PLACE_IMAGES, friendPortrait, sceneLocation } from './ui/places.js';
import { reportCatMood, renderFullDayReportHTML, renderDayReport } from './ui/dayReport.js';
import { KID_SHOP, INVENTION, kidShopNext } from './ui/kidShop.js';
import { shelfItems, shelfTrophies, shelfCardHTML, shelfRoomHTML, shelfCaptionHTML, trophyCaptionHTML, brandPic, trophyPic, ALL_SHELF_IMAGES } from './ui/shelf.js';
import { yardStripHTML, yardNextHTML, yardSceneHTML } from './ui/yard.js';
import { moneyBagHTML, SUPPLY_PICS } from './ui/moneyBag.js';
import { renderDadPanel, initDadPanel } from './ui/dadPanel.js';
import { initResetCard } from './ui/resetCard.js';
import { preloadInBackground, whenIdle } from './preload.ts';
import { prepareCustomers } from './scene/customerArt.ts';
import { STORAGE_KEYS, clearOutdatedStorage, readStored, writeStored } from './storage.ts';
import { loadUnlocks, saveUnlocks, clearUnlocks, advanceLookUnlocks, unlockCheckFrom, otherUnlockToday, shopDaysRemaining, lookOpen } from './unlocks.ts';

// A Flavor Lab fruit's picture (art_src/cut_sheets.py, build_sticker_art.py).
const fruitPic = (flavor) => `./sprites/flavors/${flavor.id}.png`;

clearOutdatedStorage();   // first, before any save or look is read

// Track which input is in use so mouse-only hover styles switch off after a finger tap.
// (The touchscreen all-in-one this is played on has a mouse too, so CSS alone cannot tell.)
const rootEl = document.documentElement;
window.addEventListener('pointerdown', (e) => {
  rootEl.classList.toggle('touch-input', e.pointerType === 'touch');
}, true);
window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' && rootEl.classList.contains('touch-input')) rootEl.classList.remove('touch-input');
}, true);

// Every new game (page load or Reset) gets a fresh seed, so the weather and this game's
// golden recipe change. Dad testing: add ?seed=123 to the URL to replay the same game.
function newGameSeed() {
  const fromUrl = parseInt(new URLSearchParams(window.location.search).get('seed') || '', 10);
  if (Number.isFinite(fromUrl) && fromUrl !== 0) return fromUrl;
  try {
    return (crypto.getRandomValues(new Uint32Array(1))[0] | 0) || 1;
  } catch {
    return (Math.floor(Math.random() * 0x7fffffff) | 0) || 1;
  }
}
function updateDadSeedInfo() {
  const el = document.getElementById('dad-seed-info');
  if (!el) return;
  const g = engine.getGoldenRecipe();
  el.textContent = `Seed ${engine.seed} / Golden ${g.lemons}:${g.sugar}`;
}

let timeScale = 1;
let autoDay = false;
let autoDayTimer = 0;
let buyPackMult = 1;

// ---- Dad-Testing Mode Flag ----
const urlParams = new URLSearchParams(window.location.search);
let dadModeActive = true; // Defaults to true while Dad is testing
const savedDadMode = readStored(STORAGE_KEYS.dadMode);
if (urlParams.has('dad')) {
  const p = urlParams.get('dad');
  dadModeActive = p !== '0' && p !== 'false';
  writeStored(STORAGE_KEYS.dadMode, dadModeActive ? 'true' : 'false');
} else if (savedDadMode !== null) {
  dadModeActive = savedDadMode === 'true';
}

function setDadMode(enabled) {
  dadModeActive = !!enabled;
  document.body.classList.toggle('dad-mode', dadModeActive);
  writeStored(STORAGE_KEYS.dadMode, dadModeActive ? 'true' : 'false');
  document.dispatchEvent(new Event('dadmodechange'));
  const toggleBtn = document.getElementById('btn-dad-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = dadModeActive ? 'DAD MODE: ON' : 'Dad Mode: OFF';
    toggleBtn.title = dadModeActive ? 'Dad Mode test controls ACTIVE (Click to turn OFF)' : 'Dad Mode test controls OFF (Click to turn ON)';
  }
  console.log(`[Dad Mode] ${dadModeActive ? 'Enabled' : 'Disabled'}`);
}
setDadMode(dadModeActive);
window.setDadMode = setDadMode;
window.isDadMode = () => dadModeActive;

// ---- Saving ----
// The game saves itself about once a second and whenever the page is hidden or closed,
// and picks up where it left off on the next visit. Dad Mode plays its own game with its
// own save, so stage jumps and 50x test days never touch the kid's game. A ?seed=NUMBER
// address always starts a fresh game with that seed (and saves over that mode's game).
let engineIsDads = dadModeActive;          // which save the running game belongs to
function loadGame(dad) {
  try {
    const raw = readStored(dad ? STORAGE_KEYS.dadGame : STORAGE_KEYS.kidGame);
    return raw ? LemonadeEngine.fromSave(JSON.parse(raw)) : null;
  } catch (e) {
    console.warn('[Save] could not load, starting a new game:', e.message);
    return null;
  }
}
function saveGame() {
  writeStored(engineIsDads ? STORAGE_KEYS.dadGame : STORAGE_KEYS.kidGame, JSON.stringify(engine.toSave()));
}
const seedInUrl = urlParams.has('seed');
let engine = (!seedInUrl && loadGame(dadModeActive)) || new LemonadeEngine({ seed: newGameSeed() });
updateDadSeedInfo();
window.addEventListener('pagehide', saveGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });

// ---- Money Box (cat cash counter) helpers ----
const SPRITE_DIR = './sprites/kawaii_cat/';
// Native glyph widths in px at the shared 68 px glyph height.
const DIGIT_W = { '0': 51, '1': 33, '2': 47, '3': 47, '4': 54, '5': 47, '6': 49, '7': 47, '8': 49, '9': 50, ',': 24 };
const digitSrc = (ch) => `${SPRITE_DIR}${ch === ',' ? 'nc' : 'n' + ch}.png`;
Object.keys(DIGIT_W).forEach(ch => { new Image().src = digitSrc(ch); }); // warm the cache

// Draw a number with the digit sprites. Anything the sheet has no glyph for
// ("." and the T / Qa suffix letters) falls back to a matching ink-colored shape or text.
// Digits all get the widest digit's cell, so the size only changes when a digit is added.
const DIGIT_CELL = DIGIT_W['4'] / 68;
function renderSpriteNumber(el, text) {
  if (!el || el._lastText === text) return;
  el._lastText = text;
  let html = '';
  let units = 0;
  for (const ch of text) {
    if (ch === ',') {
      html += `<img src="${digitSrc(ch)}" alt="" />`;
      units += DIGIT_W[ch] / 68;
    } else if (DIGIT_W[ch]) {
      html += `<img class="sn-d" src="${digitSrc(ch)}" alt="" />`;
      units += DIGIT_CELL;
    } else if (ch === '.') {
      html += '<span class="sn-dot"></span>';
      units += 0.35;
    } else if (ch === ' ') {
      html += '<span class="sn-gap"></span>';
      units += 0.18;
    } else {
      html += `<span class="sn-txt">${ch}</span>`;
      units += 0.56;
    }
  }
  el.innerHTML = html;
  el.style.setProperty('--units', units.toFixed(2));
  el.setAttribute('aria-label', `${text} dollars`);
}

let prevCashNum = null;   // null = do not announce the next cash change (fresh game)
let catCheerUntil = 0;
let choreMaxRemain = 0;

function spawnCashFloat(delta) {
  const box = document.getElementById('bank-floaters');
  if (!box) return;
  while (box.children.length >= 4) box.removeChild(box.firstChild);
  const el = document.createElement('div');
  el.className = `bank-float ${delta > 0 ? 'gain' : 'spend'}`;
  el.textContent = fmtSigned(delta);
  el.addEventListener('animationend', () => el.remove());
  box.appendChild(el);
}

// The report's hero picture: the player's own kid with a face for the day (the cat until
// the kid art has loaded).
function reportKidHTML(d) {
  const pic = kidPicHTML(kidProfile, kidMoodFor(d), true);
  return pic ? `<span class="report-kid">${pic}</span>`
    : `<img class="report-cat" src="${SPRITE_DIR}cat${reportCatMood(d)}.png" alt="" />`;
}

// Cat mood 0..3 from how the last day went; 4 (cheering) is reserved for money coming in.
function baseCatMood(s) {
  const d = s.lastDaySummary;
  if (!d) return 1;
  if (d.netProfit <= 0) return 0;
  if (d.recipeQuality < 0.5) return 1;
  if (d.recipeQuality < 0.8) return 2;
  return 3;
}

// Header Speed Controls
function setSpeed(s) {
  timeScale = s;
  [1, 10, 50].forEach(v => {
    const btn = document.getElementById(`btn-speed-${v}`);
    btn.style.borderColor = (v === s) ? '#ffd700' : '#666';
    btn.style.color = (v === s) ? '#ffd700' : '#fff';
  });
}
document.getElementById('btn-speed-1').onclick = () => setSpeed(1);
document.getElementById('btn-speed-10').onclick = () => setSpeed(10);
document.getElementById('btn-speed-50').onclick = () => setSpeed(50);
setSpeed(1);

// Packs-per-tap controls (+1 / +10 / +100 candy buttons)
const PACK_STEPS = [1, 10, 100];
function setPackMult(m) {
  buyPackMult = m;
  PACK_STEPS.forEach(v => {
    const btn = document.getElementById(`btn-mult-${v}`);
    if (btn) btn.classList.toggle('active', v === m);
  });
}
PACK_STEPS.forEach(v => {
  document.getElementById(`btn-mult-${v}`).onclick = () => setPackMult(v);
});
setPackMult(1);

window._toggleAutoIce = () => {
  engine.state.flags.autoIceEnabled = !engine.state.flags.autoIceEnabled;
  if (engine.state.flags.autoIceEnabled) {
    engine.state.recipe.icePerCup = engine.computeIdealIce(engine.state.tempF);
  }
};
document.getElementById('btn-autoice').onclick = window._toggleAutoIce;

const btnDadToggle = document.getElementById('btn-dad-toggle');
if (btnDadToggle) {
  btnDadToggle.onclick = () => setDadMode(!dadModeActive);
}
let titleClickCount = 0;
let titleClickTimer = null;
const headerTitle = document.getElementById('header-title');
if (headerTitle) {
  headerTitle.onclick = () => {
    titleClickCount++;
    clearTimeout(titleClickTimer);
    titleClickTimer = setTimeout(() => { titleClickCount = 0; }, 800);
    if (titleClickCount >= 3) {
      titleClickCount = 0;
      setDadMode(!dadModeActive);
    }
  };
}

// Dad Mode: skip to the start of a later stage (only stages after the current one).
const dadJump = document.getElementById('dad-jump');
dadJump.onchange = () => {
  const target = Number(dadJump.value);
  dadJump.value = '';
  if (target && engine.dadJumpToPhase(target)) refreshDadJump();
};
function refreshDadJump() {
  for (const opt of dadJump.options) if (opt.value) opt.disabled = Number(opt.value) <= engine.state.phase;
}
refreshDadJump();
// Stages also change by playing and by Reset, so check again whenever the list opens.
dadJump.addEventListener('pointerdown', refreshDadJump);
dadJump.addEventListener('focus', refreshDadJump);

document.getElementById('btn-autoday').onclick = (e) => {
  autoDay = !autoDay;
  e.target.textContent = `Auto-Day: ${autoDay ? 'ON' : 'OFF'}`;
  e.target.style.borderColor = autoDay ? '#4ade80' : '#666';
  e.target.style.color = autoDay ? '#4ade80' : '#fff';
};

// Swap in another game (Reset, or switching Dad Mode) and forget what the screen
// remembered about the old one.
function setEngine(next) {
  engine = next;
  updateDadSeedInfo();
  refreshDadJump();
  prevCashNum = null; // a jump in cash between games is not income: no float, no cheer
  catCheerUntil = 0;
  choreMaxRemain = 0;
  partnersPhase = null;     // the other game opens on its newest tab
  closeEnding(false);
}

// Reset (see the hold-to-confirm card near the mirror code): a brand-new game. In kid
// mode the saved look and secret looks are forgotten too, so the mirror greets a new
// player; in Dad Mode only Dad's test game starts over.
function startOver() {
  setEngine(new LemonadeEngine({ seed: newGameSeed() }));
  saveGame();
  if (!dadModeActive) resetKid();
}

// Switching Dad Mode puts the other game on: the old one is saved first. Leaving Dad
// Mode also puts the test speed and Auto-Day back to normal.
document.addEventListener('dadmodechange', () => {
  if (engineIsDads === dadModeActive) return;
  saveGame();
  engineIsDads = dadModeActive;
  setEngine(loadGame(dadModeActive) || new LemonadeEngine({ seed: newGameSeed() }));
  if (!dadModeActive) {
    setSpeed(1);
    if (autoDay) document.getElementById('btn-autoday').click();
  }
});

// THE ENDING: buying Citrus Cay (the last dream in the Stand Shop) wins the game. The island
// (the shop's Citrus Cay picture) with the kid and the stand on its beach, confetti, then
// what the business did since Day 1. It plays once (state.endingSeen); "Keep playing!" goes back to the game.
function showEnding() {
  const s = engine.state;
  const scene = document.getElementById('ending-scene');
  const colors = ['#facc15', '#f472b6', '#a78bfa', '#34d399', '#60a5fa'];
  const confetti = Array.from({ length: 18 }, (_, i) =>
    `<span class="house-confetti" style="left:${3 + i * 5.4}%;background:${colors[i % colors.length]};animation-delay:${(0.8 + ((i * 7) % 10) * 0.07).toFixed(2)}s"></span>`).join('');
  scene.innerHTML = `<div class="house-scene-card ending-card">
    <div class="ending-stage">
      <img class="ending-sun" src="./sprites/morning_prep/sun_happy.png" alt="" />
      <img class="ending-cloud" src="./sprites/morning_prep/cloud_puff.png" alt="" />
      <div class="ending-sea"></div>
      <img class="ending-island" src="./sprites/shop/citrus_cay.png" alt="" />
      <img class="ending-stand" src="./sprites/franchise/pool.png" alt="" />
      <span class="ending-kid">${kidPicHTML(kidProfile, 'cheer', false)}</span>
    </div>
    ${confetti}
    <div class="house-scene-title" id="ending-title">Citrus Cay is yours!</div>
    <p class="ending-text">From one driveway stand to your very own lemonade island. You did it!</p>
    <div class="ending-stats">
      <span><b>${s.day.toLocaleString('en-US')}</b> days</span>
      <span><b>${fmtCount(s.totalCupsSold)}</b> drinks sold</span>
      <span><b>$${fmtMoney(s.totalRevenueEarned)}</b> in sales</span>
    </div>
    <button type="button" class="stand-shop-buy" data-act="ending-close">Keep playing!</button>
  </div>`;
  scene.hidden = false;
  scene.querySelector('[data-act="ending-close"]').focus({ preventScroll: true });
}
// seen: the kid watched it (it will not play again); false: just hide it (another game).
function closeEnding(seen = true) {
  const scene = document.getElementById('ending-scene');
  if (seen && !scene.hidden) { engine.state.endingSeen = true; saveGame(); }
  scene.hidden = true;
  scene.innerHTML = '';
}
document.getElementById('ending-scene').addEventListener('click', (e) => {
  if (e.target.closest('[data-act="ending-close"]')) closeEnding();
});

// Chore Click
document.getElementById('btn-chore').onclick = () => engine.doChore();
const btnChoreEm = document.getElementById('btn-chore-emergency');
if (btnChoreEm) btnChoreEm.onclick = () => engine.doChore();

// Foldable State & Controllers
let reportInlineExpanded = false;
let bankExpanded = false;

window._toggleReportInline = (e) => {
  if (e) e.stopPropagation();
  reportInlineExpanded = !reportInlineExpanded;
  setHTMLIfChanged(document.getElementById('readout-pnl'), renderDayReport(engine.state, reportInlineExpanded, reportKidHTML));
};

function setBankExpanded(expanded) {
  bankExpanded = expanded;
  const bankCard = document.getElementById('bank-card');
  const bankDrawer = document.getElementById('bank-stats-drawer');
  const btnToggle = document.getElementById('btn-toggle-bank-stats');
  const toggleText = document.getElementById('bank-toggle-text');
  if (bankCard) bankCard.classList.toggle('is-expanded', bankExpanded);
  if (bankDrawer) bankDrawer.classList.toggle('is-open', bankExpanded);
  if (btnToggle) {
    btnToggle.classList.toggle('open', bankExpanded);
    btnToggle.setAttribute('aria-expanded', bankExpanded ? 'true' : 'false');
  }
  if (toggleText) {
    toggleText.textContent = bankExpanded ? 'Hide Stats' : 'Stats & Ratings';
  }
}

const btnToggleBank = document.getElementById('btn-toggle-bank-stats');
if (btnToggleBank) {
  btnToggleBank.onclick = (e) => {
    e.stopPropagation();
    setBankExpanded(!bankExpanded);
  };
}

function openReportModal(summary) {
  renderReportModal(summary);
  showReportModal();
}

function renderReportModal(summary) {
  const modalContent = document.getElementById('report-modal-content');
  if (modalContent) modalContent.innerHTML = renderFullDayReportHTML(summary, engine.state, true, reportKidHTML);
}

// instant: no fade or pop. The day's report shows the moment the day scene closes (in the same
// frame), so the page never shows in between. It used to be filled in and opened behind the
// scene, where drawing it (its blur most of all) made the scene's first moments stutter.
function showReportModal(instant = false) {
  const modalBackdrop = document.getElementById('report-modal-backdrop');
  if (!modalBackdrop) return;
  if (instant) modalBackdrop.classList.add('no-fade');
  modalBackdrop.classList.add('active');
  modalBackdrop.setAttribute('aria-hidden', 'false');
  if (instant) {
    void modalBackdrop.offsetWidth;   // settle it open with no transition, then put them back
    modalBackdrop.classList.remove('no-fade');
  }
}

function closeReportModal() {
  const modalBackdrop = document.getElementById('report-modal-backdrop');
  if (modalBackdrop && modalBackdrop.classList.contains('active')) {
    modalBackdrop.classList.remove('active');
    modalBackdrop.setAttribute('aria-hidden', 'true');
    const ticket = document.getElementById('report-dock-ticket');
    if (ticket) {
      ticket.style.transform = 'scale(1.05)';
      setTimeout(() => { if (ticket) ticket.style.transform = ''; }, 300);
    }
  }
}

document.getElementById('btn-report-modal-continue').onclick = closeReportModal;
document.getElementById('btn-report-modal-x').onclick = closeReportModal;
document.getElementById('report-modal-backdrop').onclick = (e) => {
  if (e.target === document.getElementById('report-modal-backdrop')) {
    closeReportModal();
  }
};

// Click-away listener: collapses open drawers when clicking outside
document.addEventListener('click', (e) => {
  // 1. Collapse Report if expanded and clicked outside #readout-pnl
  if (reportInlineExpanded) {
    const pnl = document.getElementById('readout-pnl');
    if (pnl && !pnl.contains(e.target)) {
      reportInlineExpanded = false;
      setHTMLIfChanged(pnl, renderDayReport(engine.state, reportInlineExpanded, reportKidHTML));
    }
  }
  // 2. Collapse Bank if expanded and clicked outside #bank-card
  if (bankExpanded) {
    const bCard = document.getElementById('bank-card');
    if (bCard && !bCard.contains(e.target)) {
      setBankExpanded(false);
    }
  }
});

// Escape key closes modal or collapses open card
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !playingDay) {
    const modalBackdrop = document.getElementById('report-modal-backdrop');
    if (modalBackdrop && modalBackdrop.classList.contains('active')) {
      closeReportModal();
      return;
    }
    if (reportInlineExpanded) {
      reportInlineExpanded = false;
      setHTMLIfChanged(document.getElementById('readout-pnl'), renderDayReport(engine.state, reportInlineExpanded, reportKidHTML));
    }
    if (bankExpanded) {
      setBankExpanded(false);
    }
  }
});

let playingDay = false;
document.getElementById('btn-run-day').onclick = async () => {
  if (playingDay) return;
  playingDay = true;
  let summary = null, look = null;
  try {
    summary = engine.runDay();
    look = checkMagicLooks(summary);
    saveGame();
    await playDayScene(summary, id => sceneLocation(id, engine, kidProfile));
  } finally {
    playingDay = false;   // the page catches up to the new day on the next frame (see loop)
    // The report is filled in and shown the moment the scene closes, in the same frame.
    if (summary) {
      renderReportModal(summary);
      if (summary.houseOpened && !dadModeActive) showHouseNews();
      if (summary.trophyWon && !dadModeActive) showTrophyNews(summary.trophyWon);
      if (look) { showMagicLook(look); refreshKidNew(); }
      showReportModal(true);
    }
    // A day with news (a banner at the top of the report) opens at the top, so focusing the
    // button at the bottom does not scroll the news out of sight.
    const news = !!document.querySelector('#report-modal-content .magic-look');
    document.getElementById('btn-report-modal-continue').focus({ preventScroll: news });
    if (news) document.getElementById('report-modal-dialog').scrollTop = 0;
  }
};

// Buy Supplies Static Click Bindings (Guarantees zero dropped clicks on desktop)
document.getElementById('btn-buy-lemons').onclick = () => engine.buySupplies('lemons', buyPackMult);
document.getElementById('btn-buy-sugar').onclick = () => engine.buySupplies('sugar', buyPackMult);
document.getElementById('btn-buy-ice').onclick = () => engine.buySupplies('ice', buyPackMult);
document.getElementById('btn-buy-cups').onclick = () => engine.buySupplies('cups', buyPackMult);
document.getElementById('btn-buy-bottles').onclick = () => engine.buySupplies('bottles', buyPackMult);

// Recipe Controls
document.getElementById('btn-price-down').onclick = () => {
  engine.state.recipe.pricePerCup = Math.max(0.25, +(engine.state.recipe.pricePerCup - 0.25).toFixed(2));
};
document.getElementById('btn-price-up').onclick = () => {
  engine.state.recipe.pricePerCup = +(engine.state.recipe.pricePerCup + 0.25).toFixed(2);
};
// Lemons and sugar go through the engine so a locked golden recipe cannot change.
document.getElementById('btn-lemons-down').onclick = () => engine.adjustRecipe('lemons', -1);
document.getElementById('btn-lemons-up').onclick = () => engine.adjustRecipe('lemons', 1);
document.getElementById('btn-sugar-down').onclick = () => engine.adjustRecipe('sugar', -1);
document.getElementById('btn-sugar-up').onclick = () => engine.adjustRecipe('sugar', 1);
document.getElementById('btn-ice-down').onclick = () => {
  if (engine.state.flags.autoIceEnabled) engine.state.flags.autoIceEnabled = false;
  engine.state.recipe.icePerCup = Math.max(0, engine.state.recipe.icePerCup - 1);
};
document.getElementById('btn-ice-up').onclick = () => {
  if (engine.state.flags.autoIceEnabled) engine.state.flags.autoIceEnabled = false;
  engine.state.recipe.icePerCup = Math.min(8, engine.state.recipe.icePerCup + 1);
};

// Render loop
let last = performance.now();
let lastSaveAt = last;
function loop(now) {
  const dt = ((now - last) / 1000) * timeScale;
  last = now;

  engine.tick(dt);
  if (now - lastSaveAt >= 1000) { lastSaveAt = now; saveGame(); }

  // Auto-Day ticker if enabled
  if (autoDay && !playingDay) {
    autoDayTimer += dt;
    if (autoDayTimer >= 2.5) { // Run day every 2.5 real seconds (scaled by timeScale)
      autoDayTimer = 0;
      checkMagicLooks(engine.runDay());
    }
  }

  const s = engine.state;

  // Auto-Ice synchronization: when Auto-Ice is enabled, keep recipe.icePerCup
  // immediately synchronized to the current forecast temperature so the morning
  // supply calculator and low-stock alerts reflect the actual ice needed to start the day.
  if (s.flags.hasAutoIce && s.flags.autoIceEnabled) {
    const ideal = engine.computeIdealIce(s.tempF);
    if (s.recipe.icePerCup !== ideal) {
      s.recipe.icePerCup = ideal;
    }
  }
  // The day is worked out when the stand opens, but while it plays the page stays as it was
  // that morning: the cash up top, the shop and anything new change only once the scene
  // ends (Skip, or the day goes by), with the report.
  if (playingDay) {
    requestAnimationFrame(loop);
    return;
  }
  const stageNames = [
    '',
    'Stage 1: Driveway Stand',
    "Stage 2: Friends' Stands",
    'Stage 3: Bottles & Stores',
    'Stage 4: The Invention',
    'Stage 5: Lemonade Factory'
  ];

  // 1. Money Box: cat cash counter, stats chips
  setText(document.getElementById('bank-stage'), stageNames[s.phase]);
  renderSpriteNumber(document.getElementById('bank-cash'), fmtMoney(s.cash));

  const cashNum = s.cash.toNumber();
  document.body.classList.toggle('low-cash', cashNum < 5.0);
  if (prevCashNum !== null) {
    const delta = cashNum - prevCashNum;
    if (Math.abs(delta) >= 0.005) {
      if (delta > 0) catCheerUntil = now + 1400;
      spawnCashFloat(delta);
    }
  }
  prevCashNum = cashNum;

  // The header's cash pill (needs cashNum, so it must come after it)
  setText(document.getElementById('header-cash-num'), fmtDollars(cashNum, true));

  const bankCat = document.getElementById('bank-cat');
  const catMood = now < catCheerUntil ? 4 : baseCatMood(s);
  if (bankCat && bankCat._mood !== catMood) {
    bankCat._mood = catMood;
    Array.from(bankCat.children).forEach((img, i) => img.classList.toggle('on', i === catMood));
    bankCat.classList.toggle('cheer', catMood === 4);
  }

  const qualityNow = engine.computeRecipeQuality();
  setFitText(document.getElementById('bank-units'), fmtCount(s.totalCupsSold));
  setFitText(document.getElementById('bank-revenue'), `$${fmtMoney(s.totalRevenueEarned)}`);
  setText(document.getElementById('bank-rep'), `${(s.reputation * 100).toFixed(0)}%`);
  setText(document.getElementById('bank-quality'), `${(qualityNow * 100).toFixed(0)}%`);
  setText(document.getElementById('bank-quality-avg'), `avg ${((s.avgRecipeQuality || qualityNow) * 100).toFixed(0)}%`);
  const repLit = document.getElementById('bank-rep-lit');
  const repWidth = `${(s.reputation * 100).toFixed(0)}%`;
  if (repLit && repLit._w !== repWidth) {
    repLit.style.width = repWidth;
    repLit._w = repWidth;
  }

  // Update recipe numbers
  document.getElementById('lbl-price').textContent = s.recipe.pricePerCup.toFixed(2);
  document.getElementById('lbl-lemons').textContent = s.recipe.lemonsPerPitcher;
  document.getElementById('lbl-sugar').textContent = s.recipe.sugarPerPitcher;
  document.getElementById('lbl-ice').textContent = s.recipe.icePerCup;

  // Dynamic Visual Pitcher Workbench Updates
  const prof = engine.getRecipeProfile(s.tempF);
  const totalVol = s.recipe.lemonsPerPitcher + s.recipe.sugarPerPitcher + (s.recipe.icePerCup * 0.5);
  // Fill Y line between y=360 (full) and y=760 (low)
  const fillY = Math.max(360, Math.min(760, Math.round(790 - Math.min(14, totalVol) * 28)));

  const liquidRect = document.getElementById('svg-liquid-rect');
  const liquidWave = document.getElementById('svg-liquid-wave');
  const gradStop1 = document.getElementById('grad-stop-1');
  const gradStop2 = document.getElementById('grad-stop-2');

  if (liquidRect) {
    liquidRect.setAttribute('y', fillY);
    liquidRect.setAttribute('height', 870 - fillY);
  }
  if (liquidWave) {
    liquidWave.setAttribute('cy', fillY);
  }
  if (gradStop1 && gradStop2) {
    gradStop1.setAttribute('stop-color', prof.liquidColor);
    gradStop2.setAttribute('stop-color', prof.liquidColor);
  }

  // Update Floating Lemon Wheels (1 to 6)
  const lemonsLayer = document.getElementById('svg-lemons-layer');
  if (lemonsLayer) {
    const numLemons = Math.min(6, Math.max(1, Math.round(s.recipe.lemonsPerPitcher * 0.75)));
    const lemonPositions = [
      { x: 300, y: fillY + 60, s: 155, rot: -15, anim: 'pitcher-bob-1' },
      { x: 460, y: fillY + 120, s: 140, rot: 25, anim: 'pitcher-bob-2' },
      { x: 230, y: fillY + 180, s: 135, rot: 45, anim: 'pitcher-bob-1' },
      { x: 420, y: fillY + 230, s: 145, rot: -30, anim: 'pitcher-bob-2' },
      { x: 320, y: fillY + 310, s: 130, rot: 10, anim: 'pitcher-bob-1' },
      { x: 500, y: fillY + 190, s: 125, rot: -60, anim: 'pitcher-bob-2' }
    ];

    let lemonHTML = '';
    for (let i = 0; i < numLemons; i++) {
      const lp = lemonPositions[i];
      lemonHTML += `<g class="${lp.anim}">
        <image class="pitcher-item" href="./sprites/lemon_wheel.png" x="${lp.x}" y="${lp.y}" width="${lp.s}" height="${lp.s}" style="transform: rotate(${lp.rot}deg);" />
      </g>`;
    }
    setHTMLIfChanged(lemonsLayer, lemonHTML);
  }

  // Update Floating Ice Cubes (0 to 6)
  const iceLayer = document.getElementById('svg-ice-layer');
  if (iceLayer) {
    const numIce = Math.min(6, s.recipe.icePerCup);
    const icePositions = [
      { x: 240, y: fillY - 35, s: 130, rot: -8, anim: 'pitcher-bob-2' },
      { x: 380, y: fillY - 50, s: 140, rot: 15, anim: 'pitcher-bob-1' },
      { x: 510, y: fillY - 40, s: 135, rot: -12, anim: 'pitcher-bob-2' },
      { x: 320, y: fillY + 20, s: 120, rot: 22, anim: 'pitcher-bob-1' },
      { x: 450, y: fillY + 25, s: 115, rot: -18, anim: 'pitcher-bob-2' },
      { x: 215, y: fillY + 15, s: 110, rot: 14, anim: 'pitcher-bob-1' }
    ];

    let iceHTML = '';
    for (let i = 0; i < numIce; i++) {
      const ip = icePositions[i];
      iceHTML += `<g class="${ip.anim}">
        <image class="pitcher-item" href="./sprites/ice_cube_single.png" x="${ip.x}" y="${ip.y}" width="${ip.s}" height="${ip.s}" style="transform: rotate(${ip.rot}deg);" />
      </g>`;
    }
    setHTMLIfChanged(iceLayer, iceHTML);
  }

  // No taste score on screen: the kid finds the golden recipe from what customers said
  // yesterday. Once the neighbors lock it in, the lemon and sugar rows fold away.
  const locked = engine.isRecipeLocked();
  const ratioCard = document.getElementById('ratio-card');
  if (ratioCard && ratioCard.classList.contains('golden-locked') !== locked) {
    ratioCard.classList.toggle('golden-locked', locked);
  }
  const autoIce = !!s.flags.hasAutoIce;
  if (ratioCard && ratioCard.classList.contains('auto-ice') !== autoIce) ratioCard.classList.toggle('auto-ice', autoIce);
  const priceOnly = locked && autoIce;   // nothing left to choose but the price
  if (ratioCard && ratioCard.classList.contains('price-only') !== priceOnly) ratioCard.classList.toggle('price-only', priceOnly);
  // The Stand Captain (a Stage 4 helper) picks the price; with nothing else left to choose,
  // the whole card folds away.
  const captain = !!s.flags.hasStandCaptain;
  if (ratioCard && ratioCard.classList.contains('captain') !== captain) ratioCard.classList.toggle('captain', captain);
  const recipeDone = priceOnly && captain;
  if (ratioCard && ratioCard.classList.contains('helper-done') !== recipeDone) ratioCard.classList.toggle('helper-done', recipeDone);
  setText(document.getElementById('ratio-banner-text'), priceOnly ? 'All set! Just pick a price' : locked ? 'RATIO IS GOLDEN!' : 'RECIPE RATIO');
  const tasteBubble = document.getElementById('recipe-taste-bubble');
  if (tasteBubble) {
    const last = s.lastDaySummary;
    const tasteReview = last && (last.reviews || []).find(r => r.topic === 'taste');
    let say;
    if (!last) say = 'Open the stand to hear what neighbors think!';
    else if (tasteReview) say = `"${tasteReview.quote}"`;
    else say = 'Nobody got to taste it yesterday.';
    setText(document.getElementById('recipe-taste-text'), say);
    const faceImg = document.getElementById('recipe-taste-face');
    const face = tasteReview && tasteReview.face;
    if (faceImg) {
      const want = face ? `./sprites/faces/taste_${face}.png` : '';
      if (faceImg.dataset.face !== (face || '')) {
        faceImg.dataset.face = face || '';
        if (want) faceImg.src = want;
      }
      const display = face ? '' : 'none';
      if (faceImg.style.display !== display) faceImg.style.display = display;
    }
    const mood = tasteReview ? (tasteReview.stars >= 5 ? 'happy' : tasteReview.stars >= 3 ? 'close' : 'off') : 'none';
    if (tasteBubble.dataset.mood !== mood) tasteBubble.dataset.mood = mood;
  }

  // Auto-Ice toggle. The button is static and updated in place: it used to be rebuilt
  // through innerHTML on every frame, so a click rarely landed on the same element twice.
  const autoIceBtn = document.getElementById('btn-autoice');
  if (autoIceBtn) {
    const display = s.flags.hasAutoIce ? '' : 'none';
    if (autoIceBtn.style.display !== display) autoIceBtn.style.display = display;
    autoIceBtn.classList.toggle('on', !!s.flags.autoIceEnabled);
    setText(autoIceBtn, `Auto ice: ${s.flags.autoIceEnabled ? 'ON' : 'OFF'}`);
  }

  // Chore button state (candy button; fills up while the kid rests between chores)
  const choreBtn = document.getElementById('btn-chore');
  const choreFill = document.getElementById('chore-fill');
  const chore = s.currentChore;
  if (chore) {
    const busy = chore.remainingSec > 0;
    choreMaxRemain = busy ? Math.max(choreMaxRemain, chore.remainingSec) : 0;
    if (choreBtn.disabled !== busy) choreBtn.disabled = busy;
    choreBtn.classList.toggle('is-busy', busy);
    setText(document.getElementById('chore-name'), busy ? `Resting... next: ${chore.name}` : chore.name);
    setText(document.getElementById('chore-reward'), busy ? fmtRest(chore.remainingSec) : `+$${chore.reward.toFixed(2)}`);
    if (choreFill) choreFill.style.width = busy ? `${((1 - chore.remainingSec / choreMaxRemain) * 100).toFixed(1)}%` : '0%';
  }

        const choreEmName = document.getElementById('chore-name-em');
  const choreEmReward = document.getElementById('chore-reward-em');
  if (chore && choreEmName && choreEmReward) {
    const busy = chore.remainingSec > 0;
    const btnEm = document.getElementById('btn-chore-emergency');
    if (btnEm.disabled !== busy) btnEm.disabled = busy;
    btnEm.classList.toggle('is-busy', busy);
    setText(choreEmName, busy ? `Resting...` : chore.name);
    setText(choreEmReward, busy ? fmtRest(chore.remainingSec) : `+$${chore.reward.toFixed(2)}`);
    const fillEm = document.getElementById('chore-fill-em');
    if (fillEm) fillEm.style.width = busy && choreMaxRemain > 0 ? `${((1 - chore.remainingSec / choreMaxRemain) * 100).toFixed(1)}%` : '0%';
    setText(document.getElementById('emergency-chore-text'), cashNum < 5 ? 'Low on cash!' : 'Need cash?');
  }

  // 2. Weather & Operations (Kawaii Weather Panel)
  const weatherSun = document.getElementById('weather-sun-sprite');
  const weatherCloudRain = document.getElementById('weather-cloud-rain-wrap');
  const weatherRain = document.getElementById('weather-rain-sprite');
  const weatherConditionLabel = document.getElementById('weather-condition-label');
  const weatherIceHint = document.getElementById('weather-ice-hint');
  const weatherIceHintText = document.getElementById('weather-ice-hint-text');

  const weatherSeasonBadge = document.getElementById('weather-season-badge');
  if (weatherSeasonBadge) {
    const sInfo = engine.getSeasonInfo(s.day);
    setText(weatherSeasonBadge, sInfo.badge);
  }

  if (weatherConditionLabel) {
    const heat = temperatureBand(s.tempF);
    if (weatherConditionLabel.dataset.heat !== heat) weatherConditionLabel.dataset.heat = heat;
    setText(document.getElementById('weather-temperature'), `${s.tempF}\u{B0}F`);
    setText(document.getElementById('weather-condition'), skyCondition(s.weather, s.tempF));
  }
  // Busy-day meter: lit cups = how busy the weather makes today; of those, the share that
  // glow gold = how much of the neighborhood knows the stand (buzz). A brand-new stand
  // has no glowing cups; a famous one has every lit cup glowing.
  const crowdMeter = document.getElementById('weather-crowd-meter');
  if (crowdMeter) {
    const lit = engine.getCrowdLevel();
    const level = String(lit);
    if (crowdMeter.dataset.level !== level) crowdMeter.dataset.level = level;
    const glowing = Math.round(lit * engine.getBuzz());
    crowdMeter.querySelectorAll('img').forEach((img, i) => {
      const on = i < glowing;
      if (img.classList.contains('glow') !== on) img.classList.toggle('glow', on);
    });
  }
  // Ice hint in words instead of a number; it follows the kid's ice setting.
  if (weatherIceHint && weatherIceHintText) {
    const hint = engine.getIceHint();
    setText(weatherIceHintText, hint.text);
    if (weatherIceHint.dataset.mood !== hint.mood) weatherIceHint.dataset.mood = hint.mood;
  }
  if (weatherSun && weatherCloudRain && weatherRain) {
    weatherCloudRain.dataset.sky = skyCondition(s.weather, s.tempF);
    if (s.weather === 'SUNNY') {
      weatherSun.style.display = 'block';
      weatherCloudRain.style.display = 'none';
    } else if (s.weather === 'CLOUDY') {
      weatherSun.style.display = 'none';
      weatherCloudRain.style.display = 'flex';
      weatherRain.style.display = 'none';
    } else { // RAINY
      weatherSun.style.display = 'none';
      weatherCloudRain.style.display = 'flex';
      weatherRain.style.display = weatherCloudRain.dataset.sky === 'SNOWY' ? 'none' : 'block';
    }
  }

  // Mascot Demand Advice & Estimate
  const advice = engine.getKidDemandAdvice();
  const standSubtitle = s.phase >= 2 && Object.values(engine.franchiseStands).some(st => st.hired)
    ? 'Across all stands'
    : 'Driveway stand';

  const mascotPhrase = document.getElementById('mascot-bubble-phrase');
  const mascotSub = document.getElementById('mascot-bubble-sub');

  if (mascotPhrase) mascotPhrase.textContent = advice.phrase;
  if (mascotSub) mascotSub.textContent = standSubtitle;

  // Morning Prep Stock Numbers & Low Stock Alerts. While there is a storage limit the
  // pill shows it ("200/400"); the ice machine's ice just says Auto.
  const stockText = (item) => {
    const cap = engine.storageCap(item);
    const capped = Number.isFinite(cap);
    // The limit just went away (an upgrade): pop a "No limit!" tag on the pill.
    const pill = document.getElementById(`lbl-inv-${item}`);
    if (pill && pill._capped === true && !capped) {
      const row = pill.parentElement;
      row.classList.remove('cap-lifted');
      void row.offsetWidth;          // restart the animation
      row.classList.add('cap-lifted');
      clearTimeout(row._capTimer);
      row._capTimer = setTimeout(() => row.classList.remove('cap-lifted'), 3600);
    }
    if (pill) pill._capped = capped;
    return capped ? `${s.inv[item]}/${cap}` : String(s.inv[item]);
  };
  const invLemons = document.getElementById('lbl-inv-lemons');
  const alertLemons = document.getElementById('alert-lemons');
  if (invLemons) setText(invLemons, stockText('lemons'));
  if (alertLemons) alertLemons.style.display = advice.lowItems.includes('lemons') && !advice.fullItems.includes('lemons') ? 'inline-block' : 'none';

  const invSugar = document.getElementById('lbl-inv-sugar');
  const alertSugar = document.getElementById('alert-sugar');
  if (invSugar) invSugar.textContent = String(s.inv.sugar);
  if (alertSugar) alertSugar.style.display = advice.lowItems.includes('sugar') ? 'inline-block' : 'none';

  const invIce = document.getElementById('lbl-inv-ice');
  const alertIce = document.getElementById('alert-ice');
  if (invIce) setText(invIce, s.flags.hasAutoIce ? 'Auto' : stockText('ice'));
  if (alertIce) alertIce.style.display = advice.lowItems.includes('ice') && !advice.fullItems.includes('ice') ? 'inline-block' : 'none';

  const invCups = document.getElementById('lbl-inv-cups');
  const alertCups = document.getElementById('alert-cups');
  if (invCups) invCups.textContent = String(s.inv.cups);
  if (alertCups) alertCups.style.display = advice.lowItems.includes('cups') ? 'inline-block' : 'none';

  const boxBottles = document.getElementById('box-bottles');
  const invBottles = document.getElementById('lbl-inv-bottles');
  // Bottles take the ice box's place once the machine makes the ice (the grid stays 2x2);
  // without the machine they get a full-width row of their own.
  const bottlesInIceSpot = s.phase >= 3 && s.flags.hasAutoIce;
  const boxIce = document.getElementById('box-ice');
  if (boxIce) boxIce.style.display = bottlesInIceSpot ? 'none' : '';
  if (boxBottles) {
    boxBottles.style.display = s.phase >= 3 ? 'flex' : 'none';
    boxBottles.style.gridColumn = bottlesInIceSpot ? 'auto' : '1 / -1';
    if (bottlesInIceSpot && boxBottles.previousElementSibling !== boxIce) boxIce.after(boxBottles);
  }
  if (invBottles) setText(invBottles, String(s.inv.bottles));
  const alertBottles = document.getElementById('alert-bottles');
  if (alertBottles) alertBottles.style.display = advice.lowItems.includes('bottles') ? 'inline-block' : 'none';

  // Buy buttons sell what fits: a whole pack, the part that still fits (it costs its
  // share), or "Full!" when the bucket or bowl is full. The ice machine makes its own ice.
  // Updated in place (never replaced), so no click is dropped.
  const setBuyBtn = (id, item) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const automatic = item === 'ice' && s.flags.hasAutoIce;
    btn.classList.toggle('is-automatic', automatic);
    if (automatic) {
      setText(btn, 'Automatic!');
      if (!btn.disabled) btn.disabled = true;
      return;
    }
    const o = engine.buyOffer(item, buyPackMult);
    setText(btn, o.full ? 'Full!' : `+${o.qty} ($${o.cost.toFixed(2)})`);
    const off = o.full || s.cash.lt(o.cost);
    if (btn.disabled !== off) btn.disabled = off;
  };
  setBuyBtn('btn-buy-lemons', 'lemons');
  setBuyBtn('btn-buy-sugar', 'sugar');
  setBuyBtn('btn-buy-ice', 'ice');
  setBuyBtn('btn-buy-cups', 'cups');
  const btnB = document.getElementById('btn-buy-bottles');
  if (btnB) {
    btnB.style.display = s.phase >= 3 ? 'flex' : 'none';
    if (s.phase >= 3) setBuyBtn('btn-buy-bottles', 'bottles');
  }

  // The Supply Truck (a Stage 4 helper) shops every morning: the supply tiles fold away and
  // one tile says what it brought (engine.runHelpers already bought it).
  const prepCard = document.querySelector('.prep-stand-card');
  const truck = !!s.flags.hasSupplyTruck;
  if (prepCard.classList.contains('has-truck') !== truck) prepCard.classList.toggle('has-truck', truck);
  const truckBox = document.getElementById('prep-truck');
  if (truckBox.hidden === truck) truckBox.hidden = !truck;
  if (truck) {
    const spent = Object.values(engine.ledger.supplies).reduce((a, b) => a + b, 0);
    setText(document.getElementById('prep-truck-sub'), !advice.isFullyStocked
      ? "Not enough money for all of today's supplies!"
      : spent > 0.004 ? `It brought everything for today: $${fmtDollars(spent, true)}` : 'Everything for today is here.');
    setHTMLIfChanged(document.getElementById('prep-truck-stock'), ['lemons', 'sugar', 'cups'].concat(s.phase >= 3 ? ['bottles'] : [])
      .map(item => `<span class="prep-truck-chip"><img src="./sprites/${SUPPLY_PICS[item]}.png" alt="${item}" />${fmtWhole(s.inv[item])}</span>`).join(''));
  }

  // "?" and a worried sun (no sparkles) when the forecast says something will run out today.
  const stocked = engine.getKidDemandAdvice().isFullyStocked;
  const runDayLabel = `OPEN FOR BUSINESS${stocked ? '!' : '?'} (Day ${s.day})`;
  const runDayBtn = document.getElementById('btn-run-day');
  if (runDayBtn && runDayBtn.classList.contains('short-stock') === stocked) {
    runDayBtn.classList.toggle('short-stock', !stocked);
    const sun = runDayBtn.querySelector('.btn-sun');
    if (sun) sun.src = `./sprites/morning_prep/${stocked ? 'sun_happy' : 'sun_worried'}.png`;
  }
  const runDayTxt = document.getElementById('btn-run-day-text');
  if (runDayTxt) {
    setText(runDayTxt, runDayLabel);
  } else {
    setText(document.getElementById('btn-run-day'), runDayLabel);
  }

  if (dadModeActive) renderDadPanel(engine, storeUnlockMessage);

  // 3. Day Report (re-rendered only when the summary changes, i.e. once per day)
  setHTMLIfChanged(document.getElementById('readout-pnl'), renderDayReport(s, reportInlineExpanded, reportKidHTML));

  // The kid beside the cash pill: there from Day 1, with a face for how yesterday went.
  // Nobody has touched the game for a while: the kid dozes off until the next tap.
  const dHead = s.lastDaySummary;
  setKidImg(document.getElementById('header-kid-img'), kidDozing() ? 'sleepy'
    : dHead ? kidMoodFor(dHead) : (Date.now() < kidFlashUntil ? kidFlashMood : 'happy'), true);

  renderStandShop(s);
  renderFlavorLab(s);
  renderFriends(s);
  renderMoneyBag(s);
  renderHouse(s);
  renderShelf(s);
  if (document.body.dataset.wallpaper !== s.wallpaper) document.body.dataset.wallpaper = s.wallpaper;

  // The ending plays once, the moment Citrus Cay is bought (or on the next visit if the page
  // closed first).
  if (s.gameWon && !s.endingSeen && document.getElementById('ending-scene').hidden) showEnding();

  requestAnimationFrame(loop);
}

function renderStandShop(s) {
  const card = document.getElementById('stand-shop');
  if (!card) return;
  const next = kidShopNext(engine, s);
  if (card.hidden === !!next) card.hidden = !next;
  if (!next) { card._item = null; return; }
  const { item, p, choices } = next;
  const key = choices ? choices.map(c => c.item.id).join('+') : item.id;
  if (card._item !== key) {
    card._item = key;
    card.classList.toggle('choosing', !!choices);
    setHTMLIfChanged(document.getElementById('stand-shop-choice'), choices ? shopChoiceHTML(choices) : '');
    const pic = document.getElementById('stand-shop-pic');
    pic.hidden = !item.pic;
    if (item.pic) pic.src = item.pic;
    card.style.animation = 'none';
    void card.offsetWidth;      // replay the pop-in for the new item
    card.style.animation = '';
  }
  // Only spare money counts: what is left after today's supplies are paid for. Buying an
  // upgrade with the lemon money left kids stuck doing chores just to reopen the stand.
  const need = engine.restockCostForToday();
  const spare = Math.max(0, s.cash.toNumber() - need);
  if (choices) { renderShopChoice(choices, spare, need); return; }
  setText(document.getElementById('stand-shop-name'), p.name);
  setText(document.getElementById('stand-shop-desc'), p.desc);
  const cost = p.costCash;
  const short = spare < cost;
  // Enough money but not open yet (the second stand also wants a tasty recipe).
  const notYet = !short && !p.unlocked(s);
  const save = document.getElementById('stand-shop-save');
  const showSave = short || notYet;
  if (save.hidden === showSave) save.hidden = !showSave;
  if (showSave) {
    document.getElementById('stand-shop-fill').style.width = `${notYet ? 100 : Math.min(100, (spare / cost) * 100).toFixed(1)}%`;
    const bottlesPending = item.id === 'patent_filing' && !p.unlocked(s);
    setText(document.getElementById('stand-shop-save-text'), bottlesPending && short
      ? `${item.notYet(s)} | $${Math.floor(spare).toLocaleString('en-US')}/$${cost.toLocaleString('en-US')}`
      : notYet ? (item.notYet ? item.notYet(s) : 'Not open yet!')
      // The big dreams' numbers are long: the bar alone says "saving up".
      : `${cost >= 1e8 ? '' : 'Saving up: '}$${Math.floor(spare).toLocaleString('en-US')} of $${cost.toLocaleString('en-US')}${need > 0 && cost < 1e8 ? ' after supplies' : ''}`);
  }
  const btn = document.getElementById('btn-stand-shop-buy');
  btn.dataset.id = item.id;
  if (btn.disabled !== showSave) btn.disabled = showSave;
  setText(btn, `$${cost.toLocaleString('en-US')}`);
}
// The first choice: two tiles side by side with an OR between them, each tile a button with
// its price, over one savings bar (they cost the same). Kept short so the page still fits
// the kids' screen without scrolling. Built once; renderShopChoice keeps the money current.
function shopChoiceHTML(choices) {
  return `<div class="stand-shop-ask">Pick one!</div>
    <div class="stand-shop-options">${choices.map(({ item, p }) => `<button type="button" class="stand-shop-option" data-id="${item.id}">
      <img class="stand-shop-option-pic" src="${item.pic}" alt="" />
      <span class="stand-shop-option-name">${p.name}</span>
      <span class="stand-shop-option-desc">${item.pick}</span>
      <span class="stand-shop-option-price"></span>
    </button>`).join('<span class="stand-shop-or" aria-hidden="true">OR</span>')}</div>
    <div class="stand-shop-save"><div class="stand-shop-bar" hidden><span></span></div><span class="stand-shop-choice-text"></span></div>`;
}
function renderShopChoice(choices, spare, need) {
  const box = document.getElementById('stand-shop-choice');
  const cost = Math.min(...choices.map(c => c.p.costCash));
  const short = spare < cost;
  const bar = box.querySelector('.stand-shop-bar');
  if (bar.hidden === short) bar.hidden = !short;
  if (short) bar.firstElementChild.style.width = `${Math.min(100, (spare / cost) * 100).toFixed(1)}%`;
  setText(box.querySelector('.stand-shop-choice-text'), short
    ? `Saving up: $${Math.floor(spare)} of $${cost}${need > 0 ? ' after supplies' : ''}`
    : 'Tap the one you want first. The other one comes next!');
  for (const btn of box.querySelectorAll('.stand-shop-option')) {
    const c = choices.find(x => x.item.id === btn.dataset.id);
    const off = spare < c.p.costCash;
    if (btn.disabled !== off) btn.disabled = off;
    setText(btn.querySelector('.stand-shop-option-price'), `$${c.p.costCash}`);
  }
}
function buyShopItem(id) {
  const item = KID_SHOP.find(x => x.id === id);
  const p = engine.projects.find(x => x.id === id);
  if (!item || !p || engine.state.cash.toNumber() - engine.restockCostForToday() < p.costCash) return;
  if (engine.buyProject(id)) kidFlash(item.cheer ? 'cheer' : 'determined', 2500);   // new gear: let's do this
}
document.getElementById('btn-stand-shop-buy').onclick = (e) => buyShopItem(e.currentTarget.dataset.id);
document.getElementById('stand-shop-choice').addEventListener('click', (e) => {
  const btn = e.target.closest('.stand-shop-option');
  if (btn && !btn.disabled) buyShopItem(btn.dataset.id);
});

// The Flavor Lab (Stage 5, src/data/flavors.ts): the new flavor's fruit and sugar, a glass of
// it, the flavors in stores so far, and what the taste testers said last time.
function renderFlavorLab(s) {
  const card = document.getElementById('flavor-lab');
  const flavor = engine.currentFlavor();
  if (card.hidden === !!flavor) card.hidden = !flavor;
  if (!flavor) return;
  const mix = s.flavorMix;
  if (card.dataset.flavor !== flavor.id) {
    card.dataset.flavor = flavor.id;
    card.style.setProperty('--drink', flavor.color);
    setText(document.getElementById('flavor-lab-name'), flavor.name);
    const icon = document.getElementById('flavor-fruit-icon');
    icon.src = fruitPic(flavor);
    icon.alt = flavor.fruit;
    card.querySelectorAll('.flavor-glass-fruit').forEach(img => { img.src = fruitPic(flavor); });
  }
  setText(document.getElementById('lbl-fruit'), String(mix.fruit));
  setText(document.getElementById('lbl-fsugar'), String(mix.sugar));
  const fill = `${Math.round(30 + Math.min(1, (mix.fruit + mix.sugar) / 12) * 60)}%`;
  if (card.style.getPropertyValue('--fill') !== fill) card.style.setProperty('--fill', fill);
  const done = s.flavorsLaunched.length;
  setHTMLIfChanged(document.getElementById('flavor-lab-progress'), FLAVORS.map((f, i) =>
    `<span class="dot${i < done ? ' on' : ''}" style="${i < done ? `background:${f.color}` : ''}" title="${f.name}"></span>`).join('') +
    `<span class="label">${done} of ${FLAVORS.length} in stores</span>`);
  // Yesterday's tasting of this flavor (a new flavor has not been tasted yet).
  const last = s.lastDaySummary && s.lastDaySummary.flavorTaste;
  const tasted = last && last.id === flavor.id ? last.review : null;
  const bubble = document.getElementById('flavor-lab-bubble');
  const mood = tasted ? (tasted.stars >= 5 ? 'happy' : tasted.stars >= 3 ? 'close' : 'off') : 'none';
  if (bubble.dataset.mood !== mood) bubble.dataset.mood = mood;
  const face = document.getElementById('flavor-lab-face');
  const faceSrc = tasted && tasted.face ? `./sprites/faces/taste_${tasted.face}.png` : '';
  if (face.dataset.src !== faceSrc) { face.dataset.src = faceSrc; if (faceSrc) face.src = faceSrc; face.style.display = faceSrc ? '' : 'none'; }
  setText(document.getElementById('flavor-lab-say'), tasted ? `"${tasted.quote}"`
    : 'Pick the fruit and sugar. The taste testers try it when you open!');
}
const flavorStep = (item, delta) => () => engine.adjustFlavor(item, delta);
document.getElementById('btn-fruit-down').onclick = flavorStep('fruit', -1);
document.getElementById('btn-fruit-up').onclick = flavorStep('fruit', 1);
document.getElementById('btn-fsugar-down').onclick = flavorStep('sugar', -1);
document.getElementById('btn-fsugar-up').onclick = flavorStep('sugar', 1);

function renderHouse(s) {
  const col = document.getElementById('house-col');
  const show = s.houseOpen;
  if (col.hidden === show) col.hidden = !show;
  document.body.classList.toggle('has-house', show);
  if (!show) return;
  const level = s.houseLevel;
  const next = engine.nextHouseStep();
  const yard = engine.nextYardStep();
  // Like the Stand Shop, only money left after today's supplies counts.
  const spare = Math.max(0, s.cash.toNumber() - engine.restockCostForToday());
  let nextHTML;
  if (yard) {
    nextHTML = yardNextHTML(yard, spare);
  } else if (!next) {
    nextHTML = '<div class="house-later">All done! The house is paid off and the yard is full of fun!</div>';
  } else if (s.phase < next.phase) {
    nextHTML = `<div class="house-next-name">Next: ${next.name}</div><div class="house-later">Opens when your business grows!</div>`;
  } else {
    const short = Math.max(0, next.cost - spare);
    nextHTML = `<div class="house-next-name">${next.name}</div><div class="house-next-desc">${next.desc}</div>
      <button type="button" class="stand-shop-buy" data-act="house-buy"${short ? ' disabled' : ''}>$${fmtWhole(next.cost)}</button>
      ${short ? `<div class="house-save"><span class="stand-shop-bar"><span style="width:${Math.min(100, (spare / next.cost) * 100).toFixed(1)}%"></span></span>Save $${fmtWhole(Math.ceil(short))} more</div>` : ''}`;
  }
  // Once the house is paid off, the yard's grass takes the house steps' dots' place.
  const progress = next
    ? `<div class="house-dots" aria-label="${level} of ${HOUSE_STEPS.length} house upgrades">${HOUSE_STEPS.map((_, i) => `<span${i < level ? ' class="on"' : ''}></span>`).join('')}</div>`
    : yardStripHTML(s);
  setHTMLIfChanged(document.getElementById('house-card'), `<div class="house-title">My House</div>
    <div class="house-pic">${housePicHTML(level, s.houseColor)}</div>
    ${progress}
    ${level >= 1 ? `<div class="house-swatches" role="group" aria-label="House color">${HOUSE_COLORS.map(c =>
      `<button type="button" class="house-swatch" data-act="house-color" data-id="${c.id}" style="--swatch:${c.hex}" aria-label="${c.name}" aria-pressed="${c.id === s.houseColor}"></button>`).join('')}</div>` : ''}
    <div class="house-next">${nextHTML}</div>`);
}
// The day My House opens (on a quiet day, src/data/house.ts), the Day Report says so at the
// top, and the house card glows until the kid touches it.
function showHouseNews() {
  const content = document.getElementById('report-modal-content');
  if (!content) return;
  content.insertAdjacentHTML('afterbegin',
    `<div class="magic-look house-news"><div class="house-news-pic">${housePicHTML(engine.state.houseLevel, engine.state.houseColor)}</div>` +
    `<div class="magic-look-text"><b>Big news!</b><span>Your lemonade money can fix up your house now!</span></div>` +
    `<button type="button" class="magic-look-try" id="btn-house-news">Let's see!</button></div>`);
  document.getElementById('house-card').classList.add('is-new');
  document.getElementById('btn-house-news').onclick = (e) => {
    e.stopPropagation();
    closeReportModal();
    document.getElementById('house-col').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
}
// The day a money trophy is won (src/data/trophies.ts), the Day Report says so at the top;
// the button opens the shelf with the new trophy picked (and a wallpaper it brought glowing).
function showTrophyNews(id) {
  const content = document.getElementById('report-modal-content');
  const t = TROPHIES.find(x => x.id === id);
  if (!content || !t) return;
  const wall = t.wallpaper ? ` And a new ${WALLPAPERS.find(w => w.id === t.wallpaper).name} wallpaper!` : '';
  content.insertAdjacentHTML('afterbegin',
    `<div class="magic-look trophy-news"><div class="trophy-news-pic"><img src="${trophyPic(id)}" alt="" /></div>` +
    `<div class="magic-look-text"><b>${t.name}!</b><span>You sold $${fmtWhole(t.sales)} since Day 1!${wall}</span></div>` +
    `<button type="button" class="magic-look-try" id="btn-trophy-news">See it!</button></div>`);
  document.getElementById('btn-trophy-news').onclick = (e) => {
    e.stopPropagation();
    closeReportModal();
    openShelfRoom({ trophy: TROPHIES.indexOf(t), wallpaper: t.wallpaper });
  };
}
// The build scene: the old house shakes in a cloud of dust, the new one pops in, confetti.
function playHouseScene(level) {
  const scene = document.getElementById('house-scene');
  const colors = ['#facc15', '#f472b6', '#a78bfa', '#34d399', '#60a5fa'];
  const confetti = Array.from({ length: 16 }, (_, i) =>
    `<span class="house-confetti" style="left:${4 + i * 6}%;background:${colors[i % colors.length]};animation-delay:${(1.2 + ((i * 7) % 10) * 0.06).toFixed(2)}s"></span>`).join('');
  const dust = [[-4, 50], [33, 58], [70, 50]].map(([x, y], i) =>
    `<span class="house-dust" style="left:${x}%;top:${y}%;animation-delay:${(0.2 + i * 0.2).toFixed(1)}s"></span>`).join('');
  scene.innerHTML = `<div class="house-scene-card">
    <div class="house-scene-stage">
      <div class="house-scene-old">${housePicHTML(level - 1, engine.state.houseColor)}</div>
      <div class="house-scene-new">${housePicHTML(level, engine.state.houseColor)}</div>
      ${dust}
    </div>
    ${confetti}
    <div class="house-scene-title" id="house-scene-title">${HOUSE_STEPS[level - 1].name}!</div>
    <button type="button" class="stand-shop-buy" data-act="house-scene-close">Yay!</button>
  </div>`;
  scene.hidden = false;
  scene.querySelector('[data-act="house-scene-close"]').focus({ preventScroll: true });
}
document.getElementById('house-scene').addEventListener('click', (e) => {
  // Tap anywhere once the button shows (the scene is short; an early tap skips it).
  e.currentTarget.hidden = true;
  e.currentTarget.innerHTML = '';
});
// A yard thing (src/data/yard.ts) arrives: it pops onto the grass, with confetti.
function playYardScene(thing) {
  const scene = document.getElementById('house-scene');
  scene.innerHTML = yardSceneHTML(thing);
  scene.hidden = false;
  scene.querySelector('[data-act="house-scene-close"]').focus({ preventScroll: true });
}
document.getElementById('house-col').addEventListener('click', (e) => {
  document.getElementById('house-card').classList.remove('is-new');
  const swatch = e.target.closest('[data-act="house-color"]');
  if (swatch) { engine.setHouseColor(swatch.dataset.id); return; }
  if (e.target.closest('[data-act="shelf-open"]')) { openShelfRoom(); return; }
  const yardBtn = e.target.closest('[data-act="yard-buy"]');
  if (yardBtn) {
    const step = engine.nextYardStep();
    const thing = step?.things.find(t => t.id === yardBtn.dataset.id);
    if (yardBtn.disabled || !thing || engine.state.cash.toNumber() - engine.restockCostForToday() < step.cost) return;
    if (engine.buyYardThing(thing.id)) {
      kidFlash('cheer', 3500);
      playYardScene(thing);
    }
    return;
  }
  const btn = e.target.closest('[data-act="house-buy"]');
  if (!btn || btn.disabled) return;
  const next = engine.nextHouseStep();
  if (!next || engine.state.cash.toNumber() - engine.restockCostForToday() < next.cost) return;
  if (engine.buyHouseStep()) {
    kidFlash('cheer', 3500);
    playHouseScene(engine.state.houseLevel);
  }
});

// My Shelf (src/ui/shelf.js): the card under My House once something is bought or won, and
// the whole shelf (the shelf room) when it is tapped. Tapping a thing or a trophy there says
// what it is and gives it a little wiggle; tapping a wallpaper puts it up behind the page.
let shelfList = [];
let trophyList = [];
function renderShelf(s) {
  shelfList = shelfItems(engine);
  trophyList = shelfTrophies(engine);
  const card = document.getElementById('shelf-card');
  const show = s.houseOpen && (shelfList.length > 0 || s.trophyDays.length > 0);
  if (card.hidden === show) card.hidden = !show;
  if (show) setHTMLIfChanged(card, shelfCardHTML(shelfList, trophyList, s.day));
}
const shelfRoom = document.getElementById('shelf-room');
// pick: { trophy: index to show (the Day Report's trophy news), wallpaper: one to make glow }.
function openShelfRoom(pick = {}) {
  shelfRoom.innerHTML = shelfRoomHTML(shelfList, trophyList, engine.wallpapersOpen(), engine.state.wallpaper, pick.wallpaper);
  shelfRoom.hidden = false;
  shelfRoom.querySelector('[data-act="shelf-close"]').focus({ preventScroll: true });
  if (pick.trophy != null) pickShelfThing(shelfRoom.querySelector(`[data-trophy="${pick.trophy}"]`));
}
function closeShelfRoom() {
  if (shelfRoom.hidden) return;
  shelfRoom.hidden = true;
  shelfRoom.innerHTML = '';
  document.querySelector('[data-act="shelf-open"]')?.focus({ preventScroll: true });
}
function pickShelfThing(item) {
  const caption = item.dataset.trophy != null ? trophyCaptionHTML(trophyList[+item.dataset.trophy]) : shelfCaptionHTML(shelfList[+item.dataset.i]);
  shelfRoom.querySelector('.shelf-room-caption').innerHTML = caption;
  shelfRoom.querySelector('.shelf-room-item.picked')?.classList.remove('picked');
  void item.offsetWidth;   // restart the wiggle on a second tap
  item.classList.add('picked');
}
shelfRoom.addEventListener('click', (e) => {
  const item = e.target.closest('.shelf-room-item');
  if (item) { pickShelfThing(item); return; }
  const wall = e.target.closest('.shelf-wallpaper');
  if (wall) {
    if (engine.setWallpaper(wall.dataset.wallpaper)) {
      for (const b of shelfRoom.querySelectorAll('.shelf-wallpaper')) b.setAttribute('aria-pressed', String(b === wall));
      wall.classList.remove('is-new');
      document.body.dataset.wallpaper = engine.state.wallpaper;
    }
    return;
  }
  // Done, or a tap outside the card.
  if (e.target.closest('[data-act="shelf-close"]') || e.target === shelfRoom) closeShelfRoom();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeShelfRoom(); });

// Not hired: "Hire $45". Hired: "Working" with today's forecast and pay; tapping gives
// the friend the day off (no sales, no pay), and tapping again calls them back in.
// Stage 3 adds a Stores tab: sign a store up once, then it buys bottles every day.
// Stage 4 adds an Invention tab: the patented lemon squeezer that stores sell for you.
let partnersTab = 'friends';
let partnersPhase = null;     // the stage the tabs last saw (a new stage opens its tab)
// The button for each squeezer step after the first (SQUEEZER_LEVELS), with its picture.
const SQUEEZER_BUTTONS = {
  2: { label: 'Put It on TV', pic: null },
  3: { label: 'Sell in Every State', pic: null },
  4: { label: 'Sell It Worldwide', pic: INVENTION.worldPic },
};
// The next squeezer step to buy, and what is still missing: squeezers sold, a day's wait
// after the last purchase, and money left over after today's supplies.
function squeezerOffer(s) {
  const step = SQUEEZER_LEVELS[engine.patent.level];
  if (!engine.patent.licensed || !step) return null;
  const project = engine.projects.find(p => p.id === step.project);
  if (!project || project.purchased) return null;
  const sales = Math.max(0, step.salesRequired - s.totalSqueezersSold);
  const days = shopDaysRemaining(s);
  const short = Math.max(0, project.costCash - Math.max(0, s.cash.toNumber() - engine.restockCostForToday()));
  return { step, project, sales, days, short };
}
function inventionHTML(s) {
  const p = engine.patent;
  const each = `$${p.royaltyPerUnit.toFixed(2)}`;
  const d = s.lastDaySummary;
  const stats = [`About ${Math.round(p.baseUnitsPerDay).toLocaleString('en-US')} sold a day`, `${s.totalSqueezersSold.toLocaleString('en-US')} sold in all`];
  if (d && d.patentUnitsSold > 0) stats.push(`Yesterday: ${d.patentUnitsSold.toLocaleString('en-US')} sold, +$${fmtDollars(d.patentRoyalties, true)}`);
  const offer = squeezerOffer(s);
  let upgrade = '';
  if (offer) {
    const btn = SQUEEZER_BUTTONS[offer.step.level];
    const needs = [];
    if (offer.sales) needs.push(`Sell ${offer.sales.toLocaleString('en-US')} more squeezer${offer.sales === 1 ? '' : 's'}`);
    if (offer.days) needs.push(`Finish ${offer.days} more day${offer.days === 1 ? '' : 's'}`);
    if (offer.short) needs.push(`Save $${fmtDollars(offer.short, true)} more after supplies`);
    upgrade = `<button type="button" class="friend-btn" data-act="license"${needs.length ? ' disabled aria-describedby="license-needs"' : ''}>${needs.length ? STORE_LOCK : ''}${btn.pic ? `<img class="license-pic" src="${btn.pic}" alt="" />` : ''}${btn.label} &middot; $${fmtWhole(offer.project.costCash)}</button>
      <small>Then about ${offer.step.unitsPerDay.toLocaleString('en-US')} sold a day at $${offer.step.royaltyPerUnit.toFixed(2)} each</small>
      ${needs.length ? `<small id="license-needs">${needs.join(' &middot; ')}</small>` : ''}`;
  }
  return `<div class="invention-panel">
    <img src="${p.level >= SQUEEZER_LEVELS.length ? INVENTION.worldPic : INVENTION.pic}" alt="" />
    <div>
      <div class="invention-name">My ${INVENTION.name}</div>
      <div class="invention-desc">Level ${p.level} &middot; ${SQUEEZER_LEVELS[p.level - 1].name} &middot; ${each} per sale</div>
      <div class="invention-stats">${stats.map(t => `<span>${t}</span>`).join('')}</div>
      ${upgrade}
    </div>
  </div>`;
}
// The famous brand (Stage 5, src/data/brand.ts): the bonus so far, a dot per move, and the
// next move with what is still missing (a day's wait, money left after today's supplies).
function brandHTML(s) {
  const pct = Math.round((engine.brandMultiplier() - 1) * 100);
  const dots = BRAND_STEPS.map((_, i) => `<span${i < s.brandLevel ? ' class="on"' : ''}></span>`).join('');
  const next = engine.nextBrandStep();
  let move;
  if (next) {
    const needs = [];
    if (engine.brandWaitDays()) needs.push('Ready tomorrow!');
    const short = Math.max(0, next.cost - Math.max(0, s.cash.toNumber() - engine.restockCostForToday()));
    if (short) needs.push(`Save $${fmtWhole(Math.ceil(short))} more`);
    move = `<button type="button" class="friend-btn" data-act="brand"${needs.length ? ' disabled' : ''}>${needs.length ? STORE_LOCK : ''}${next.name} &middot; $${fmtWhole(next.cost)}</button>
      <small>${next.desc} Then everything sells ${Math.round(next.bonus * 100)}% more.</small>
      ${needs.length ? `<small>${needs.join(' &middot; ')}</small>` : ''}`;
  } else {
    move = '<small>Your lemonade is the most famous in the whole world!</small>';
  }
  // The picture: the next move, or the last one once they are all done.
  const pic = brandPic((next ?? BRAND_STEPS[BRAND_STEPS.length - 1]).id);
  return `<div class="invention-panel">
    <img src="${pic}" alt="" />
    <div>
      <div class="invention-name">My Famous Brand</div>
      <div class="invention-desc">Brand bonus: +${pct}% on everything you sell</div>
      <div class="brand-dots" aria-label="${s.brandLevel} of ${BRAND_STEPS.length} brand moves">${dots}</div>
      ${move}
    </div>
  </div>`;
}
// One line of a friend or store button. It never wraps: a wrap would make that button taller
// and shift the whole row. A line too long for the button shrinks to fit instead (.tile-line
// in game.css, from its character count).
function tileLine(html, tag = 'span') {
  const chars = html.replace(/<[^>]*>/g, '').replace(/&[#\w]+;/g, 'x').length;
  return `<${tag} class="tile-line" style="--chars:${chars}">${html}</${tag}>`;
}
function expansionMessage(goal, unit) {
  if (goal.remaining) return `Sell ${goal.remaining.toLocaleString('en-US')} ${unit}`;
  if (goal.days) return goal.days === 1 ? 'Ready tomorrow!' : `Ready in ${goal.days} days`;
  return '';
}
function storeUnlockMessage() {
  const { remaining, days } = engine.storeExpansionGoal();
  const steps = [];
  if (remaining) steps.push(`sell ${remaining} more bottle${remaining === 1 ? '' : 's'}`);
  if (days) steps.push(`finish ${days} more day${days === 1 ? '' : 's'}`);
  return steps.length ? `To unlock your next store purchase, ${steps.join(' and ')}.` : '';
}
function storesHTML(s) {
  const accounts = Object.values(engine.wholesaleAccounts);
  const wait = storeUnlockMessage();
  const hint = wait && accounts.some(acc => !acc.active || acc.level < acc.levels.length)
    ? `<p class="store-unlock-hint" id="store-unlock-hint">${wait}</p>` : '';
  const est = engine.getDailyDemandEstimate().storeEstimates;
  return hint + accounts.map(acc => {
    const pic = STORE_PICS[acc.id] || './sprites/shop/bottles.png';
    const cls = acc.active ? 'working' : 'open';
    const next = acc.levels[acc.level];
    let btn;
    if (acc.active && !next) {
      const n = (est.find(x => x.id === acc.id) || { estBottles: 0 }).estBottles;
      btn = `<div class="store-status">${tileLine('Biggest shelf!')}${tileLine(`~${n} bottles today`, 'small')}</div>`;
    } else {
      const cost = acc.active ? next.cost : acc.setupCost;
      const state = wait ? ' disabled aria-describedby="store-unlock-hint"' : s.cash.lt(cost) ? ' disabled' : '';
      const orders = acc.active ? `${acc.bottlesPerDay} &rarr; ${next.bottlesPerDay}/day` : `~ ${acc.bottlesPerDay} bottles/day`;
      btn = `<button type="button" class="friend-btn" data-act="${acc.active ? 'expand' : 'sign'}" data-id="${acc.id}"${state}>${tileLine(`${wait ? STORE_LOCK : ''}${acc.active ? 'Shelf' : 'Sign up'} $${cost}`)}${tileLine(orders, 'small')}</button>`;
    }
    return `<div class="friend-tile ${cls}">
      <div class="friend-pic"><img class="store-pic" src="${pic}" alt="" /></div>
      <div class="friend-name">${acc.name}</div>
      <div class="friend-where">${acc.active ? `Lv ${acc.level}/3 | $${acc.wholesalePrice.toFixed(2)} each` : `pays $${acc.wholesalePrice.toFixed(2)} a bottle`}</div>
      ${btn}
    </div>`;
  }).join('');
}
function renderFriends(s) {
  const card = document.getElementById('friends-card');
  const show = s.phase >= 2;
  if (card.hidden === show) card.hidden = !show;
  if (!show) return;
  const tabs = s.phase >= 3;
  const tabsEl = document.getElementById('friends-tabs');
  if (tabsEl.hidden === tabs) tabsEl.hidden = !tabs;
  const title = document.getElementById('friends-title');
  if (title.hidden !== tabs) title.hidden = tabs;
  // The newest tab opens by itself when a stage starts (and after a load); a tab the
  // game has not reached falls back to the newest one.
  // A tab whose daily jobs a helper took over goes away (the Stand Captain: friends; the
  // Delivery Route: stores).
  const avail = [].concat(s.flags.hasStandCaptain ? [] : ['friends'], s.phase >= 3 && !s.flags.hasDeliveryRoute ? ['stores'] : [],
    s.phase >= 4 ? ['invention'] : [], s.phase >= 5 ? ['factory'] : [], engine.brandOpen() ? ['brand'] : []);
  if (partnersPhase !== s.phase) {
    if (partnersPhase === null || s.phase > partnersPhase) partnersTab = avail[avail.length - 1];
    partnersPhase = s.phase;
  }
  if (!avail.includes(partnersTab)) partnersTab = avail[avail.length - 1];
  const tab = tabs ? partnersTab : 'friends';
  tabsEl.querySelectorAll('.friends-tab').forEach(b => {
    const on = b.dataset.tab === tab;
    if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
    const hide = !avail.includes(b.dataset.tab);
    if (b.hidden !== hide) b.hidden = hide;
    // The Brand tab opens in the middle of Stage 5: it glows until the first brand move.
    const glow = b.dataset.tab === 'brand' && !on && s.brandLevel === 0;
    if (b.classList.contains('is-new') !== glow) b.classList.toggle('is-new', glow);
  });
  if (tab === 'brand') {
    setHTMLIfChanged(document.getElementById('friends-row'), brandHTML(s));
    return;
  }
  if (tab === 'stores') {
    setHTMLIfChanged(document.getElementById('friends-row'), storesHTML(s));
    return;
  }
  if (tab === 'invention') {
    setHTMLIfChanged(document.getElementById('friends-row'), inventionHTML(s));
    return;
  }
  if (tab === 'factory') {
    const factory = engine.copacker;
    const d = s.lastDaySummary;
    const yesterday = d && d.copackerCasesSold > 0
      ? `<span>Yesterday: ${d.copackerCasesSold.toLocaleString('en-US')} cases, +$${fmtDollars(d.copackerNet, true)}</span>` : '';
    const flavors = s.flags.hasFlavorLab
      ? `<span>Flavors in stores: ${s.flavorsLaunched.length} of ${FLAVORS.length} (+${Math.round(s.flavorsLaunched.length * FLAVOR_BOOST * 100)}% cases)</span>` : '';
    setHTMLIfChanged(document.getElementById('friends-row'), `<div class="invention-panel">
      <img src="./sprites/shop/lemonade_factory.png" alt="" />
      <div><div class="invention-name">My Lemonade Factory</div>
      <div class="invention-desc">The factory uses its own supplies to make and ship your lemonade.</div>
      <div class="invention-stats"><span>About ${Math.round(factory.casesPerDay * engine.flavorMult()).toLocaleString('en-US')} cases a day</span><span>$${fmtDollars(factory.netPerCase, true)} per case after factory costs</span>${flavors}${yesterday}</div>
      <small>Look in the Stand Shop to grow your factory!</small></div></div>`);
    return;
  }
  const est = engine.getDailyDemandEstimate().franchiseEstimates;
  const wait = expansionMessage(engine.friendExpansionGoal(), 'cups');
  const html = Object.values(engine.franchiseStands).map(st => {
    const f = FRIENDS[st.id] || { pic: 'elm' };
    let cls, mood, btn;
    if (!st.hired) {
      cls = 'open'; mood = 'wink';
      btn = `<button type="button" class="friend-btn" data-act="hire" data-id="${st.id}"${wait || s.cash.lt(st.setupCost) ? ' disabled' : ''}>${tileLine(wait || `Hire $${st.setupCost}`)}${tileLine(wait ? `Hire $${st.setupCost}` : `then $${st.dailyWage} a day`, 'small')}</button>`;
    } else if (st.dayOff) {
      cls = 'dayoff'; mood = 'sleepy';
      btn = `<button type="button" class="friend-btn" data-act="off" data-id="${st.id}">${tileLine('Day off')}${tileLine('tap to call in', 'small')}</button>`;
    } else {
      const cups = (est.find(x => x.id === st.id) || { estCups: 0 }).estCups;
      cls = 'working'; mood = 'happy';
      btn = `<button type="button" class="friend-btn" data-act="off" data-id="${st.id}">${tileLine('Working')}${tileLine(`~${cups} cups, $${st.dailyWage} pay`, 'small')}</button>`;
    }
    const kid = friendPortrait(st.id, mood);
    return `<div class="friend-tile ${cls}">
      <div class="friend-pic">${kid ? `<img class="friend-kid" src="${kid}" alt="" />` : ''}<img class="friend-stand" src="./sprites/franchise/${f.pic}.png" alt="" /></div>
      <div class="friend-name">${st.workerName}</div>
      <div class="friend-where">${st.name}</div>
      ${btn}
    </div>`;
  }).join('');
  setHTMLIfChanged(document.getElementById('friends-row'), html);
}
document.getElementById('friends-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.friends-tab');
  if (!b) return;
  partnersTab = b.dataset.tab;
  renderFriends(engine.state);
});
document.getElementById('friends-row').addEventListener('click', (e) => {
  const btn = e.target.closest('.friend-btn');
  if (!btn || btn.disabled) return;
  if (btn.dataset.act === 'hire') {
    if (engine.hireFranchiseStand(btn.dataset.id)) kidFlash('cheer', 2000);
  } else if (btn.dataset.act === 'sign') {
    if (engine.signWholesaleAccount(btn.dataset.id)) kidFlash('cheer', 2000);
  } else if (btn.dataset.act === 'expand') {
    if (engine.upgradeWholesaleAccount(btn.dataset.id)) kidFlash('cheer', 2000);
  } else if (btn.dataset.act === 'license') {
    const offer = squeezerOffer(engine.state);
    if (offer && !offer.sales && !offer.days && !offer.short && engine.buyProject(offer.project.id)) kidFlash('cheer', 2000);
  } else if (btn.dataset.act === 'off') {
    engine.toggleFriendDayOff(btn.dataset.id);
  } else if (btn.dataset.act === 'brand') {
    const next = engine.nextBrandStep();
    if (next && engine.state.cash.toNumber() - engine.restockCostForToday() >= next.cost && engine.buyBrandStep()) kidFlash('cheer', 2500);
  }
});

const moneyPill = document.getElementById('header-cash-pill');
const moneyBag = document.getElementById('money-bag');
let moneyBagSig = '';
function renderMoneyBag(s) {
  if (moneyBag.hidden) return;
  const sig = JSON.stringify([s.lastLedger, engine.ledger, Math.floor(s.upgradeSavingsTotal)]);
  if (sig === moneyBagSig) return;
  moneyBagSig = sig;
  document.getElementById('money-bag-body').innerHTML = moneyBagHTML(engine);
}
function setMoneyBag(open) {
  moneyBag.hidden = !open;
  moneyPill.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) { moneyBagSig = ''; renderMoneyBag(engine.state); }
}
moneyPill.addEventListener('click', (e) => {
  if (e.target.closest('#btn-mb-see-report')) {
    setMoneyBag(false);
    if (engine.state.lastDaySummary) openReportModal(engine.state.lastDaySummary);
    return;
  }
  if (moneyBag.contains(e.target)) return;      // taps inside the card keep it open
  setMoneyBag(moneyBag.hidden);
});
moneyPill.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMoneyBag(moneyBag.hidden); }
});
document.addEventListener('click', (e) => { if (!moneyBag.hidden && !moneyPill.contains(e.target)) setMoneyBag(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !moneyBag.hidden) setMoneyBag(false); });

// ---- The player's kid: paper-doll art (public/sprites/kid/) stacked and recolored by
// src/kid.ts. It sits beside the cash pill with a face for how the day went, and
// tapping it opens the mirror. A new player meets the mirror before Day 1.
let kidProfile = loadCharacterProfile(dadModeActive);   // Dad Mode has its own look
let kidVersion = 0;            // bumps when the look changes or the art finishes loading
// The kid's face for how yesterday went, or a quick face for something that just happened.
let kidFlashMood = '', kidFlashUntil = 0;
function kidFlash(mood, ms) { kidFlashMood = mood; kidFlashUntil = Date.now() + ms; }
const KID_DOZE_MS = 45000;
let kidLastInput = Date.now();
for (const ev of ['pointerdown', 'keydown', 'wheel']) {
  document.addEventListener(ev, () => { kidLastInput = Date.now(); }, { capture: true, passive: true });
}
const kidDozing = () => Date.now() - kidLastInput > KID_DOZE_MS;
function kidMoodFor(d) {
  if (Date.now() < kidFlashUntil) return kidFlashMood;
  if (d.soldOut) return 'soldout';
  if (d.drivewayCupsSold + d.franchiseCupsSold + d.bottlesSold === 0) return 'ennui';   // nobody came
  if (d.netProfit < 0) return 'grumpy';
  if (d.weather === 'RAINY' || d.netProfit === 0) return 'calm';
  const stars = reportCatMood(d);
  if (stars >= 4) return 'smug';       // five-star day
  if (stars >= 3) return 'cheer';
  return 'happy';
}
// Special hair moves on a layer over the picture: flowing rainbow colors, or twinkles.
function kidFxHTML(profile, mood, head) {
  const fx = kidFx(profile, mood, head);
  if (!fx.fx) return '';
  if (fx.hairFill) {
    return `<img class="kid-fx-rainbow" src="${fx.hairFill}" alt="" /><img src="${fx.hairLines}" alt="" />`;
  }
  return fx.sparkles.map(p =>
    `<span class="kid-spark kid-spark-${fx.fx}" style="left:${p.x.toFixed(1)}%;top:${p.y.toFixed(1)}%;` +
    `width:${p.size.toFixed(1)}%;animation-delay:-${p.delay.toFixed(2)}s"></span>`).join('');
}
function kidPicHTML(profile, mood, head) {
  const url = kidImageURL(profile, mood, head);
  return url ? `<span class="kid-pic"><img src="${url}" alt="" /><span class="kid-fx">${kidFxHTML(profile, mood, head)}</span></span>` : '';
}
function setKidImg(img, mood, head) {
  if (!img) return;
  const tag = `${kidVersion}/${mood}/${head ? 1 : 0}`;
  if (img.dataset.kid === tag) return;
  const url = kidImageURL(kidProfile, mood, head);
  if (!url) return;            // art still loading
  img.src = url;
  img.dataset.kid = tag;
  const fx = img.parentElement.querySelector('.kid-fx');
  if (fx) setHTMLIfChanged(fx, kidFxHTML(kidProfile, mood, head));
}

// ---- Secret looks (src/unlocks.ts): some hair styles and colors stay out of the mirror
// until a milestone happens. Nothing hints at what is next; a new look just shows up,
// with a surprise in the Day Report and a glow on it until the mirror is opened.
let kidUnlocks = loadUnlocks();
const lookOfHair = (i) => `hair:${kidHairIds()[i]}`;
const lookOfColor = (i) => `color:${HAIR_PALETTES[i].id}`;
function refreshKidNew() {
  document.getElementById('btn-header-kid').classList.toggle('has-new', kidUnlocks.unseen.size > 0);
}
function profileWithLook(look) {
  const [kind, id] = look.split(':');
  if (kind === 'hair') {
    const i = kidHairIds().indexOf(id);
    return i < 0 ? null : { ...kidProfile, hairStyle: i };
  }
  const i = HAIR_PALETTES.findIndex(p => p.id === id);
  return i < 0 ? null : { ...kidProfile, hairColor: i };
}
const MAGIC_LINES = ['Whoa! Magic in the mirror!', 'Something sparkly appeared!', 'Psst... check the mirror!'];
// The new look the day brought (saved right away), or null. The report shows it (showMagicLook),
// and the kid button starts to glow (refreshKidNew) only once the day scene is over.
function checkMagicLooks(summary) {
  if (!summary || dadModeActive) return null;   // Dad's test days do not spend the kid's surprises
  const look = advanceLookUnlocks(kidUnlocks, unlockCheckFrom(engine.state, summary), otherUnlockToday(engine.state, summary));
  saveUnlocks(kidUnlocks); // also save milestones waiting for a quiet day
  return look || null;
}

function showMagicLook(look) {
  const content = document.getElementById('report-modal-content');
  if (!content) return;
  const profile = profileWithLook(look);
  const pics = profile ? kidPicHTML(profile, 'surprised', true) : '';
  content.insertAdjacentHTML('afterbegin',
    `<div class="magic-look"><div class="magic-look-pics">${pics}</div>` +
    `<div class="magic-look-text"><b>${MAGIC_LINES[Math.floor(Math.random() * MAGIC_LINES.length)]}</b>` +
    `<span>A new look showed up in your mirror.</span></div>` +
    `<button type="button" class="magic-look-try" id="btn-magic-look-try">Try it on!</button></div>`);
  document.getElementById('btn-magic-look-try').onclick = (e) => {
    e.stopPropagation();
    closeReportModal();
    openMirror(false);
  };
}

const mirror = document.getElementById('kid-mirror-backdrop');
const MIRROR_CHEERS = ['Looking good!', 'So cool!', 'Love it!', 'Ready to sell!', 'Lookin\' fresh!'];
const MIRROR_POSES = ['cheer', 'smug', 'sly', 'wink'];
let mirrorMood = 'happy';
let mirrorCheerTimer = 0;
const mirrorOpen = () => mirror.classList.contains('active');
// Dad Mode's mirror is the selfie room: every secret look is out, with no glows.
const lookShown = (look) => dadModeActive || lookOpen(kidUnlocks, look);
const lookIsNew = (look) => !dadModeActive && kidUnlocks.unseen.has(look);
// lookOf: (index) -> look id, for options that can be secret; hidden until earned.
function swatchesHTML(palettes, current, key, label, lookOf) {
  return palettes.map((p, i) => {
    const on = i === current;
    const look = lookOf ? lookOf(i) : '';
    if (look && !on && !lookShown(look)) return '';
    const isNew = look && lookIsNew(look);
    return `<button type="button" class="kid-swatch${on ? ' on' : ''}${isNew ? ' is-new' : ''}" data-key="${key}" data-i="${i}" ` +
      `style="--sw:${p.swatch || p.base}" aria-label="${p.name || label + ' ' + (i + 1)}" aria-pressed="${on}"></button>`;
  }).join('');
}
function renderMirror() {
  if (!mirrorOpen()) return;
  setKidImg(document.getElementById('kid-mirror-preview'), mirrorMood, false);
  const n = kidHairCount();
  const gearButton = (id, label, on, key) => `<button type="button" class="kid-hair-opt${on ? ' on' : ''}" data-key="${key}" data-id="${id}" title="${label}" aria-label="${label}" aria-pressed="${on}">${id ? `<img src="${accessoryURL(id)}" alt="">` : 'None'}</button>`;
  setHTMLIfChanged(document.getElementById('kid-opt-hats'),
    gearButton('', 'No hat', !kidProfile.hat, 'hat') +
    HATS.map(h => gearButton(h.id, h.name, kidProfile.hat === h.id, 'hat')).join('') +
    gearButton(SHADES.id, 'Toggle sunglasses', !!kidProfile.sunglasses, 'sunglasses'));
  const hairOn = n ? kidProfile.hairStyle % n : -1;
  setHTMLIfChanged(document.getElementById('kid-opt-hair'), Array.from({ length: n }, (_, i) => {
    const look = lookOfHair(i);
    if (i !== hairOn && !lookShown(look)) return '';
    const isNew = lookIsNew(look);
    const url = kidImageURL({ ...kidProfile, hat: undefined, sunglasses: false, hairStyle: i }, 'happy', true);
    return `<button type="button" class="kid-hair-opt${i === hairOn ? ' on' : ''}${isNew ? ' is-new' : ''}" data-key="hairStyle" data-i="${i}" ` +
      `aria-label="Hair style ${i + 1}" aria-pressed="${i === hairOn}"><img src="${url}" alt="" /></button>`;
  }).join(''));
  setHTMLIfChanged(document.getElementById('kid-opt-skin'), swatchesHTML(SKIN_PALETTES, kidProfile.skinTone, 'skinTone', 'Skin tone'));
  setHTMLIfChanged(document.getElementById('kid-opt-haircolor'), swatchesHTML(HAIR_PALETTES, kidProfile.hairColor, 'hairColor', 'Hair color', lookOfColor));
  setHTMLIfChanged(document.getElementById('kid-opt-apron'), swatchesHTML(UNIFORM_PALETTES, kidProfile.uniformColor, 'uniformColor', 'Apron color'));
}
mirror.addEventListener('click', (e) => {
  const b = e.target.closest('[data-key]');
  if (!b) return;
  const key = b.dataset.key;
  const value = key === 'hat' ? b.dataset.id : key === 'sunglasses' ? !kidProfile.sunglasses : Number(b.dataset.i);
  kidProfile = { ...kidProfile, [key]: value };
  saveCharacterProfile(kidProfile, dadModeActive);
  kidVersion++;
  mirrorMood = MIRROR_POSES[Math.floor(Math.random() * MIRROR_POSES.length)];
  setText(document.getElementById('kid-mirror-bubble'), MIRROR_CHEERS[Math.floor(Math.random() * MIRROR_CHEERS.length)]);
  clearTimeout(mirrorCheerTimer);
  mirrorCheerTimer = setTimeout(() => { mirrorMood = 'happy'; renderMirror(); }, 1100);
  renderMirror();
});
function openMirror(first) {
  setText(document.getElementById('btn-kid-mirror-done'), first ? 'Start My Stand!' : 'Done!');
  setText(document.getElementById('kid-mirror-bubble'), 'How do I look?');
  document.getElementById('btn-kid-mirror-x').hidden = first;   // first time: pick, then start
  mirrorMood = 'happy';
  mirror.classList.add('active');
  mirror.setAttribute('aria-hidden', 'false');
  renderMirror();
}
function closeMirror() {
  if (!mirrorOpen()) return;
  saveCharacterProfile(kidProfile, dadModeActive);
  if (!dadModeActive && kidUnlocks.unseen.size) {       // seen now: the glows go away
    kidUnlocks.unseen.clear();
    saveUnlocks(kidUnlocks);
    refreshKidNew();
  }
  mirror.classList.remove('active');
  mirror.setAttribute('aria-hidden', 'true');
}
document.getElementById('btn-kid-mirror-done').onclick = closeMirror;
document.getElementById('btn-kid-mirror-x').onclick = closeMirror;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMirror(); });
document.getElementById('btn-header-kid').onclick = (e) => { e.stopPropagation(); setMoneyBag(false); openMirror(false); };
// Switching Dad Mode swaps between the kid's look and Dad's selfie-room look.
document.addEventListener('dadmodechange', () => {
  kidProfile = loadCharacterProfile(dadModeActive);
  kidVersion++;
  renderMirror();
});

// Reset: forget the look and the secret looks, then meet the mirror like a new player.
function resetKid() {
  clearCharacterProfile();
  clearUnlocks();
  kidProfile = loadCharacterProfile(dadModeActive);
  kidUnlocks = loadUnlocks();
  kidFlashUntil = 0;
  kidVersion++;
  refreshKidNew();
  openMirror(true);
}
initResetCard({ onOpen: () => setMoneyBag(false), onConfirm: startOver });

// Pictures that only show up later (the next shop item, stores, friends' stands, every house,
// the Flavor Lab's fruits, the brand moves, the yard, the trophies and wallpapers, the day
// scene's clouds and customers): loaded while the page is idle, so they never pop in.
whenIdle(() => {
  void preloadInBackground([
    ...ALL_HOUSE_IMAGES, ...ALL_PLACE_IMAGES, './sprites/morning_prep/cloud_puff.png',
    ...KID_SHOP.map(item => item.pic), INVENTION.pic, INVENTION.worldPic, ...FLAVORS.map(fruitPic), ...ALL_SHELF_IMAGES,
  ]).then(prepareCustomers);
});
initDadPanel(() => engine);

loadKidArt().then(() => {
  kidVersion++;
  renderMirror();
  // The day scene's sellers (the kid and each friend at their stand) are drawn now, while
  // nothing is happening, instead of when the stand opens. Then the scene has a rehearsal, so
  // the first real one starts smoothly (playDayScene.ts).
  whenIdle(() => {
    const sellers = [kidImageURL(kidProfile, 'happy', 'stand'), ...Object.keys(FRIENDS).map(id => friendPortrait(id, 'happy', 'stand'))];
    void preloadInBackground(sellers).then(() => {
      rehearseDayScene(engine.state.weather, engine.state.tempF, id => sceneLocation(id, engine, kidProfile));
    });
  });
}).catch((e) => console.warn('[Kid]', e.message));
refreshKidNew();
if (!dadModeActive && !hasSavedCharacterProfile() && engine.state.day === 1 && !engine.state.lastDaySummary) openMirror(true);

requestAnimationFrame(loop);

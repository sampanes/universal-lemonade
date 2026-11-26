// src/ui/partners.js -- the card for everything the business grows into, one tab per part:
// Friends (Stage 2: hire a friend, then tap a hired friend to give them the day off: no sales,
// no pay), Stores (Stage 3: sign a store up once, then it buys bottles every day), Invention
// (Stage 4: the patented lemon squeezer that stores sell for you), Factory and Brand
// (Stage 5). A tab whose daily jobs a helper took over goes away.
import { session, spareCash } from './session.js';
import { setHTMLIfChanged, setClass, setHidden, LOCK } from './dom.js';
import { fmtWhole, fmtDollars } from './format.js';
import { kidFlash } from './kidView.js';
import { FRIENDS, friendPortrait } from './places.js';
import { SQUEEZER_LEVELS } from '../data/projects.ts';
import { FLAVORS, FLAVOR_BOOST } from '../data/flavors.ts';
import { BRAND_STEPS } from '../data/brand.ts';
import { INVENTION } from '../shop.ts';
import { shopDaysRemaining } from '../unlocks.ts';
import { brandPic, standPic, storePic } from '../pictures.ts';

const $ = (id) => document.getElementById(id);
const count = (n) => n.toLocaleString('en-US');
const plural = (n, word) => `${count(n)} ${word}${n === 1 ? '' : 's'}`;

let tab = 'friends';
let tabsPhase = null;     // the stage the tabs last saw (a new stage opens its tab)

// One line of a friend or store button. It never wraps: a wrap would make that button taller
// and shift the whole row. A line too long for the button shrinks to fit instead (.tile-line
// in game.css, from its character count).
function tileLine(html, tag = 'span') {
  const chars = html.replace(/<[^>]*>/g, '').replace(/&[#\w]+;/g, 'x').length;
  return `<${tag} class="tile-line" style="--chars:${chars}">${html}</${tag}>`;
}

// The wide panel the Invention, Factory and Brand tabs share: a picture, a name, a line under
// it, then the rest (stats, a button).
function panelHTML(pic, name, desc, rest) {
  return `<div class="invention-panel">
    <img src="${pic}" alt="" />
    <div>
      <div class="invention-name">${name}</div>
      <div class="invention-desc">${desc}</div>
      ${rest}
    </div>
  </div>`;
}
const statsHTML = (stats) => `<div class="invention-stats">${stats.filter(Boolean).map(t => `<span>${t}</span>`).join('')}</div>`;

// A buy button on a panel, what it brings (then), and what is still missing (needs), if any.
function panelBuyHTML(act, label, needs, then) {
  const off = needs.length > 0;
  return `<button type="button" class="friend-btn" data-act="${act}"${off ? ` disabled aria-describedby="${act}-needs"` : ''}>${off ? LOCK : ''}${label}</button>
    <small>${then}</small>
    ${off ? `<small class="panel-needs" id="${act}-needs">${needs.join(' &middot; ')}</small>` : ''}`;
}

// ---- Friends (src/data/franchise.ts) ----
function friendsHTML(s) {
  const engine = session.engine;
  const est = engine.getDailyDemandEstimate().franchiseEstimates;
  const goal = engine.friendExpansionGoal();
  const wait = goal.remaining ? `Sell ${count(goal.remaining)} cups`
    : goal.days ? (goal.days === 1 ? 'Ready tomorrow!' : `Ready in ${goal.days} days`) : '';
  return Object.values(engine.franchiseStands).map(st => {
    let cls, mood, btn;
    if (!st.hired) {
      cls = 'open'; mood = 'wink';
      btn = `<button type="button" class="friend-btn" data-act="hire" data-id="${st.id}"${wait || s.cash.lt(st.setupCost) ? ' disabled' : ''}>${tileLine(wait || `Hire $${st.setupCost}`)}${tileLine(wait ? `Hire $${st.setupCost}` : `then $${st.dailyWage} a day`, 'small')}</button>`;
    } else if (st.dayOff) {
      cls = 'dayoff'; mood = 'sleepy';
      btn = `<button type="button" class="friend-btn" data-act="off" data-id="${st.id}">${tileLine('Day off')}${tileLine('tap to call in', 'small')}</button>`;
    } else {
      const cups = est.find(x => x.id === st.id)?.estCups ?? 0;
      cls = 'working'; mood = 'happy';
      btn = `<button type="button" class="friend-btn" data-act="off" data-id="${st.id}">${tileLine('Working')}${tileLine(`~${cups} cups, $${st.dailyWage} pay`, 'small')}</button>`;
    }
    const kidPic = friendPortrait(st.id, mood);
    return `<div class="friend-tile ${cls}">
      <div class="friend-pic">${kidPic ? `<img class="friend-kid" src="${kidPic}" alt="" />` : ''}<img class="friend-stand" src="${standPic(FRIENDS[st.id].pic)}" alt="" /></div>
      <div class="friend-name">${st.workerName}</div>
      <div class="friend-where">${st.name}</div>
      ${btn}
    </div>`;
  }).join('');
}

// ---- Stores (src/data/wholesale.ts) ----
function storesHTML(s) {
  const engine = session.engine;
  const accounts = Object.values(engine.wholesaleAccounts);
  const goal = engine.storeExpansionGoal();
  const steps = [];
  if (goal.remaining) steps.push(`sell ${plural(goal.remaining, 'more bottle')}`);
  if (goal.days) steps.push(`finish ${plural(goal.days, 'more day')}`);
  const wait = steps.length > 0;
  const hint = wait && accounts.some(acc => !acc.active || acc.level < acc.levels.length)
    ? `<p class="store-unlock-hint" id="store-unlock-hint">To unlock your next store purchase, ${steps.join(' and ')}.</p>` : '';
  const est = engine.getDailyDemandEstimate().storeEstimates;
  return hint + accounts.map(acc => {
    const next = acc.levels[acc.level];
    let btn;
    if (acc.active && !next) {
      const n = est.find(x => x.id === acc.id)?.estBottles ?? 0;
      btn = `<div class="store-status">${tileLine('Biggest shelf!')}${tileLine(`~${n} bottles today`, 'small')}</div>`;
    } else {
      const cost = acc.active ? next.cost : acc.setupCost;
      const state = wait ? ' disabled aria-describedby="store-unlock-hint"' : s.cash.lt(cost) ? ' disabled' : '';
      const orders = acc.active ? `${acc.bottlesPerDay} &rarr; ${next.bottlesPerDay}/day` : `~ ${acc.bottlesPerDay} bottles/day`;
      btn = `<button type="button" class="friend-btn" data-act="${acc.active ? 'expand' : 'sign'}" data-id="${acc.id}"${state}>${tileLine(`${wait ? LOCK : ''}${acc.active ? 'Shelf' : 'Sign up'} $${cost}`)}${tileLine(orders, 'small')}</button>`;
    }
    return `<div class="friend-tile ${acc.active ? 'working' : 'open'}">
      <div class="friend-pic"><img class="store-pic" src="${storePic(acc.id)}" alt="" /></div>
      <div class="friend-name">${acc.name}</div>
      <div class="friend-where">${acc.active ? `Lv ${acc.level}/3 | $${acc.wholesalePrice.toFixed(2)} each` : `pays $${acc.wholesalePrice.toFixed(2)} a bottle`}</div>
      ${btn}
    </div>`;
  }).join('');
}

// ---- Invention (the squeezer's steps: SQUEEZER_LEVELS) ----
// The button for each squeezer step after the first, with its picture.
const SQUEEZER_BUTTONS = {
  2: { label: 'Put It on TV', pic: null },
  3: { label: 'Sell in Every State', pic: null },
  4: { label: 'Sell It Worldwide', pic: INVENTION.worldPic },
};
// The next squeezer step to buy, and what is still missing: squeezers sold, a day's wait
// after the last purchase, and money left over after today's supplies.
function squeezerOffer(s) {
  const engine = session.engine;
  const step = SQUEEZER_LEVELS[engine.patent.level];
  if (!engine.patent.licensed || !step) return null;
  const project = engine.projects.find(p => p.id === step.project);
  if (!project || project.purchased) return null;
  return {
    step, project,
    sales: Math.max(0, step.salesRequired - s.totalSqueezersSold),
    days: shopDaysRemaining(s),
    short: Math.max(0, project.costCash - spareCash()),
  };
}
function inventionHTML(s) {
  const p = session.engine.patent;
  const d = s.lastDaySummary;
  const stats = statsHTML([
    `About ${count(Math.round(p.baseUnitsPerDay))} sold a day`,
    `${count(s.totalSqueezersSold)} sold in all`,
    d && d.patentUnitsSold > 0 && `Yesterday: ${count(d.patentUnitsSold)} sold, +$${fmtDollars(d.patentRoyalties, true)}`,
  ]);
  const offer = squeezerOffer(s);
  let upgrade = '';
  if (offer) {
    const btn = SQUEEZER_BUTTONS[offer.step.level];
    const needs = [];
    if (offer.sales) needs.push(`Sell ${plural(offer.sales, 'more squeezer')}`);
    if (offer.days) needs.push(`Finish ${plural(offer.days, 'more day')}`);
    if (offer.short) needs.push(`Save $${fmtDollars(offer.short, true)} more after supplies`);
    const label = `${btn.pic ? `<img class="license-pic" src="${btn.pic}" alt="" />` : ''}${btn.label} &middot; $${fmtWhole(offer.project.costCash)}`;
    upgrade = panelBuyHTML('license', label, needs, `Then about ${count(offer.step.unitsPerDay)} sold a day at $${offer.step.royaltyPerUnit.toFixed(2)} each`);
  }
  return panelHTML(p.level >= SQUEEZER_LEVELS.length ? INVENTION.worldPic : INVENTION.pic, `My ${INVENTION.name}`,
    `Level ${p.level} &middot; ${SQUEEZER_LEVELS[p.level - 1].name} &middot; $${p.royaltyPerUnit.toFixed(2)} per sale`, stats + upgrade);
}

// ---- Factory (Stage 5) ----
function factoryHTML(s) {
  const engine = session.engine;
  const factory = engine.copacker;
  const d = s.lastDaySummary;
  const stats = statsHTML([
    `About ${count(Math.round(factory.casesPerDay * engine.flavorMult()))} cases a day`,
    `$${fmtDollars(factory.netPerCase, true)} per case after factory costs`,
    s.flags.hasFlavorLab && `Flavors in stores: ${s.flavorsLaunched.length} of ${FLAVORS.length} (+${Math.round(s.flavorsLaunched.length * FLAVOR_BOOST * 100)}% cases)`,
    d && d.copackerCasesSold > 0 && `Yesterday: ${count(d.copackerCasesSold)} cases, +$${fmtDollars(d.copackerNet, true)}`,
  ]);
  return panelHTML('./sprites/shop/lemonade_factory.png', 'My Lemonade Factory',
    'The factory uses its own supplies to make and ship your lemonade.', `${stats}<small>Look in the Stand Shop to grow your factory!</small>`);
}

// ---- The famous brand (Stage 5, src/data/brand.ts): the bonus so far, a dot per move, and
// the next move with what is still missing (a day's wait, money left after today's supplies).
function brandHTML(s) {
  const engine = session.engine;
  const pct = Math.round((engine.brandMultiplier() - 1) * 100);
  const dots = BRAND_STEPS.map((_, i) => `<span${i < s.brandLevel ? ' class="on"' : ''}></span>`).join('');
  const next = engine.nextBrandStep();
  let move;
  if (next) {
    const needs = [];
    if (engine.brandWaitDays()) needs.push('Ready tomorrow!');
    const short = Math.max(0, next.cost - spareCash());
    if (short) needs.push(`Save $${fmtWhole(Math.ceil(short))} more`);
    move = panelBuyHTML('brand', `${next.name} &middot; $${fmtWhole(next.cost)}`, needs, `${next.desc} Then everything sells ${Math.round(next.bonus * 100)}% more.`);
  } else {
    move = '<small>Your lemonade is the most famous in the whole world!</small>';
  }
  // The picture: the next move, or the last one once they are all done.
  const pic = brandPic((next ?? BRAND_STEPS[BRAND_STEPS.length - 1]).id);
  return panelHTML(pic, 'My Famous Brand', `Brand bonus: +${pct}% on everything you sell`,
    `<div class="brand-dots" aria-label="${s.brandLevel} of ${BRAND_STEPS.length} brand moves">${dots}</div>${move}`);
}

const TAB_HTML = { friends: friendsHTML, stores: storesHTML, invention: inventionHTML, factory: factoryHTML, brand: brandHTML };

export function renderPartners(s) {
  const card = $('friends-card');
  setHidden(card, s.phase < 2);
  if (s.phase < 2) return;
  const tabbed = s.phase >= 3;
  const tabsEl = $('friends-tabs');
  setHidden(tabsEl, !tabbed);
  setHidden($('friends-title'), tabbed);
  // The tabs open so far; a tab whose daily jobs a helper took over goes away (the Stand
  // Captain: friends; the Delivery Route: stores).
  const avail = [].concat(s.flags.hasStandCaptain ? [] : ['friends'], s.phase >= 3 && !s.flags.hasDeliveryRoute ? ['stores'] : [],
    s.phase >= 4 ? ['invention'] : [], s.phase >= 5 ? ['factory'] : [], session.engine.brandOpen() ? ['brand'] : []);
  // The newest tab opens by itself when a stage starts (and after a load); a tab the game
  // has not reached falls back to the newest one.
  if (tabsPhase !== s.phase) {
    if (tabsPhase === null || s.phase > tabsPhase) tab = avail[avail.length - 1];
    tabsPhase = s.phase;
  }
  if (!avail.includes(tab)) tab = avail[avail.length - 1];
  const shown = tabbed ? tab : 'friends';
  tabsEl.querySelectorAll('.friends-tab').forEach(b => {
    const on = b.dataset.tab === shown;
    setClass(b, 'on', on);
    setHidden(b, !avail.includes(b.dataset.tab));
    // The Brand tab opens in the middle of Stage 5: it glows until the first brand move.
    setClass(b, 'is-new', b.dataset.tab === 'brand' && !on && s.brandLevel === 0);
  });
  setHTMLIfChanged($('friends-row'), TAB_HTML[shown](s));
}

// A new game opens on its newest tab.
export function resetPartners() { tabsPhase = null; }

export function initPartners() {
  $('friends-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('.friends-tab');
    if (!b) return;
    tab = b.dataset.tab;
    renderPartners(session.engine.state);
  });
  $('friends-row').addEventListener('click', (e) => {
    const btn = e.target.closest('.friend-btn');
    if (!btn || btn.disabled) return;
    const engine = session.engine;
    const id = btn.dataset.id;
    let bought = false;
    switch (btn.dataset.act) {
      case 'hire': bought = engine.hireFranchiseStand(id); break;
      case 'sign': bought = engine.signWholesaleAccount(id); break;
      case 'expand': bought = engine.upgradeWholesaleAccount(id); break;
      case 'off': engine.toggleFriendDayOff(id); break;
      case 'license': {
        const offer = squeezerOffer(engine.state);
        bought = !!offer && !offer.sales && !offer.days && !offer.short && engine.buyProject(offer.project.id);
        break;
      }
      case 'brand': {
        const next = engine.nextBrandStep();
        if (next && engine.spareCash() >= next.cost && engine.buyBrandStep()) kidFlash('cheer', 2500);
        return;
      }
    }
    if (bought) kidFlash('cheer', 2000);
  });
}

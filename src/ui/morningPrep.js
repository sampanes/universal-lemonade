// src/ui/morningPrep.js -- the morning: the weather card (the forecast, how busy it looks, the
// ice hint and the lemon's tip), Morning Prep (the supplies, or the Supply Truck's tile once a
// helper shops; the chore tile), and the big Open for Business button.
import { session } from './session.js';
import { setText, setHTMLIfChanged, setClass, setHidden, setDisabled, setData, replayClass } from './dom.js';
import { fmtWhole, fmtDollars, fmtRest } from './format.js';
import { skyCondition, temperatureBand } from '../scene/forecastArt.ts';
import { SUPPLY_PICS } from '../pictures.ts';
import { ledgerSupplies } from '../engine.ts';

// In grid order. Bottles (Stage 3 on) come right after the ice: once the ice machine makes the
// ice they take its spot, and before that they are a wide row moved to the end (.wide).
const SUPPLIES = [
  { item: 'lemons', title: 'Lemons' },
  { item: 'sugar', title: 'Sugar' },
  { item: 'ice', title: 'Ice Cubes' },
  { item: 'bottles', title: 'Bottles' },
  { item: 'cups', title: 'Cups' },
];
const LOW_SIGN = '\u{26A0}\u{FE0F}';
const $ = (id) => document.getElementById(id);

function supplyBoxHTML({ item, title }) {
  return `<div class="supply-item-box" id="box-${item}">
    <div class="supply-item-header">
      <img src="${SUPPLY_PICS[item]}" class="supply-item-icon" alt="" />
      <div class="supply-item-meta">
        <span class="supply-item-title">${title}</span>
        <div class="supply-stock-row">
          <div class="inv-number-pill" id="lbl-inv-${item}"></div>
          <span class="supply-alert" id="alert-${item}" hidden title="Stock is low!">${LOW_SIGN}</span>
        </div>
      </div>
    </div>
    <button type="button" id="btn-buy-${item}" class="kawaii-buy-btn"></button>
  </div>`;
}

function renderWeather(s, engine, advice) {
  setText($('weather-season-badge'), engine.getSeasonInfo(s.day).badge);
  const sky = skyCondition(s.weather, s.tempF);
  setData($('weather-condition-label'), 'heat', temperatureBand(s.tempF));
  setText($('weather-temperature'), `${s.tempF}\u{B0}F`);
  setText($('weather-condition'), sky);
  // Busy-day meter: lit cups = how busy the weather makes today; of those, the share that
  // glow gold = how much of the neighborhood knows the stand (buzz). A brand-new stand
  // has no glowing cups; a famous one has every lit cup glowing.
  const meter = $('weather-crowd-meter');
  const lit = engine.getCrowdLevel();
  setData(meter, 'level', String(lit));
  const glowing = Math.round(lit * engine.getBuzz());
  meter.querySelectorAll('img').forEach((img, i) => setClass(img, 'glow', i < glowing));
  // Ice hint in words instead of a number; it follows the kid's ice setting.
  const hint = engine.getIceHint();
  setText($('weather-ice-hint-text'), hint.text);
  setData($('weather-ice-hint'), 'mood', hint.mood);
  setHidden($('weather-sun-sprite'), s.weather !== 'SUNNY');
  setHidden($('weather-cloud-rain-wrap'), s.weather === 'SUNNY');
  setData($('weather-cloud-rain-wrap'), 'sky', sky);
  setHidden($('weather-rain-sprite'), s.weather !== 'RAINY' || sky === 'SNOWY');
  setText($('mascot-bubble-phrase'), advice.phrase);
}

// The stock pill: "200/400" while there is a storage limit, the count without one, and
// "Auto" for the ice machine's ice. When an upgrade lifts the limit a "No limit!" tag pops.
function renderStock(s, engine, item) {
  const pill = $(`lbl-inv-${item}`);
  if (item === 'ice' && s.flags.hasAutoIce) { setText(pill, 'Auto'); return; }
  const cap = engine.storageCap(item);
  const capped = Number.isFinite(cap);
  if (pill._capped === true && !capped) {
    const row = pill.parentElement;
    replayClass(row, 'cap-lifted');
    clearTimeout(row._capTimer);
    row._capTimer = setTimeout(() => row.classList.remove('cap-lifted'), 3600);
  }
  pill._capped = capped;
  setText(pill, capped ? `${s.inv[item]}/${cap}` : String(s.inv[item]));
}

// A buy button sells what fits: a whole pack, the part that still fits (it costs its share),
// or "Full!" when the bucket or bowl is full. The ice machine makes its own ice.
function renderBuyButton(s, engine, item) {
  const btn = $(`btn-buy-${item}`);
  const automatic = item === 'ice' && s.flags.hasAutoIce;
  setClass(btn, 'is-automatic', automatic);
  if (automatic) {
    setText(btn, 'Automatic!');
    setDisabled(btn, true);
    return;
  }
  const o = engine.buyOffer(item);
  setText(btn, o.full ? 'Full!' : `+${o.qty} ($${o.cost.toFixed(2)})`);
  setDisabled(btn, o.full || s.cash.lt(o.cost));
}

function renderSupplies(s, engine, advice) {
  const bottlesInIceSpot = s.phase >= 3 && s.flags.hasAutoIce;
  setHidden($('box-ice'), bottlesInIceSpot);
  setHidden($('box-bottles'), s.phase < 3);
  setClass($('box-bottles'), 'wide', !bottlesInIceSpot);
  for (const { item } of SUPPLIES) {
    if (item === 'bottles' && s.phase < 3) continue;
    renderStock(s, engine, item);
    renderBuyButton(s, engine, item);
    setHidden($(`alert-${item}`), !advice.lowItems.includes(item) || advice.fullItems.includes(item));
  }
}

// The Supply Truck (a Stage 4 helper) shops every morning: the supply tiles fold away and
// one tile says what it brought (engine.runHelpers already bought it).
function renderTruck(s, engine, advice) {
  const truck = s.flags.hasSupplyTruck;
  setClass(document.querySelector('.prep-stand-card'), 'has-truck', truck);
  setHidden($('prep-truck'), !truck);
  if (!truck) return;
  const spent = ledgerSupplies(engine.ledger);
  setText($('prep-truck-sub'), !advice.isFullyStocked
    ? "Not enough money for all of today's supplies!"
    : spent > 0.004 ? `It brought everything for today: $${fmtDollars(spent, true)}` : 'Everything for today is here.');
  const items = ['lemons', 'sugar', 'cups'].concat(s.phase >= 3 ? ['bottles'] : []);
  setHTMLIfChanged($('prep-truck-stock'), items.map(item =>
    `<span class="prep-truck-chip"><img src="${SUPPLY_PICS[item]}" alt="${item}" />${fmtWhole(s.inv[item])}</span>`).join(''));
}

// The chore tile: always there (chores are how a kid catches up after a slow day); it turns
// yellow and pulses when cash is under $5. The button fills up while the kid rests.
let restFrom = 0;    // the rest's full length, for the fill
function renderChore(s, cashLow) {
  const chore = s.currentChore;
  const busy = chore.remainingSec > 0;
  restFrom = busy ? Math.max(restFrom, chore.remainingSec) : 0;
  const btn = $('btn-chore');
  setDisabled(btn, busy);
  setClass(btn, 'is-busy', busy);
  setText($('chore-name'), busy ? 'Resting...' : chore.name);
  setText($('chore-reward'), busy ? fmtRest(chore.remainingSec) : `+$${chore.reward.toFixed(2)}`);
  $('chore-fill').style.width = busy ? `${((1 - chore.remainingSec / restFrom) * 100).toFixed(1)}%` : '0%';
  setText($('chore-tile-text'), cashLow ? 'Low on cash!' : 'Need cash?');
}

// "?" and a worried sun (no sparkles) when the forecast says something will run out today.
function renderOpenButton(s, stocked) {
  const btn = $('btn-run-day');
  if (btn.classList.contains('short-stock') === stocked) {
    btn.classList.toggle('short-stock', !stocked);
    btn.querySelector('.btn-sun').src = `./sprites/morning_prep/${stocked ? 'sun_happy' : 'sun_worried'}.png`;
  }
  setText($('btn-run-day-text'), `OPEN FOR BUSINESS${stocked ? '!' : '?'} (Day ${s.day})`);
}

export function renderMorningPrep(s) {
  const engine = session.engine;
  const advice = engine.getKidDemandAdvice();
  const cashLow = s.cash.toNumber() < 5;
  setClass(document.body, 'low-cash', cashLow);
  renderWeather(s, engine, advice);
  renderSupplies(s, engine, advice);
  renderTruck(s, engine, advice);
  renderChore(s, cashLow);
  renderOpenButton(s, advice.isFullyStocked);
}

export function initMorningPrep() {
  $('prep-items-grid').innerHTML = SUPPLIES.map(supplyBoxHTML).join('');
  for (const { item } of SUPPLIES) $(`btn-buy-${item}`).onclick = () => session.engine.buySupplies(item);
  $('btn-chore').onclick = () => session.engine.doChore();
}

// A new game: forget the old game's rest.
export function resetMorningPrep() { restFrom = 0; }

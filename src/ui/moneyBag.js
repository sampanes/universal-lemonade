// src/ui/moneyBag.js -- the cash pill at the top and the Money Bag under it (tap the pill):
// where the money came from and went. It shows the last finished day as money in, money out
// and what the kid really kept (the Day Report's "You made" leaves out the morning shopping),
// then what today has cost so far.
import { ledgerKept, ledgerSupplies, ledgerSpent } from '../engine.ts';
import { session } from './session.js';
import { setText } from './dom.js';
import { fmtDollars, tileMoney } from './format.js';
import { repStars } from './dayReport.js';
import { HOUSE_PIC } from './houseArt.js';
import { SHOP_ITEMS } from '../shop.ts';
import { BRAND_STEPS } from '../data/brand.ts';
import { brandPic, SUPPLY_PICS } from '../pictures.ts';

const mbMoney = (n) => `$${fmtDollars(Math.abs(n), true)}`;
const mbRow = (kind, pic, what, sub, amount) =>
  `<div class="mb-row ${kind}">${pic ? `<img src="${pic}" alt="" />` : ''}` +
  `<div class="mb-what">${what}${sub ? `<small>${sub}</small>` : ''}</div>` +
  `<span class="mb-amt">${kind === 'in' ? '+' : '-'}${mbMoney(amount)}</span></div>`;
const chipsHTML = (chips) => `<span class="mb-chips">${chips.map(([pic, amount, alt = '']) =>
  `<span class="mb-chip"><img src="${pic}" alt="${alt}" />${mbMoney(amount)}</span>`).join('')}</span>`;

function outRows(l, engine) {
  let rows = '';
  const supplies = ledgerSupplies(l);
  if (supplies > 0.004) {
    const chips = Object.entries(SUPPLY_PICS).filter(([k]) => l.supplies[k] > 0.004).map(([k, pic]) => [pic, l.supplies[k], k]);
    rows += mbRow('out', './sprites/supplies.png', 'Supplies', chipsHTML(chips), supplies);
  }
  if (l.shop > 0.004) {
    // One Stand Shop buy: its picture and name. Several: a chip for each with its price.
    // Brand moves (src/data/brand.ts) are not Stand Shop items: "brand:<id>" (one a day at most).
    const bought = l.shopIds.map(id => ({ item: SHOP_ITEMS.find(x => x.id === id), p: engine.projects.find(x => x.id === id) }))
      .filter(b => b.item && b.p);
    const brand = l.shopIds.length > 0 && l.shopIds.every(id => id.startsWith('brand:'))
      ? BRAND_STEPS.find(b => `brand:${b.id}` === l.shopIds[0]) : null;
    const name = brand ? brand.name : bought.length === 1 && l.shopIds.length === 1 ? bought[0].p.name : 'Upgrades';
    const pic = brand ? brandPic(brand.id) : bought.length ? bought[0].item.pic : './sprites/shop/second_stand.png';
    const sub = brand ? 'making your lemonade famous'
      : bought.length > 1 ? chipsHTML(bought.map(b => [b.item.pic, b.p.costCash])) : 'for the stand';
    rows += mbRow('out', pic, name, sub, l.shop);
  }
  if (l.hiring > 0.004) rows += mbRow('out', './sprites/franchise/ballpark.png', 'Hiring', 'new stands and deals', l.hiring);
  if (l.storeUpgrades > 0.004) rows += mbRow('out', SUPPLY_PICS.bottles, 'Store shelves', 'bigger store orders', l.storeUpgrades);
  if (l.house > 0.004) rows += mbRow('out', HOUSE_PIC, 'House', 'your house and yard', l.house);
  if (l.wages > 0.004) rows += mbRow('out', './sprites/franchise/elm.png', "Helpers' pay", 'your stand workers', l.wages);
  return rows;
}

// Two big tiles: what the last day kept, and sales since Day 1. Big totals step down so they
// fit the tile.
function tileHTML(label, n) {
  const amt = `${n >= 0 ? '+' : '-'}${tileMoney(n)}`;
  const size = amt.length > 13 ? 16 : amt.length > 10 ? 20 : 26;
  return `<div class="mb-tile ${n >= 0 ? 'pos' : 'neg'}"><span class="mb-tile-label">${label}</span>` +
    `<span class="mb-tile-amt" style="font-size:${size}px">${amt}</span></div>`;
}

function moneyBagHTML(engine) {
  const s = engine.state;
  const last = s.lastLedger;
  let html = '';
  if (last) {
    // Yesterday's whole Day Report is one tap away. The stars are how much the neighbors like
    // the stand (same meter as the report).
    const dLast = s.lastDaySummary;
    html += `<div class="mb-day-row"><span class="mb-day">Yesterday: Day ${last.day}</span>` +
      (dLast ? `<span class="mb-stars">${repStars(dLast)}</span>` +
        `<button type="button" class="mb-see-report" id="btn-mb-see-report">See report</button>` : '') + `</div>`;
    html += `<div class="mb-label in">Money in</div>`;
    html += mbRow('in', './sprites/lemonade_cup.png', 'Business sales', `${last.cups.toLocaleString('en-US')} drinks sold at stands and stores`, last.sales);
    if (last.chores > 0.004) html += mbRow('in', './sprites/morning_prep/coin_jar.png', 'Chores', '', last.chores);
    html += `<div class="mb-label out">Money out</div>`;
    html += outRows(last, engine) || `<div class="mb-note">Nothing! You had everything already.</div>`;
    html += `<div class="mb-kept">${tileHTML(`Day ${last.day}`, ledgerKept(last))}${tileHTML('Sales since Day 1', s.totalRevenueEarned.toNumber())}</div>`;
  } else {
    html += `<div class="mb-note">Open the stand! Tomorrow this shows where every dollar went.</div>`;
  }
  // Today so far (the morning's shopping and chores, before the stand opens).
  const today = engine.ledger;
  const spent = ledgerSpent(today);
  const bits = [];
  if (spent > 0.004) bits.push(`spent <b>${mbMoney(spent)}</b>`);
  if (today.chores > 0.004) bits.push(`earned <b>${mbMoney(today.chores)}</b> from chores`);
  if (bits.length) html += `<div class="mb-note">Today so far: ${bits.join(', ')}</div>`;
  if (s.upgradeSavingsTotal >= 1) html += `<div class="mb-saved">Your upgrades have saved ${mbMoney(s.upgradeSavingsTotal)} so far!</div>`;
  return html;
}

const pill = () => document.getElementById('header-cash-pill');
const bag = () => document.getElementById('money-bag');
let drawn = '';   // what the open bag was drawn from

export function renderMoneyBag(s) {
  setText(document.getElementById('header-cash-num'), fmtDollars(s.cash.toNumber(), true));
  if (bag().hidden) return;
  const sig = JSON.stringify([s.lastLedger, session.engine.ledger, Math.floor(s.upgradeSavingsTotal)]);
  if (sig === drawn) return;
  drawn = sig;
  document.getElementById('money-bag-body').innerHTML = moneyBagHTML(session.engine);
}

export function setMoneyBag(open) {
  bag().hidden = !open;
  pill().setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) { drawn = ''; renderMoneyBag(session.engine.state); }
}

// openReport: opens yesterday's Day Report ("See report").
export function initMoneyBag({ openReport }) {
  pill().addEventListener('click', (e) => {
    if (e.target.closest('#btn-mb-see-report')) {
      setMoneyBag(false);
      openReport();
      return;
    }
    if (bag().contains(e.target)) return;      // taps inside the card keep it open
    setMoneyBag(bag().hidden);
  });
  pill().addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMoneyBag(bag().hidden); }
  });
  document.addEventListener('click', (e) => { if (!bag().hidden && !pill().contains(e.target)) setMoneyBag(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !bag().hidden) setMoneyBag(false); });
}

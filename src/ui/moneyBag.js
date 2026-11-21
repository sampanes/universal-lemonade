// src/ui/moneyBag.js -- the Money Bag (tap the cash pill): where the money came from and went.
import { ledgerKept } from '../engine.ts';
import { fmtDollars, tileMoney } from './format.js';
import { KID_SHOP } from './kidShop.js';
import { HOUSE_PIC } from './houseArt.js';
import { repStars } from './dayReport.js';

// Money Bag: tap the cash pill. Shows the last finished day as money in, money out and
// what the kid really kept (the Day Report's "You made" leaves out the morning shopping),
// then what today has cost so far.
export const SUPPLY_PICS = { lemons: 'lemon', sugar: 'sugar_scoop', ice: 'ice_cubes', cups: 'lemonade_cup', bottles: 'shop/bottles' };
export const mbMoney = (n) => `$${fmtDollars(Math.abs(n), true)}`;
export const mbRow = (kind, pic, what, sub, amount) =>
  `<div class="mb-row ${kind}">${pic ? `<img src="${pic}" alt="" />` : ''}` +
  `<div class="mb-what">${what}${sub ? `<small>${sub}</small>` : ''}</div>` +
  `<span class="mb-amt">${kind === 'in' ? '+' : '-'}${mbMoney(amount)}</span></div>`;
export function mbSupplyChips(l) {
  return Object.entries(SUPPLY_PICS).filter(([k]) => l.supplies[k] > 0.004)
    .map(([k, pic]) => `<span class="mb-chip"><img src="./sprites/${pic}.png" alt="${k}" />${mbMoney(l.supplies[k])}</span>`).join('');
}
export function mbOutRows(l, engine) {
  let rows = '';
  const supplies = Object.values(l.supplies).reduce((a, b) => a + b, 0);
  if (supplies > 0.004) rows += mbRow('out', './sprites/supplies.png', 'Supplies', `<span class="mb-chips">${mbSupplyChips(l)}</span>`, supplies);
  if (l.shop > 0.004) {
    // One upgrade: its picture and name. Several: a chip for each with its price.
    const kid = l.shopIds.map(id => KID_SHOP.find(x => x.id === id)).filter(x => x && x.pic);
    const chips = kid.length > 1 ? `<span class="mb-chips">${kid.map(k => {
      const p = engine.projects.find(x => x.id === k.id);
      return `<span class="mb-chip"><img src="${k.pic}" alt="" />${mbMoney(p ? p.costCash : 0)}</span>`;
    }).join('')}</span>` : 'for the stand';
    const name = kid.length === 1 && l.shopIds.length === 1 ? kid[0].name : 'Upgrades';
    rows += mbRow('out', kid.length ? kid[0].pic : './sprites/shop/second_stand.png', name, chips, l.shop);
  }
  if (l.treats > 0.004) rows += mbRow('out', '', 'Prizes', '', l.treats);
  if (l.hiring > 0.004) rows += mbRow('out', './sprites/franchise/ballpark.png', 'Hiring', 'new stands and deals', l.hiring);
  if (l.storeUpgrades > 0.004) rows += mbRow('out', './sprites/shop/bottles.png', 'Store shelves', 'bigger store orders', l.storeUpgrades);
  if (l.house > 0.004) rows += mbRow('out', HOUSE_PIC, 'House', 'a new look for home', l.house);
  if (l.wages > 0.004) rows += mbRow('out', './sprites/franchise/elm.png', "Helpers' pay", 'your stand workers', l.wages);
  if (l.packaging > 0.004) rows += mbRow('out', '', 'Bottles and labels', '', l.packaging);
  return rows;
}
export function moneyBagHTML(engine) {
  const s = engine.state;
  const last = s.lastLedger;
  let html = '';
  if (last) {
    const kept = ledgerKept(last);
    // Yesterday's whole Day Report is one tap away (this took over the old bottom ticket).
    // The stars are how much the neighbors like the stand (same meter as the report).
    const dLast = s.lastDaySummary;
    html += `<div class="mb-day-row"><span class="mb-day">Yesterday: Day ${last.day}</span>` +
      (dLast ? `<span class="mb-stars">${repStars(dLast)}</span>` +
        `<button type="button" class="mb-see-report" id="btn-mb-see-report">See report</button>` : '') + `</div>`;
    html += `<div class="mb-label in">Money in</div>`;
    html += mbRow('in', './sprites/lemonade_cup.png', 'Lemonade', `${last.cups.toLocaleString('en-US')} ${last.cups === 1 ? 'cup' : 'cups'} sold`, last.sales);
    if (last.chores > 0.004) html += mbRow('in', './sprites/morning_prep/coin_jar.png', 'Chores', '', last.chores);
    const out = mbOutRows(last, engine);
    html += `<div class="mb-label out">Money out</div>`;
    html += out || `<div class="mb-note">Nothing! You had everything already.</div>`;
    // Lifetime business revenue is tracked in the save, separately from chores and costs.
    const total = s.totalRevenueEarned.toNumber();
    const tile = (label, n) => {
      const amt = `${n >= 0 ? '+' : '-'}${tileMoney(n)}`;   // big totals step down so they fit the tile
      const size = amt.length > 13 ? 16 : amt.length > 10 ? 20 : 26;
      return `<div class="mb-tile ${n >= 0 ? 'pos' : 'neg'}"><span class="mb-tile-label">${label}</span>` +
        `<span class="mb-tile-amt" style="font-size:${size}px">${amt}</span></div>`;
    };
    html += `<div class="mb-kept">${tile(`Day ${last.day}`, kept)}${tile('Sales since Day 1', total)}</div>`;
  } else {
    html += `<div class="mb-note">Open the stand! Tomorrow this shows where every dollar went.</div>`;
  }
  // Today so far (the morning's shopping and chores, before the stand opens).
  const today = engine.ledger;
  const spent = Object.values(today.supplies).reduce((a, b) => a + b, 0) + today.shop + today.treats + today.hiring + today.storeUpgrades + today.house;
  const bits = [];
  if (spent > 0.004) bits.push(`spent <b>${mbMoney(spent)}</b>`);
  if (today.chores > 0.004) bits.push(`earned <b>${mbMoney(today.chores)}</b> from chores`);
  if (bits.length) html += `<div class="mb-note">Today so far: ${bits.join(', ')}</div>`;
  const saved = s.upgradeSavingsTotal;
  if (saved >= 1) html += `<div class="mb-saved">Your upgrades have saved ${mbMoney(saved)} so far!</div>`;
  return html;
}

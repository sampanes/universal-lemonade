// src/ui/standShop.js -- the Stand Shop card under the recipe card: one upgrade at a time, in
// the order src/shop.ts gives (first a pick between the ice machine and the mini-fridge, then
// the other one), with a savings bar. Only spare money counts: what is left after today's
// supplies are paid for (buying an upgrade with the lemon money left kids stuck doing chores
// just to reopen the stand).
import { session, spareCash } from './session.js';
import { setText, setHTMLIfChanged, setClass, setHidden, setDisabled, restartAnimation } from './dom.js';
import { kidFlash } from './kidView.js';
import { SHOP_ITEMS, nextShopOffer } from '../shop.ts';

const $ = (id) => document.getElementById(id);
const dollars = (n) => `$${Math.floor(n).toLocaleString('en-US')}`;

// The first choice: two tiles side by side with an OR between them, each tile a button with
// its price, over one savings bar (they cost the same). Kept short so the page still fits
// the kids' screen without scrolling. Built once; renderChoice keeps the money current.
function choiceHTML(choices) {
  return `<div class="stand-shop-ask">Pick one!</div>
    <div class="stand-shop-options">${choices.map(({ item, p }) => `<button type="button" class="stand-shop-option" data-id="${item.id}">
      <img class="stand-shop-option-pic" src="${item.pic}" alt="" />
      <span class="stand-shop-option-name">${p.name}</span>
      <span class="stand-shop-option-desc">${item.pick}</span>
      <span class="stand-shop-option-price">${dollars(p.costCash)}</span>
    </button>`).join('<span class="stand-shop-or" aria-hidden="true">OR</span>')}</div>
    <div class="stand-shop-save"><div class="stand-shop-bar" hidden><span></span></div><span class="stand-shop-choice-text"></span></div>`;
}

function renderChoice(choices, spare, need) {
  const box = $('stand-shop-choice');
  const cost = Math.min(...choices.map(c => c.p.costCash));
  const short = spare < cost;
  const bar = box.querySelector('.stand-shop-bar');
  setHidden(bar, !short);
  if (short) bar.firstElementChild.style.width = `${Math.min(100, (spare / cost) * 100).toFixed(1)}%`;
  setText(box.querySelector('.stand-shop-choice-text'), short
    ? `Saving up: ${dollars(spare)} of ${dollars(cost)}${need > 0 ? ' after supplies' : ''}`
    : 'Tap the one you want first. The other one comes next!');
  for (const btn of box.querySelectorAll('.stand-shop-option')) {
    setDisabled(btn, spare < choices.find(x => x.item.id === btn.dataset.id).p.costCash);
  }
}

// The savings line under one item: what is still missing.
function saveText(item, p, s, spare, need, short, notYet) {
  const cost = p.costCash;
  if (item.id === 'patent_filing' && short && !p.unlocked(s)) return `${item.notYet(s)} | ${dollars(spare)}/${dollars(cost)}`;
  if (notYet) return item.notYet ? item.notYet(s) : 'Not open yet!';
  // The big dreams' numbers are long: the bar alone says "saving up".
  if (cost >= 1e8) return `${dollars(spare)} of ${dollars(cost)}`;
  return `Saving up: ${dollars(spare)} of ${dollars(cost)}${need > 0 ? ' after supplies' : ''}`;
}

export function renderStandShop(s) {
  const card = $('stand-shop');
  const next = nextShopOffer(session.engine);
  setHidden(card, !next);
  if (!next) { card._item = null; return; }
  const { item, p, choices } = next;
  const key = choices ? choices.map(c => c.item.id).join('+') : item.id;
  if (card._item !== key) {
    card._item = key;
    setClass(card, 'choosing', !!choices);
    setHTMLIfChanged($('stand-shop-choice'), choices ? choiceHTML(choices) : '');
    $('stand-shop-pic').src = item.pic;
    restartAnimation(card);   // the new item pops in
  }
  const need = session.engine.restockCostForToday();
  const spare = spareCash();
  if (choices) { renderChoice(choices, spare, need); return; }
  setText($('stand-shop-name'), p.name);
  setText($('stand-shop-desc'), p.desc);
  const short = spare < p.costCash;
  // Enough money but not open yet (the second stand also wants a tasty recipe).
  const notYet = !short && !p.unlocked(s);
  const showSave = short || notYet;
  setHidden($('stand-shop-save'), !showSave);
  if (showSave) {
    $('stand-shop-fill').style.width = `${notYet ? 100 : Math.min(100, (spare / p.costCash) * 100).toFixed(1)}%`;
    setText($('stand-shop-save-text'), saveText(item, p, s, spare, need, short, notYet));
  }
  const btn = $('btn-stand-shop-buy');
  btn.dataset.id = item.id;
  setDisabled(btn, showSave);
  setText(btn, dollars(p.costCash));
}

function buy(id) {
  const item = SHOP_ITEMS.find(x => x.id === id);
  const p = session.engine.projects.find(x => x.id === id);
  if (!item || !p || session.engine.spareCash() < p.costCash) return;
  if (session.engine.buyProject(id)) kidFlash(item.cheer ? 'cheer' : 'determined', 2500);   // new gear: let's do this
}

export function initStandShop() {
  $('btn-stand-shop-buy').onclick = (e) => buy(e.currentTarget.dataset.id);
  $('stand-shop-choice').addEventListener('click', (e) => {
    const btn = e.target.closest('.stand-shop-option');
    if (btn && !btn.disabled) buy(btn.dataset.id);
  });
}

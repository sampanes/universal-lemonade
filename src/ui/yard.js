// src/ui/yard.js -- the yard in the My House card (src/data/yard.ts): once the house is paid
// off, the things bought stand on a strip of grass under the house, and the next one (or the
// puppy-or-kitten choice) takes the house step's place. Buying one plays a short scene.
import { YARD_STEPS } from '../data/yard.ts';
import { yardPic } from '../pictures.ts';
import { fmtWhole } from './format.js';
import { savingsBarHTML } from './dom.js';
import { confettiHTML } from './celebration.js';

// The grass under the house, with everything bought so far (newest last; the scene shows a
// new one arriving).
export function yardStripHTML(s) {
  if (!s.yard.length) return '';
  const things = s.yard.map(id => `<img src="${yardPic(id)}" alt="" />`).join('');
  return `<div class="house-yard" aria-label="Your yard: ${s.yard.length} of ${YARD_STEPS.length} things">${things}</div>`;
}

// The next yard step for the house card: one thing with its price, or the two pets to pick
// from, and what is still missing (the days until it opens, money after today's supplies).
// Kept short so the house column and My Shelf fit 1280x660: one thing's line under its name
// is what is missing, or what it is once it can be bought. step: engine.nextYardStep().
export function yardNextHTML(step, spare) {
  const short = Math.max(0, step.cost - spare);
  const wait = step.waitDays;
  const off = short > 0 || wait > 0;
  const price = `$${fmtWhole(step.cost)}`;
  const need = wait
    ? `<div class="house-later">${wait === 1 ? 'Ready tomorrow!' : `Ready in ${wait} days!`}</div>`
    : short ? `<div class="house-save">${savingsBarHTML(spare, step.cost)}Save $${fmtWhole(Math.ceil(short))} more</div>` : '';
  if (step.things.length > 1) {
    const options = step.things.map(t => `<button type="button" class="yard-option" data-act="yard-buy" data-id="${t.id}"${off ? ' disabled' : ''}>
      <img src="${yardPic(t.id)}" alt="" /><span class="yard-option-name">${t.name}</span><span class="yard-option-price">${price}</span>
    </button>`).join('<span class="yard-or" aria-hidden="true">OR</span>');
    return `<div class="house-next-name">Pick a pet!</div><div class="yard-pick">${options}</div>
      <div class="house-later">The other one comes later.</div>${need}`;
  }
  const t = step.things[0];
  return `<div class="yard-next">
      <img src="${yardPic(t.id)}" alt="" />
      <div class="yard-next-text">
        <span class="house-next-name">${t.name}</span>
        ${need || `<span class="house-next-desc">${t.desc}</span>`}
        <button type="button" class="stand-shop-buy" data-act="yard-buy" data-id="${t.id}"${off ? ' disabled' : ''}>${price}</button>
      </div>
    </div>`;
}

// The scene when a yard thing arrives: it pops onto the grass, with confetti.
export function yardSceneHTML(thing) {
  return `<div class="house-scene-card yard-scene">
    <div class="yard-scene-stage"><img src="${yardPic(thing.id)}" alt="" /></div>
    ${confettiHTML(16, 0.5)}
    <div class="house-scene-title" id="house-scene-title">${thing.name}!</div>
    <button type="button" class="stand-shop-buy">Yay!</button>
  </div>`;
}

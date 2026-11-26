// src/ui/recipeCard.js -- the recipe card: lemons, sugar, ice and the price, a pitcher that
// fills to match, and what a customer said about the taste yesterday. There is no taste score
// on screen: the kid finds the golden recipe from the comments. Parts fold away as they stop
// being choices: the lemon and sugar rows once the recipe locks golden, the ice row with the
// ice machine, the price row with the Stand Captain, and then the whole card.
import { session } from './session.js';
import { setText, setHTMLIfChanged, setClass, setData } from './dom.js';
import { facePic } from '../pictures.ts';

// Where the lemon wheels and ice cubes float in the pitcher (its 1024 x 1024 picture), from
// the liquid's surface (y); the first `count` show, bobbing in turn (first: which bob the
// first one does, so the lemons and the ice bob out of step).
const LEMON_SPOTS = [
  { x: 300, y: 60, s: 155, rot: -15 }, { x: 460, y: 120, s: 140, rot: 25 }, { x: 230, y: 180, s: 135, rot: 45 },
  { x: 420, y: 230, s: 145, rot: -30 }, { x: 320, y: 310, s: 130, rot: 10 }, { x: 500, y: 190, s: 125, rot: -60 },
];
const ICE_SPOTS = [
  { x: 240, y: -35, s: 130, rot: -8 }, { x: 380, y: -50, s: 140, rot: 15 }, { x: 510, y: -40, s: 135, rot: -12 },
  { x: 320, y: 20, s: 120, rot: 22 }, { x: 450, y: 25, s: 115, rot: -18 }, { x: 215, y: 15, s: 110, rot: 14 },
];
function floatersHTML(spots, count, href, surfaceY, first) {
  return spots.slice(0, count).map((p, i) => `<g class="pitcher-bob-${((i + first - 1) % 2) + 1}">
    <image class="pitcher-item" href="${href}" x="${p.x}" y="${surfaceY + p.y}" width="${p.s}" height="${p.s}" style="transform: rotate(${p.rot}deg);" />
  </g>`).join('');
}

// A taste comment's mood: spot on, close, or off.
export const tasteMood = (review) => !review ? 'none' : review.stars >= 5 ? 'happy' : review.stars >= 3 ? 'close' : 'off';

// The face picture beside a taste comment ('' hides it).
export function setFace(img, face) {
  const src = face ? facePic(face) : '';
  if (img.dataset.src === src) return;
  img.dataset.src = src;
  if (src) img.src = src;
  img.hidden = !src;
}

function renderPitcher(s, engine) {
  const r = s.recipe;
  // The liquid's surface, between y=360 (full) and y=760 (low).
  const totalVol = r.lemonsPerPitcher + r.sugarPerPitcher + r.icePerCup * 0.5;
  const fillY = Math.max(360, Math.min(760, Math.round(790 - Math.min(14, totalVol) * 28)));
  const rect = document.getElementById('svg-liquid-rect');
  if (rect.getAttribute('y') !== String(fillY)) {
    rect.setAttribute('y', fillY);
    rect.setAttribute('height', 870 - fillY);
    document.getElementById('svg-liquid-wave').setAttribute('cy', fillY);
  }
  const color = engine.getRecipeProfile(s.tempF).liquidColor;
  for (const id of ['grad-stop-1', 'grad-stop-2']) {
    const stop = document.getElementById(id);
    if (stop.getAttribute('stop-color') !== color) stop.setAttribute('stop-color', color);
  }
  const lemons = Math.min(6, Math.max(1, Math.round(r.lemonsPerPitcher * 0.75)));
  setHTMLIfChanged(document.getElementById('svg-lemons-layer'), floatersHTML(LEMON_SPOTS, lemons, './sprites/lemon_wheel.png', fillY, 1));
  setHTMLIfChanged(document.getElementById('svg-ice-layer'), floatersHTML(ICE_SPOTS, Math.min(6, r.icePerCup), './sprites/ice_cube_single.png', fillY, 2));
}

export function renderRecipeCard(s) {
  const engine = session.engine;
  const card = document.getElementById('ratio-card');
  const locked = s.recipeLocked;
  const autoIce = s.flags.hasAutoIce;
  const priceOnly = locked && autoIce;   // nothing left to choose but the price
  setClass(card, 'golden-locked', locked);
  setClass(card, 'auto-ice', autoIce);
  setClass(card, 'price-only', priceOnly);
  setClass(card, 'captain', s.flags.hasStandCaptain);
  setClass(card, 'helper-done', priceOnly && s.flags.hasStandCaptain);
  if (card.classList.contains('helper-done')) return;
  setText(document.getElementById('ratio-banner-text'), priceOnly ? 'All set! Just pick a price' : locked ? 'RATIO IS GOLDEN!' : 'RECIPE RATIO');

  setText(document.getElementById('lbl-price'), s.recipe.pricePerCup.toFixed(2));
  setText(document.getElementById('lbl-lemons'), String(s.recipe.lemonsPerPitcher));
  setText(document.getElementById('lbl-sugar'), String(s.recipe.sugarPerPitcher));
  setText(document.getElementById('lbl-ice'), String(s.recipe.icePerCup));
  renderPitcher(s, engine);

  const last = s.lastDaySummary;
  const taste = last && last.reviews.find(r => r.topic === 'taste');
  setText(document.getElementById('recipe-taste-text'), !last ? 'Open the stand to hear what neighbors think!'
    : taste ? `"${taste.quote}"` : 'Nobody got to taste it yesterday.');
  setFace(document.getElementById('recipe-taste-face'), taste?.face);
  setData(document.getElementById('recipe-taste-bubble'), 'mood', tasteMood(taste));
}

export function initRecipeCard() {
  for (const item of ['lemons', 'sugar', 'ice', 'price']) {
    document.getElementById(`btn-${item}-down`).onclick = () => session.engine.adjustRecipe(item, -1);
    document.getElementById(`btn-${item}-up`).onclick = () => session.engine.adjustRecipe(item, 1);
  }
}

// src/ui/flavorLab.js -- the Flavor Lab card (Stage 5, src/data/flavors.ts): the new flavor's
// fruit and sugar, a glass of it, the flavors in stores so far, and what the taste testers
// said last time. Found like the golden recipe: the testers say which way to go.
import { session } from './session.js';
import { setText, setHTMLIfChanged, setHidden, setData } from './dom.js';
import { tasteMood, setFace } from './recipeCard.js';
import { FLAVORS } from '../data/flavors.ts';
import { fruitPic } from '../pictures.ts';

const $ = (id) => document.getElementById(id);

export function renderFlavorLab(s) {
  const card = $('flavor-lab');
  const flavor = session.engine.currentFlavor();
  setHidden(card, !flavor);
  if (!flavor) return;
  if (card.dataset.flavor !== flavor.id) {
    card.dataset.flavor = flavor.id;
    card.style.setProperty('--drink', flavor.color);
    setText($('flavor-lab-name'), flavor.name);
    const icon = $('flavor-fruit-icon');
    icon.src = fruitPic(flavor.id);
    icon.alt = flavor.fruit;
    card.querySelectorAll('.flavor-glass-fruit').forEach(img => { img.src = fruitPic(flavor.id); });
  }
  const mix = s.flavorMix;
  setText($('lbl-fruit'), String(mix.fruit));
  setText($('lbl-fsugar'), String(mix.sugar));
  const fill = `${Math.round(30 + Math.min(1, (mix.fruit + mix.sugar) / 12) * 60)}%`;
  if (card.style.getPropertyValue('--fill') !== fill) card.style.setProperty('--fill', fill);
  const done = s.flavorsLaunched.length;
  setHTMLIfChanged($('flavor-lab-progress'), FLAVORS.map((f, i) =>
    `<span class="dot${i < done ? ' on' : ''}" style="${i < done ? `background:${f.color}` : ''}" title="${f.name}"></span>`).join('') +
    `<span class="label">${done} of ${FLAVORS.length} in stores</span>`);
  // Yesterday's tasting of this flavor (a new flavor has not been tasted yet).
  const last = s.lastDaySummary?.flavorTaste;
  const tasted = last && last.id === flavor.id ? last.review : null;
  setData($('flavor-lab-bubble'), 'mood', tasteMood(tasted));
  setFace($('flavor-lab-face'), tasted?.face);
  setText($('flavor-lab-say'), tasted ? `"${tasted.quote}"` : 'Pick the fruit and sugar. The taste testers try it when you open!');
}

export function initFlavorLab() {
  for (const item of ['fruit', 'sugar']) {
    const id = item === 'fruit' ? 'fruit' : 'fsugar';
    $(`btn-${id}-down`).onclick = () => session.engine.adjustFlavor(item, -1);
    $(`btn-${id}-up`).onclick = () => session.engine.adjustFlavor(item, 1);
  }
}

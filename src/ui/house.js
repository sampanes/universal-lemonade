// src/ui/house.js -- My House (src/data/house.ts): a third column with the family house,
// once the kid has sold enough lemonade. The next upgrade to save for (then the yard: src/ui/
// yard.js), the paint colors, and My Shelf under it (src/ui/shelf.js). Each upgrade plays a
// short build scene.
import { session, spareCash } from './session.js';
import { setHTMLIfChanged, setHidden, setClass, savingsBarHTML } from './dom.js';
import { fmtWhole } from './format.js';
import { kidFlash } from './kidView.js';
import { housePicHTML } from './houseArt.js';
import { yardStripHTML, yardNextHTML, yardSceneHTML } from './yard.js';
import { confettiHTML, showCelebration, hideCelebration } from './celebration.js';
import { HOUSE_STEPS, HOUSE_COLORS } from '../data/house.ts';

const $ = (id) => document.getElementById(id);

function nextStepHTML(s) {
  const engine = session.engine;
  const yard = engine.nextYardStep();
  if (yard) return yardNextHTML(yard, spareCash());
  const next = engine.nextHouseStep();
  if (!next) return '<div class="house-later">All done! The house is paid off and the yard is full of fun!</div>';
  if (s.phase < next.phase) return `<div class="house-next-name">Next: ${next.name}</div><div class="house-later">Opens when your business grows!</div>`;
  const spare = spareCash();
  const short = Math.max(0, next.cost - spare);
  return `<div class="house-next-name">${next.name}</div><div class="house-next-desc">${next.desc}</div>
    <button type="button" class="stand-shop-buy" data-act="house-buy"${short ? ' disabled' : ''}>$${fmtWhole(next.cost)}</button>
    ${short ? `<div class="house-save">${savingsBarHTML(spare, next.cost)}Save $${fmtWhole(Math.ceil(short))} more</div>` : ''}`;
}

export function renderHouse(s) {
  const show = s.houseOpen;
  setHidden($('house-col'), !show);
  setClass(document.body, 'has-house', show);
  if (!show) return;
  const level = s.houseLevel;
  // A dot per house step; once the house is paid off, the yard's grass takes their place.
  const progress = level < HOUSE_STEPS.length
    ? `<div class="house-dots" aria-label="${level} of ${HOUSE_STEPS.length} house upgrades">${HOUSE_STEPS.map((_, i) => `<span${i < level ? ' class="on"' : ''}></span>`).join('')}</div>`
    : yardStripHTML(s);
  const swatches = level >= 1 ? `<div class="house-swatches" role="group" aria-label="House color">${HOUSE_COLORS.map(c =>
    `<button type="button" class="house-swatch" data-act="house-color" data-id="${c.id}" style="--swatch:${c.hex}" aria-label="${c.name}" aria-pressed="${c.id === s.houseColor}"></button>`).join('')}</div>` : '';
  setHTMLIfChanged($('house-card'), `<div class="house-title">My House</div>
    <div class="house-pic">${housePicHTML(level, s.houseColor)}</div>
    ${progress}
    ${swatches}
    <div class="house-next">${nextStepHTML(s)}</div>`);
}

// The Day Report banner the day My House opens (src/ui/reportModal.js); the house card glows
// until the kid touches it.
export function houseNews() {
  const s = session.engine.state;
  $('house-card').classList.add('is-new');
  return {
    cls: 'house-news',
    pic: `<div class="house-news-pic">${housePicHTML(s.houseLevel, s.houseColor)}</div>`,
    title: 'Big news!',
    text: 'Your lemonade money can fix up your house now!',
    button: "Let's see!",
    onPress: () => $('house-col').scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
  };
}

// The build scene: the old house shakes in a cloud of dust, the new one pops in, confetti.
function playHouseScene(level) {
  const color = session.engine.state.houseColor;
  const dust = [[-4, 50], [33, 58], [70, 50]].map(([x, y], i) =>
    `<span class="house-dust" style="left:${x}%;top:${y}%;animation-delay:${(0.2 + i * 0.2).toFixed(1)}s"></span>`).join('');
  showCelebration($('house-scene'), `<div class="house-scene-card">
    <div class="house-scene-stage">
      <div class="house-scene-old">${housePicHTML(level - 1, color)}</div>
      <div class="house-scene-new">${housePicHTML(level, color)}</div>
      ${dust}
    </div>
    ${confettiHTML(16, 1.2)}
    <div class="house-scene-title" id="house-scene-title">${HOUSE_STEPS[level - 1].name}!</div>
    <button type="button" class="stand-shop-buy">Yay!</button>
  </div>`);
}

function buyYardThing(id) {
  const engine = session.engine;
  const step = engine.nextYardStep();
  const thing = step?.things.find(t => t.id === id);
  if (!thing || engine.spareCash() < step.cost || !engine.buyYardThing(id)) return;
  kidFlash('cheer', 3500);
  showCelebration($('house-scene'), yardSceneHTML(thing));
}

function buyHouseStep() {
  const engine = session.engine;
  const next = engine.nextHouseStep();
  if (!next || engine.spareCash() < next.cost || !engine.buyHouseStep()) return;
  kidFlash('cheer', 3500);
  playHouseScene(engine.state.houseLevel);
}

export function initHouse({ openShelf }) {
  $('house-col').addEventListener('click', (e) => {
    $('house-card').classList.remove('is-new');
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    switch (btn.dataset.act) {
      case 'house-color': session.engine.setHouseColor(btn.dataset.id); break;
      case 'shelf-open': openShelf(); break;
      case 'yard-buy': buyYardThing(btn.dataset.id); break;
      case 'house-buy': buyHouseStep(); break;
    }
  });
  // Tap anywhere once the scene's button shows (the scene is short; an early tap skips it).
  $('house-scene').addEventListener('click', (e) => hideCelebration(e.currentTarget));
}

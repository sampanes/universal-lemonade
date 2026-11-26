// src/ui/kidView.js -- the player's kid on the page: paper-doll art (public/sprites/kid/)
// stacked and recolored by src/kid.ts. The kid sits beside the cash pill with a face for how
// the day went (tapping it opens the mirror, src/ui/mirror.js), heads the Day Report, and
// stands in the ending.
import { loadCharacterProfile } from '../character.ts';
import { kidImageURL, kidFx } from '../kid.ts';
import { reportCatMood } from './dayReport.js';
import { setHTMLIfChanged } from './dom.js';

// profile: the look; version bumps whenever the look changes or the art finishes loading,
// so pictures drawn from it know to redraw.
export const kid = { profile: null, version: 0 };

// A quick face for something that just happened (a purchase: 'cheer'), for a few seconds.
let flashMood = '', flashUntil = 0;
export function kidFlash(mood, ms) { flashMood = mood; flashUntil = Date.now() + ms; }
export function clearKidFlash() { flashUntil = 0; }

// Nobody has touched the game for a while: the kid dozes off until the next tap.
const DOZE_MS = 45000;
let lastInput = Date.now();
const dozing = () => Date.now() - lastInput > DOZE_MS;

export function initKidView() {
  kid.profile = loadCharacterProfile();
  for (const ev of ['pointerdown', 'keydown', 'wheel']) {
    document.addEventListener(ev, () => { lastInput = Date.now(); }, { capture: true, passive: true });
  }
}

// The kid's face for how a day went (d: a Day Report summary).
function kidMoodFor(d) {
  if (Date.now() < flashUntil) return flashMood;
  if (d.soldOut) return 'soldout';
  if (d.drivewayCupsSold + d.franchiseCupsSold + d.bottlesSold === 0) return 'ennui';   // nobody came
  if (d.netProfit < 0) return 'grumpy';
  if (d.weather === 'RAINY' || d.netProfit === 0) return 'calm';
  const stars = reportCatMood(d);
  if (stars >= 4) return 'smug';       // five-star day
  if (stars >= 3) return 'cheer';
  return 'happy';
}

// The face beside the cash pill: there from Day 1, with a face for how yesterday went.
function headerMood(s) {
  if (dozing()) return 'sleepy';
  if (s.lastDaySummary) return kidMoodFor(s.lastDaySummary);
  return Date.now() < flashUntil ? flashMood : 'happy';
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

// The kid as markup ('' while the art is still loading). head: just the head and shoulders.
export function kidPicHTML(profile, mood, head) {
  const url = kidImageURL(profile, mood, head);
  return url ? `<span class="kid-pic"><img src="${url}" alt="" /><span class="kid-fx">${kidFxHTML(profile, mood, head)}</span></span>` : '';
}

// Point an <img> (inside a .kid-pic with a .kid-fx layer) at the kid with a face.
export function setKidImg(img, mood, head) {
  if (!img) return;
  const tag = `${kid.version}/${mood}/${head ? 1 : 0}`;
  if (img.dataset.kid === tag) return;
  const url = kidImageURL(kid.profile, mood, head);
  if (!url) return;            // art still loading
  img.src = url;
  img.dataset.kid = tag;
  const fx = img.parentElement.querySelector('.kid-fx');
  if (fx) setHTMLIfChanged(fx, kidFxHTML(kid.profile, mood, head));
}

export function renderHeaderKid(s) {
  setKidImg(document.getElementById('header-kid-img'), headerMood(s), true);
}

// The Day Report's hero picture: the kid with a face for the day (the cat until the kid art
// has loaded).
export function reportKidHTML(d) {
  const pic = kidPicHTML(kid.profile, kidMoodFor(d), true);
  return pic ? `<span class="report-kid">${pic}</span>`
    : `<img class="report-cat" src="./sprites/kawaii_cat/cat${reportCatMood(d)}.png" alt="" />`;
}

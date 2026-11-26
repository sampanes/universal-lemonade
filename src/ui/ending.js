// src/ui/ending.js -- THE ENDING: buying Citrus Cay (the last dream in the Stand Shop) wins the
// game. The island (the shop's Citrus Cay picture) with the kid and the stand on its beach,
// confetti, then what the business did since Day 1. It plays once (state.endingSeen), the
// moment the island is bought (or on the next visit if the page closed first); "Keep
// playing!" goes back to the game.
import { session, saveGame } from './session.js';
import { fmtMoney, fmtCount } from './format.js';
import { kid, kidPicHTML } from './kidView.js';
import { confettiHTML, showCelebration, hideCelebration } from './celebration.js';
import { SHOP_ITEMS } from '../shop.ts';
import { standPic } from '../pictures.ts';

const scene = () => document.getElementById('ending-scene');
const ISLAND_PIC = SHOP_ITEMS.find(x => x.id === 'private_island').pic;

function showEnding() {
  const s = session.engine.state;
  showCelebration(scene(), `<div class="house-scene-card ending-card">
    <div class="ending-stage">
      <img class="ending-sun" src="./sprites/morning_prep/sun_happy.png" alt="" />
      <img class="ending-cloud" src="./sprites/morning_prep/cloud_puff.png" alt="" />
      <div class="ending-sea"></div>
      <img class="ending-island" src="${ISLAND_PIC}" alt="" />
      <img class="ending-stand" src="${standPic('pool')}" alt="" />
      <span class="ending-kid">${kidPicHTML(kid.profile, 'cheer', false)}</span>
    </div>
    ${confettiHTML(18, 0.8, 0.07)}
    <div class="house-scene-title" id="ending-title">Citrus Cay is yours!</div>
    <p class="ending-text">From one driveway stand to your very own lemonade island. You did it!</p>
    <div class="ending-stats">
      <span><b>${s.day.toLocaleString('en-US')}</b> days</span>
      <span><b>${fmtCount(s.totalCupsSold)}</b> drinks sold</span>
      <span><b>$${fmtMoney(s.totalRevenueEarned)}</b> in sales</span>
    </div>
    <button type="button" class="stand-shop-buy" data-act="ending-close">Keep playing!</button>
  </div>`);
}

export function renderEnding(s) {
  if (s.gameWon && !s.endingSeen && scene().hidden) showEnding();
}

// Another game is starting (Reset): just hide it.
export function hideEnding() { hideCelebration(scene()); }

export function initEnding() {
  scene().addEventListener('click', (e) => {
    if (!e.target.closest('[data-act="ending-close"]')) return;
    session.engine.state.endingSeen = true;
    saveGame();
    hideCelebration(scene());
  });
}

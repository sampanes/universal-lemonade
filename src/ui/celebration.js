// src/ui/celebration.js -- the pieces the big moments share: confetti, and the popup card the
// house build scene, a yard thing arriving and the ending play in (.house-scene in game.css).

const CONFETTI_COLORS = ['#facc15', '#f472b6', '#a78bfa', '#34d399', '#60a5fa'];

// count pieces spread across the card, starting to fall after `delay` seconds, one after
// another `step` seconds apart (in a scrambled order, so they do not fall left to right).
export function confettiHTML(count, delay, step = 0.06) {
  return Array.from({ length: count }, (_, i) => {
    const left = 4 + i * 90 / (count - 1);
    const wait = delay + ((i * 7) % 10) * step;
    return `<span class="house-confetti" style="left:${left.toFixed(1)}%;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};animation-delay:${wait.toFixed(2)}s"></span>`;
  }).join('');
}

// Show a popup card in its overlay and put the keyboard on its button.
export function showCelebration(overlay, cardHTML) {
  overlay.innerHTML = cardHTML;
  overlay.hidden = false;
  overlay.querySelector('button')?.focus({ preventScroll: true });
}

export function hideCelebration(overlay) {
  overlay.hidden = true;
  overlay.innerHTML = '';
}

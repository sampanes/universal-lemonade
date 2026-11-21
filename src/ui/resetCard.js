// src/ui/resetCard.js -- the Reset card: hold the button for a few seconds to really start over.
import { setText } from './dom.js';

// onOpen: runs when the card opens (close other popups); onConfirm: start over.
export function initResetCard({ onOpen, onConfirm }) {
  // The Reset card: hold "Yes, I'm sure" for RESET_HOLD_MS; letting go early starts it over.
  const RESET_HOLD_MS = 3000;
  const resetBackdrop = document.getElementById('reset-backdrop');
  const resetHold = document.getElementById('btn-reset-hold');
  const resetFill = document.getElementById('reset-hold-fill');
  const resetLabel = document.getElementById('reset-hold-label');
  let resetHoldStart = 0;
  function showResetCard(on) {
    resetBackdrop.classList.toggle('active', on);
    resetBackdrop.setAttribute('aria-hidden', on ? 'false' : 'true');
    stopResetHold();
  }
  function stopResetHold() {
    resetHoldStart = 0;
    resetFill.style.width = '0%';
    setText(resetLabel, 'Hold: Yes, I\'m sure');
  }
  function stepResetHold() {
    if (!resetHoldStart) return;
    const t = Math.min(1, (performance.now() - resetHoldStart) / RESET_HOLD_MS);
    resetFill.style.width = `${(t * 100).toFixed(1)}%`;
    if (t >= 1) {
      showResetCard(false);
      onConfirm();
      return;
    }
    requestAnimationFrame(stepResetHold);
  }
  function beginResetHold() {
    if (resetHoldStart) return;
    resetHoldStart = performance.now();
    setText(resetLabel, 'Keep holding...');
    requestAnimationFrame(stepResetHold);
  }
  resetHold.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    resetHold.setPointerCapture?.(e.pointerId);
    beginResetHold();
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) resetHold.addEventListener(ev, stopResetHold);
  resetHold.addEventListener('contextmenu', (e) => e.preventDefault());   // long press on a touchscreen
  resetHold.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); beginResetHold(); }
  });
  resetHold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stopResetHold(); });
  resetHold.addEventListener('blur', stopResetHold);
  document.getElementById('btn-reset-no').onclick = () => showResetCard(false);
  resetBackdrop.addEventListener('click', (e) => { if (e.target === resetBackdrop) showResetCard(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') showResetCard(false); });
  document.getElementById('btn-reset').onclick = (e) => { e.stopPropagation(); onOpen(); showResetCard(true); };
}

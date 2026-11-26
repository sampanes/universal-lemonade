// src/ui/dom.js -- small helpers that only touch the page when something changed. The page is
// redrawn every frame (src/main.js), so each one compares first: an unchanged element is left
// alone, which keeps a button under a finger from being replaced mid-tap.
import { iconPic } from '../pictures.ts';

export function setText(el, text) {
  if (el && el._lastText !== text) {
    el.textContent = text;
    el._lastText = text;
  }
}

export function setHTMLIfChanged(el, newHTML) {
  if (el && el._lastHTML !== newHTML) {
    el.innerHTML = newHTML;
    el._lastHTML = newHTML;
  }
}

export function setClass(el, cls, on) {
  if (el && el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
}

export function setHidden(el, hidden) {
  if (el && el.hidden !== hidden) el.hidden = hidden;
}

export function setDisabled(el, disabled) {
  if (el && el.disabled !== disabled) el.disabled = disabled;
}

export function setData(el, key, value) {
  if (el && el.dataset[key] !== value) el.dataset[key] = value;
}

// A padlock in front of a button that is not open yet.
export const LOCK = `<img class="lock-icon" src="${iconPic('lock')}" alt="" /> `;

// Play an element's CSS animation again from the start (a pop-in on a card already showing).
export function restartAnimation(el) {
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

// Put a class on again so its animation plays from the start.
export function replayClass(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// A thin savings bar filled to spare / cost.
export function savingsBarHTML(spare, cost) {
  return `<span class="stand-shop-bar"><span style="width:${Math.min(100, Math.max(0, spare) / cost * 100).toFixed(1)}%"></span></span>`;
}

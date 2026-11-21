// src/ui/dom.js -- small helpers that only touch the page when something changed.

export function setText(el, text) {
  if (el && el._lastText !== text) {
    el.textContent = text;
    el._lastText = text;
  }
}

// Like setText, and also tells the CSS how many characters there are so a long value can
// shrink to its box (see .fit-text / .report-profit).
export function setFitText(el, text) {
  if (el && el._lastText !== text) {
    el.textContent = text;
    el.style.setProperty('--chars', text.length);
    el._lastText = text;
  }
}

export function setHTMLIfChanged(el, newHTML) {
  if (el && el._lastHTML !== newHTML) {
    el.innerHTML = newHTML;
    el._lastHTML = newHTML;
  }
}

// A lock in front of a button that is not open yet.
export const STORE_LOCK = '<span class="store-lock" aria-hidden="true">&#x1F512;</span> ';

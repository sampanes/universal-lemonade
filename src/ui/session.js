// src/ui/session.js -- the game being played: the engine, saving it, and starting a new one.
// Every part of the page reads session.engine when it runs (never keeps its own copy), so
// Reset can swap in a new game.
import { LemonadeEngine } from '../engine.ts';
import { STORAGE_KEYS, clearOutdatedStorage, readStored, writeStored } from '../storage.ts';

export const session = { engine: null };

// Every new game gets a fresh seed, so the weather and this game's golden recipe change.
function newGameSeed() {
  try {
    return (crypto.getRandomValues(new Uint32Array(1))[0] | 0) || 1;
  } catch {
    return (Math.floor(Math.random() * 0x7fffffff) | 0) || 1;
  }
}

function loadGame() {
  try {
    const raw = readStored(STORAGE_KEYS.game);
    return raw ? LemonadeEngine.fromSave(JSON.parse(raw)) : null;
  } catch (e) {
    console.warn('[Save] could not load, starting a new game:', e.message);
    return null;
  }
}

export function saveGame() {
  writeStored(STORAGE_KEYS.game, JSON.stringify(session.engine.toSave()));
}

// The saved game, or a new one. The game saves itself about once a second (src/main.js) and
// whenever the page is hidden or closed, and picks up where it left off on the next visit.
export function startSession() {
  clearOutdatedStorage();   // first, before any save or look is read
  session.engine = loadGame() || new LemonadeEngine({ seed: newGameSeed() });
  window.addEventListener('pagehide', saveGame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
}

export function newGame() {
  session.engine = new LemonadeEngine({ seed: newGameSeed() });
  saveGame();
}

// Money left after today's supplies, never below 0: the only money the shop, the house and
// the other buy buttons count (engine.spareCash).
export const spareCash = () => Math.max(0, session.engine.spareCash());

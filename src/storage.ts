// src/storage.ts -- everything the game keeps in the browser (localStorage), in one place.
//
// Saves are not upgraded from older versions. When the stored data changes shape, bump
// STORAGE_VERSION: the next page load clears every saved game, look and secret look, and the
// game starts fresh. Only Dad Mode's on/off switch is kept.

export const STORAGE_KEYS = {
  kidGame: 'universal_lemonade_game',
  dadGame: 'universal_lemonade_game_dad',
  kidLook: 'universal_lemonade_character_profile',
  dadLook: 'universal_lemonade_dad_look',       // Dad Mode's own look (its mirror opens every secret look)
  unlocks: 'universal_lemonade_unlocks',        // the kid's earned secret looks
  dadMode: 'universal_lemonade_dad_mode',       // 'true' / 'false'
} as const;

export const STORAGE_VERSION = '3';
const VERSION_KEY = 'universal_lemonade_storage_version';
const PREFIX = 'universal_lemonade_';

// Call once at startup, before anything is loaded.
export function clearOutdatedStorage(): void {
  try {
    if (localStorage.getItem(VERSION_KEY) === STORAGE_VERSION) return;
    const keep = new Set<string>([STORAGE_KEYS.dadMode]);
    const old: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX) && !keep.has(key)) old.push(key);
    }
    old.forEach(key => localStorage.removeItem(key));
    localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
    if (old.length) console.log(`[Storage] New save version ${STORAGE_VERSION}: cleared ${old.length} old entries.`);
  } catch (e) {
    console.warn('[Storage] could not check the save version:', e);
  }
}

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`[Storage] could not save ${key}:`, e);
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`[Storage] could not clear ${key}:`, e);
  }
}

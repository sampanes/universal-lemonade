// src/character.ts -- the player's lemonade hero: the color choices and the saved look.
// The picture itself is stacked from paper-doll art in src/kid.ts.
import type { CharacterProfile } from './types';

export const SKIN_PALETTES = [
  { name: 'Porcelain', base: '#FFE0BD', shadow: '#F3C59D', blush: '#FF9999' },
  { name: 'Warm Peach', base: '#F7C5A8', shadow: '#E5A885', blush: '#FF8A8A' },
  { name: 'Honey Golden', base: '#DF9F74', shadow: '#C68254', blush: '#E57373' },
  { name: 'Warm Chestnut', base: '#9E6342', shadow: '#7E4828', blush: '#B74B4B' },
  { name: 'Deep Espresso', base: '#59341E', shadow: '#3F2210', blush: '#7A2E2E' },
];

export const HAIR_PALETTES = [
  { name: 'Jet Black', base: '#221F28', highlight: '#3D3739' },
  { name: 'Milk Chocolate', base: '#5C3826', highlight: '#7C4E35' },
  { name: 'Golden Blonde', base: '#E6A847', highlight: '#F9C76E' },
  { name: 'Auburn / Rust', base: '#B34426', highlight: '#CF5E3E' },
  { name: 'Bubblegum Berry', base: '#E85A88', highlight: '#F587AB' },
];

export const UNIFORM_PALETTES = [
  { name: 'Lemon Yellow', base: '#FACC15', shadow: '#CA8A04', text: '#713F12' },
  { name: 'Berry Pink', base: '#EC4899', shadow: '#BE185D', text: '#831843' },
  { name: 'Sky Blue', base: '#38BDF8', shadow: '#0284C7', text: '#075985' },
  { name: 'Mint Green', base: '#10B981', shadow: '#059669', text: '#064E3B' },
  { name: 'Tangerine Orange', base: '#F97316', shadow: '#C2410C', text: '#7C2D12' },
];

// Hair styles come from the art (public/sprites/kid/kid.json); a saved index past the end
// wraps around in src/kid.ts, so a style removed later never breaks an old save.
const MAX_HAIR_STYLE = 63;

export const DEFAULT_CHARACTER: CharacterProfile = {
  name: 'Lemonade Kid',
  hairStyle: 0,
  skinTone: 1,      // Warm Peach
  hairColor: 1,     // Milk Chocolate Brown
  uniformColor: 0,  // Lemon Yellow
};

const STORAGE_KEY = 'universal_lemonade_character_profile';

export function loadCharacterProfile(): CharacterProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        name: parsed.name || DEFAULT_CHARACTER.name,
        hairStyle: Math.min(Math.max(parsed.hairStyle ?? 0, 0), MAX_HAIR_STYLE),
        skinTone: Math.min(Math.max(parsed.skinTone ?? 1, 0), SKIN_PALETTES.length - 1),
        hairColor: Math.min(Math.max(parsed.hairColor ?? 1, 0), HAIR_PALETTES.length - 1),
        uniformColor: Math.min(Math.max(parsed.uniformColor ?? 0, 0), UNIFORM_PALETTES.length - 1),
      };
    }
  } catch (e) {
    console.warn('[Character] Error reading saved profile:', e);
  }
  return { ...DEFAULT_CHARACTER };
}

/** True once the player has saved a look (a new player meets the mirror first). */
export function hasSavedCharacterProfile(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveCharacterProfile(profile: CharacterProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('[Character] Error saving profile:', e);
  }
}

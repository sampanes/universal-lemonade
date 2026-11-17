// src/character.ts — Customizable Lemonade Kid Hero (12 Hair Styles & 5 Color Palettes)
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

export interface HairStyleDef {
  id: number;
  name: string;
  icon: string;
  back: string;
  front: string;
}

export const HAIR_STYLES: HairStyleDef[] = [
  // 0: Spiky Mess (boy default)
  {
    id: 0,
    name: 'Spiky Mess',
    icon: '⚡',
    back: '<path d="M 40 70 C 25 50, 20 25, 45 10 C 65 -5, 95 -5, 115 10 C 140 25, 135 50, 120 70 Z" fill="var(--c-hair)" />' +
          '<path d="M 110 20 L 135 15 L 125 35 Z" fill="var(--c-hair)" />' +
          '<path d="M 35 30 L 20 20 L 30 45 Z" fill="var(--c-hair)" />',
    front: '<path d="M 38 48 C 45 35, 55 35, 62 46 C 70 32, 85 30, 92 45 C 98 34, 112 36, 120 50 C 115 40, 105 30, 90 28 C 75 25, 60 28, 48 35 Z" fill="var(--c-hair)" />' +
           '<path d="M 68 28 L 72 12 L 80 26 Z" fill="var(--c-hair)" />' +
           '<path d="M 88 28 L 100 16 L 98 30 Z" fill="var(--c-hair)" />'
  },
  // 1: Side-Swept Swoop
  {
    id: 1,
    name: 'Side Swoop',
    icon: '💫',
    back: '<path d="M 38 65 C 26 45, 30 18, 55 8 C 80 -2, 108 5, 124 22 C 136 38, 134 58, 122 72 Z" fill="var(--c-hair)" />',
    front: '<path d="M 40 46 C 50 25, 80 20, 115 38 C 122 42, 125 52, 122 58 C 118 48, 95 34, 65 38 C 50 40, 42 48, 40 46 Z" fill="var(--c-hair)" />' +
           '<path d="M 42 42 C 35 52, 38 65, 42 70 C 37 62, 36 50, 42 42 Z" fill="var(--c-hair)" />'
  },
  // 2: Winged Wave Part
  {
    id: 2,
    name: 'Winged Waves',
    icon: '🌊',
    back: '<path d="M 35 65 C 22 45, 26 15, 52 8 C 80 0, 105 5, 125 20 C 140 38, 138 58, 125 72 Z" fill="var(--c-hair)" />' +
          '<path d="M 28 50 C 15 45, 12 60, 22 72 C 26 62, 28 56, 28 50 Z" fill="var(--c-hair)" />' +
          '<path d="M 132 50 C 145 45, 148 60, 138 72 C 134 62, 132 56, 132 50 Z" fill="var(--c-hair)" />',
    front: '<path d="M 42 50 C 52 38, 70 38, 76 48 C 82 38, 102 38, 118 50 C 110 40, 95 32, 78 34 C 62 32, 48 40, 42 50 Z" fill="var(--c-hair)" />'
  },
  // 3: Classic Bob with Bangs
  {
    id: 3,
    name: 'Classic Bob',
    icon: '🎀',
    back: '<path d="M 32 60 C 25 35, 35 10, 65 5 C 95 0, 125 15, 128 45 C 130 65, 130 85, 124 95 C 120 75, 122 55, 120 45 C 115 25, 95 15, 65 18 C 45 20, 36 35, 34 55 C 32 75, 36 88, 32 95 C 28 85, 28 65, 32 60 Z" fill="var(--c-hair)" />',
    front: '<path d="M 36 52 L 40 50 L 48 52 L 56 50 L 64 52 L 72 50 L 80 52 L 88 50 L 96 52 L 104 50 L 112 52 L 120 50 C 122 35, 110 24, 80 22 C 50 22, 38 35, 36 52 Z" fill="var(--c-hair)" />'
  },
  // 4: Fluffy Curly Mop
  {
    id: 4,
    name: 'Curly Mop',
    icon: '🐑',
    back: '<path d="M 35 60 C 15 45, 18 15, 45 5 C 70 -5, 105 -5, 125 10 C 145 25, 142 55, 128 70 Z" fill="var(--c-hair)" />' +
          '<circle cx="35" cy="40" r="14" fill="var(--c-hair)"/>' +
          '<circle cx="45" cy="20" r="15" fill="var(--c-hair)"/>' +
          '<circle cx="70" cy="10" r="16" fill="var(--c-hair)"/>' +
          '<circle cx="95" cy="10" r="16" fill="var(--c-hair)"/>' +
          '<circle cx="120" cy="22" r="15" fill="var(--c-hair)"/>' +
          '<circle cx="128" cy="45" r="14" fill="var(--c-hair)"/>',
    front: '<path d="M 40 48 C 50 35, 65 38, 72 48 C 80 36, 95 38, 105 45 C 115 38, 122 46, 120 54 C 115 40, 95 28, 78 30 C 60 28, 48 38, 40 48 Z" fill="var(--c-hair)" />' +
           '<circle cx="60" cy="35" r="8" fill="var(--c-hair)"/>' +
           '<circle cx="90" cy="34" r="8" fill="var(--c-hair)"/>'
  },
  // 5: Wavy Shoulder Curls
  {
    id: 5,
    name: 'Wavy Curls',
    icon: '✨',
    back: '<path d="M 32 60 C 20 40, 25 15, 55 5 C 85 -5, 115 5, 128 30 C 140 55, 142 85, 130 102 C 124 90, 126 70, 122 55 C 115 30, 95 18, 65 18 C 45 20, 36 35, 34 55 C 30 75, 36 92, 28 102 C 22 88, 24 68, 32 60 Z" fill="var(--c-hair)" />' +
          '<circle cx="28" cy="88" r="9" fill="var(--c-hair)"/>' +
          '<circle cx="132" cy="88" r="9" fill="var(--c-hair)"/>',
    front: '<path d="M 40 48 C 52 35, 70 38, 78 48 C 86 36, 105 36, 120 50 C 112 36, 95 28, 78 30 C 60 28, 48 38, 40 48 Z" fill="var(--c-hair)" />'
  },
  // 6: High Side Ponytail
  {
    id: 6,
    name: 'High Pony',
    icon: '🐎',
    back: '<path d="M 38 65 C 26 45, 30 18, 55 8 C 80 -2, 108 5, 124 22 C 136 38, 134 58, 122 72 Z" fill="var(--c-hair)" />' +
          '<path d="M 45 25 C 20 18, 10 35, 14 62 C 8 48, 10 25, 35 15 Z" fill="var(--c-hair)" />' +
          '<ellipse cx="40" cy="22" rx="7" ry="5" fill="var(--c-uniform)" />',
    front: '<path d="M 40 46 C 50 32, 80 30, 118 45 C 112 36, 95 28, 75 28 C 55 28, 44 38, 40 46 Z" fill="var(--c-hair)" />'
  },
  // 7: Twin Pigtails
  {
    id: 7,
    name: 'Pigtails',
    icon: '👧',
    back: '<path d="M 38 65 C 26 45, 30 18, 55 8 C 80 -2, 108 5, 124 22 C 136 38, 134 58, 122 72 Z" fill="var(--c-hair)" />' +
          '<path d="M 30 55 C 12 58, 8 78, 16 92 C 16 80, 18 68, 30 62 Z" fill="var(--c-hair)" />' +
          '<ellipse cx="28" cy="60" rx="5" ry="4" fill="var(--c-uniform)" />' +
          '<path d="M 130 55 C 148 58, 152 78, 144 92 C 144 80, 142 68, 130 62 Z" fill="var(--c-hair)" />' +
          '<ellipse cx="132" cy="60" rx="5" ry="4" fill="var(--c-uniform)" />',
    front: '<path d="M 42 50 C 50 38, 70 38, 76 48 C 82 38, 102 38, 118 50 C 110 40, 95 32, 78 34 C 62 32, 48 40, 42 50 Z" fill="var(--c-hair)" />'
  },
  // 8: Double Afro Buns
  {
    id: 8,
    name: 'Afro Buns',
    icon: '🧁',
    back: '<path d="M 38 65 C 26 45, 30 18, 55 8 C 80 -2, 108 5, 124 22 C 136 38, 134 58, 122 72 Z" fill="var(--c-hair)" />' +
          '<circle cx="28" cy="25" r="18" fill="var(--c-hair)" />' +
          '<circle cx="22" cy="20" r="10" fill="var(--c-hair)" />' +
          '<circle cx="34" cy="16" r="11" fill="var(--c-hair)" />' +
          '<ellipse cx="38" cy="34" rx="6" ry="4" fill="var(--c-uniform)" />' +
          '<circle cx="132" cy="25" r="18" fill="var(--c-hair)" />' +
          '<circle cx="138" cy="20" r="10" fill="var(--c-hair)" />' +
          '<circle cx="126" cy="16" r="11" fill="var(--c-hair)" />' +
          '<ellipse cx="122" cy="34" rx="6" ry="4" fill="var(--c-uniform)" />',
    front: '<path d="M 42 46 C 52 35, 70 35, 78 45 C 86 35, 105 35, 118 46 C 110 34, 95 28, 78 28 C 60 28, 48 35, 42 46 Z" fill="var(--c-hair)" />'
  },
  // 9: Long Straight with Bangs
  {
    id: 9,
    name: 'Long Straight',
    icon: '⭐',
    back: '<path d="M 32 50 C 26 30, 35 10, 65 5 C 95 0, 125 15, 128 40 C 132 70, 136 100, 132 125 C 124 100, 124 70, 122 50 C 115 25, 95 18, 65 18 C 45 20, 36 30, 34 50 C 30 75, 28 105, 24 125 C 22 100, 26 70, 32 50 Z" fill="var(--c-hair)" />',
    front: '<path d="M 36 50 L 42 48 L 50 50 L 60 48 L 70 50 L 80 48 L 90 50 L 100 48 L 110 50 L 118 48 C 120 34, 110 24, 80 22 C 50 22, 38 34, 36 50 Z" fill="var(--c-hair)" />'
  },
  // 10: Jagged Wild Spikes
  {
    id: 10,
    name: 'Wild Spikes',
    icon: '🔥',
    back: '<path d="M 35 70 C 18 50, 15 20, 45 8 C 70 -5, 105 -5, 125 10 C 148 25, 142 55, 128 72 Z" fill="var(--c-hair)" />' +
          '<path d="M 25 35 L 5 25 L 18 48 Z" fill="var(--c-hair)" />' +
          '<path d="M 135 35 L 155 25 L 142 48 Z" fill="var(--c-hair)" />' +
          '<path d="M 80 5 L 85 -10 L 98 6 Z" fill="var(--c-hair)" />',
    front: '<path d="M 38 48 L 48 34 L 56 46 L 68 30 L 78 48 L 90 32 L 100 46 L 112 34 L 122 50 C 112 36, 96 26, 78 28 C 58 28, 46 38, 38 48 Z" fill="var(--c-hair)" />'
  },
  // 11: Sleek Side Part
  {
    id: 11,
    name: 'Sleek Part',
    icon: '🌟',
    back: '<path d="M 38 65 C 26 45, 30 18, 55 8 C 80 -2, 108 5, 124 22 C 136 38, 134 58, 122 72 Z" fill="var(--c-hair)" />',
    front: '<path d="M 40 44 C 55 30, 85 28, 122 45 C 115 36, 95 28, 75 28 C 55 28, 44 36, 40 44 Z" fill="var(--c-hair)" />' +
           '<path d="M 115 42 C 122 48, 124 60, 122 68 C 118 60, 118 50, 115 42 Z" fill="var(--c-hair)" />'
  }
];

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
        hairStyle: Math.min(Math.max(parsed.hairStyle ?? 0, 0), HAIR_STYLES.length - 1),
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

export function saveCharacterProfile(profile: CharacterProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('[Character] Error saving profile:', e);
  }
}

export function renderKidAvatarSVG(
  profile: CharacterProfile,
  size: number = 140,
  options: { showBody?: boolean; cheering?: boolean } = {}
): string {
  const hair = HAIR_STYLES[profile.hairStyle % HAIR_STYLES.length] || HAIR_STYLES[0];
  const skin = SKIN_PALETTES[profile.skinTone % SKIN_PALETTES.length] || SKIN_PALETTES[1];
  const hairC = HAIR_PALETTES[profile.hairColor % HAIR_PALETTES.length] || HAIR_PALETTES[1];
  const uniform = UNIFORM_PALETTES[profile.uniformColor % UNIFORM_PALETTES.length] || UNIFORM_PALETTES[0];

  const h = Math.round(size * 170 / 160);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 170" width="${size}" height="${h}" style="--c-skin:${skin.base}; --c-skin-shadow:${skin.shadow}; --c-blush:${skin.blush}; --c-hair:${hairC.base}; --c-hair-high:${hairC.highlight}; --c-uniform:${uniform.base}; --c-uniform-dark:${uniform.shadow};" class="kid-hero-avatar">
  <g class="kid-avatar-wrap">
    <!-- 1. BACK HAIR -->
    <g class="hair-back">${hair.back}</g>

    <!-- 2. EARS -->
    <circle cx="38" cy="62" r="9" fill="var(--c-skin)" />
    <circle cx="38" cy="62" r="5" fill="var(--c-skin-shadow)" opacity="0.5" />
    <circle cx="122" cy="62" r="9" fill="var(--c-skin)" />
    <circle cx="122" cy="62" r="5" fill="var(--c-skin-shadow)" opacity="0.5" />

    <!-- 3. HEAD & NECK -->
    <path d="M 68 85 L 68 102 L 92 102 L 92 85 Z" fill="var(--c-skin-shadow)" />
    <path d="M 40 58 C 40 32, 60 22, 80 22 C 100 22, 120 32, 120 58 C 120 84, 102 96, 80 96 C 58 96, 40 84, 40 58 Z" fill="var(--c-skin)" />

    <!-- 4. CHEEKS BLUSH -->
    <ellipse cx="54" cy="68" rx="8" ry="5" fill="var(--c-blush)" opacity="0.6" />
    <ellipse cx="106" cy="68" rx="8" ry="5" fill="var(--c-blush)" opacity="0.6" />

    <!-- 5. HAPPY CRESCENT EYES (CUTE SMILE EYES) -->
    <path d="M 52 56 C 56 50, 64 50, 68 56" fill="none" stroke="#2B1D1D" stroke-width="3.5" stroke-linecap="round" />
    <path d="M 92 56 C 96 50, 104 50, 108 56" fill="none" stroke="#2B1D1D" stroke-width="3.5" stroke-linecap="round" />
    <!-- Eyebrows -->
    <path d="M 50 48 C 55 44, 64 45, 68 49" fill="none" stroke="var(--c-hair)" stroke-width="2.5" stroke-linecap="round" />
    <path d="M 92 49 C 96 45, 105 44, 110 48" fill="none" stroke="var(--c-hair)" stroke-width="2.5" stroke-linecap="round" />

    <!-- 6. BIG CHEERFUL LAUGHING MOUTH -->
    <path d="M 66 68 C 66 68, 80 66, 94 68 C 96 78, 92 88, 80 88 C 68 88, 64 78, 66 68 Z" fill="#991B1B" />
    <!-- Tongue -->
    <path d="M 72 82 C 75 78, 85 78, 88 82 C 86 86, 74 86, 72 82 Z" fill="#F472B6" />
    <!-- White Top Teeth line -->
    <path d="M 69 70 C 74 69, 86 69, 91 70 L 90 73 C 85 72, 75 72, 70 73 Z" fill="#FFFFFF" />

    <!-- 7. TORSO & CLOTHES -->
    <!-- White Shirt -->
    <path d="M 44 114 L 56 98 L 104 98 L 116 114 L 124 165 L 36 165 Z" fill="#FFFFFF" />
    <!-- White Collar flaps -->
    <path d="M 64 98 L 80 114 L 68 116 Z" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="1" />
    <path d="M 96 98 L 80 114 L 92 116 Z" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="1" />

    <!-- APRON / UNIFORM -->
    <path d="M 58 112 L 102 112 L 106 165 L 54 165 Z" fill="var(--c-uniform)" />
    <!-- Apron Neck Strap -->
    <path d="M 64 112 L 64 100 L 70 100 L 70 112 Z" fill="var(--c-uniform-dark)" />
    <path d="M 96 112 L 96 100 L 90 100 L 90 112 Z" fill="var(--c-uniform-dark)" />
    <!-- Apron Pocket / Hem Accent -->
    <path d="M 66 130 C 66 128, 94 128, 94 130 L 92 148 C 92 152, 68 152, 68 148 Z" fill="var(--c-uniform-dark)" opacity="0.3" />

    <!-- 8. RAISED RIGHT ARM (PUMPING FIST!) -->
    <path d="M 112 112 C 122 100, 134 82, 138 65 L 148 70 C 144 90, 130 112, 118 124 Z" fill="var(--c-skin)" />
    <!-- Sleeve cuff -->
    <ellipse cx="116" cy="118" rx="8" ry="6" fill="#FFFFFF" transform="rotate(-30 116 118)" />
    <!-- Clenched Victory Fist -->
    <circle cx="142" cy="58" r="9" fill="var(--c-skin)" />
    <ellipse cx="140" cy="54" rx="5" ry="4" fill="var(--c-skin-shadow)" opacity="0.4" />
    <ellipse cx="146" cy="58" rx="4" ry="5" fill="var(--c-skin)" />

    <!-- 9. LEFT ARM & RESTING HAND -->
    <path d="M 44 114 C 36 124, 30 138, 38 150 L 48 146 C 42 136, 46 126, 52 118 Z" fill="var(--c-skin)" />
    <circle cx="42" cy="150" r="7" fill="var(--c-skin)" />

    <!-- 10. FRONT HAIR (BANGS / TUFTS OVER FOREHEAD) -->
    <g class="hair-front">${hair.front}</g>
  </g>
</svg>`;
}

// src/ui/houseArt.js -- the family house pictures (My House column, build scene, day scene).
import { HOUSE_STEPS, HOUSE_COLORS } from '../data/house.ts';

// My House (src/data/house.ts). Four pictures (art_src/build_house_art.py), each with a
// walls mask for the paint color; standX is where the stand on the driveway is (0 to 1 across
// the picture), so the day scene can put the kid's booth right over it.
const HOUSE_ART = {
  onestory: { pic: './sprites/house/house_onestory.webp', walls: './sprites/house/walls_onestory.png', standX: 0.76 },
  base: { pic: './sprites/house/house_base.webp', walls: './sprites/house/walls_base.png', standX: 0.76 },
  treehouse: { pic: './sprites/house/house_treehouse.webp', walls: './sprites/house/walls_treehouse.png', standX: 0.77 },
  hq: { pic: './sprites/house/house_hq.webp', walls: './sprites/house/walls_hq.png', standX: 0.82 },
};
export const HOUSE_PIC = HOUSE_ART.base.pic;     // the Money Bag row's picture
export function houseArtFor(level) {
  return level >= 4 ? HOUSE_ART.hq : level >= 3 ? HOUSE_ART.treehouse : level >= 2 ? HOUSE_ART.base : HOUSE_ART.onestory;
}
// Bunting along the roof and balloons by the fence, in the pictures' own coordinates
// (1448 x 1086 source canvas).
function housePartySVG() {
  const ink = '#4a2040';
  const colors = ['#f472b6', '#facc15', '#a78bfa', '#34d399', '#60a5fa'];
  const strings = [[[95, 470], [300, 330], [455, 110]], [[490, 110], [690, 290], [880, 405]]];
  let svg = '';
  strings.forEach(([a, c, b], si) => {
    svg += `<path d="M${a} Q${c} ${b}" fill="none" stroke="${ink}" stroke-width="6"/>`;
    for (let k = 1; k < 8; k++) {
      const u = k / 8, v = 1 - u;
      const x = v * v * a[0] + 2 * u * v * c[0] + u * u * b[0];
      const y = v * v * a[1] + 2 * u * v * c[1] + u * u * b[1];
      svg += `<path d="M${(x - 22).toFixed(0)} ${y.toFixed(0)} L${(x + 22).toFixed(0)} ${y.toFixed(0)} L${x.toFixed(0)} ${(y + 46).toFixed(0)} Z" fill="${colors[(k + si * 3) % colors.length]}" stroke="${ink}" stroke-width="6" stroke-linejoin="round"/>`;
    }
  });
  const tie = [92, 700];
  [[70, 515, '#f472b6'], [160, 455, '#facc15'], [150, 575, '#a78bfa']].forEach(([x, y, fill]) => {
    svg += `<path d="M${x} ${y + 56} Q${x + 14} ${(y + tie[1]) / 2} ${tie[0]} ${tie[1]}" fill="none" stroke="${ink}" stroke-width="4"/>`;
    svg += `<ellipse cx="${x}" cy="${y}" rx="46" ry="56" fill="${fill}" stroke="${ink}" stroke-width="7"/>`;
    svg += `<ellipse cx="${x - 15}" cy="${y - 20}" rx="10" ry="15" fill="#ffffff" opacity="0.65"/>`;
  });
  return `<svg viewBox="0 0 1448 1086" aria-hidden="true">${svg}</svg>`;
}
// The house at a level, painted with a wall color id (HOUSE_COLORS; cream: unpainted).
export function housePicHTML(level, colorId) {
  const art = houseArtFor(level);
  const color = level >= 1 ? HOUSE_COLORS.find(c => c.id === colorId) : null;
  const paint = color && color.id !== 'cream'
    ? `<div class="house-paint" style="--paint:${color.hex};-webkit-mask-image:url(${art.walls});mask-image:url(${art.walls})"></div>` : '';
  return `<div class="house-art"><img src="${art.pic}" alt="" />${paint}${level >= HOUSE_STEPS.length ? housePartySVG() : ''}</div>`;
}

// Every picture the house can show at a level (for preloading), mask included.
export function houseImageURLs(level) {
  const art = houseArtFor(level);
  return [art.pic, art.walls];
}
export const ALL_HOUSE_IMAGES = Object.values(HOUSE_ART).flatMap(art => [art.pic, art.walls]);

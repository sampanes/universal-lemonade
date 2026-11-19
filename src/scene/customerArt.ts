// Back-view art shares a 64 x 80 canvas. Replace mask URLs with transparent
// PNGs on the same canvas to keep the randomized tints and registration.
function mask(path: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80"><path d="${path}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const hair = [
  mask('M14 32 Q7 7 26 6 Q51 -2 52 24 L48 35 Q31 43 14 32Z'),
  mask('M10 34 Q4 3 33 3 Q55 2 54 35 L57 48 Q49 53 43 43 L44 33 Q23 47 10 34Z'),
  mask('M13 33 Q4 25 12 19 Q6 9 21 10 Q22 0 33 6 Q46 0 48 11 Q60 11 53 23 Q60 37 44 36 Q27 44 13 33Z')
];
const outfits = [
  mask('M24 38 Q32 42 40 38 L52 44 L58 55 L49 60 L46 54 L47 69 Q33 75 17 69 L18 54 L14 60 L5 54 L12 43Z'),
  mask('M22 38 L42 38 L51 44 L56 60 L48 63 L43 55 L50 72 Q32 76 14 72 L20 54 L16 63 L7 59 L12 44Z')
];
const extras = [null, null, mask('M23 52 Q23 46 32 46 Q42 46 42 53 L43 63 Q32 70 22 63Z'),
  mask('M12 15 Q15 0 34 1 Q49 1 53 16 L58 19 Q32 24 9 20Z')];
const skin = mask('M17 23 Q17 7 34 8 Q52 10 48 29 Q46 39 36 40 L39 46 L25 46 L28 39 Q17 35 17 23Z M10 52 L18 56 L13 64 Q6 68 5 62Z M48 55 L55 51 L59 62 Q56 67 52 63Z');
const shoes = mask('M20 65 L30 66 L29 78 L16 78Z M34 66 L44 64 L49 78 L35 78Z');
const clothes = ['#e85c7a', '#288daa', '#9854bd', '#e89029', '#46a777'];
export function dressCustomer(node: HTMLElement, random = Math.random): void {
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  node.replaceChildren();
  function layer(shape: string | null, color: string) {
    if (!shape) return;
    const el = document.createElement('i');
    el.style.maskImage = shape;
    el.style.backgroundColor = color;
    node.append(el);
  }
  layer(shoes, '#4a4359');
  layer(skin, pick(['#ffd5ae', '#db9972', '#a97050', '#784935']));
  layer(pick(outfits), pick(clothes));
  layer(pick(hair), pick(['#51352e', '#252338', '#a95734', '#e9b85b']));
  layer(pick(extras), pick(clothes));
}

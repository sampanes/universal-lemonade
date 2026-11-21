import catalog from '../../public/sprites/kid_back/kid_back.json';
import { HAIR_PALETTES, SKIN_PALETTES, UNIFORM_PALETTES } from '../character';
import type { LoadPriority } from '../preload';

const standing = catalog.items.filter(item => item.sheet <= 3);
// The sheet mixes camera angles. Only these bodies have a clear rear landmark.
const rearOutfits = ['outfit_coveralls', 'outfit_denim_jacket', 'outfit_blazer_skirt', 'outfit_hoodie'];
const outfits = standing.filter(item => rearOutfits.includes(item.id));
const hair = standing.filter(item => item.cat === 'hair');
const handProps = standing.filter(item => ['prop_cellphone', 'prop_handheld_console', 'prop_teddy_bear'].includes(item.id));
const wheelchairs = catalog.items.filter(item => item.cat === 'full_characters' && item.id.endsWith('_right'));
const caps = ['hat_baseball_snapback', 'hat_beanie_slouchy', 'acc_pirate_bandana'];
const shortHair = ['hair_spiky', 'hair_sidepart', 'hair_curly_mop', 'hair_flared_wings'];
// Distance from the top of the PNG to the collar, excluding dangling braids and ties.
const collarOffsets: Record<string, number> = {
  hair_long_braid: 146, hair_side_ponytail: 179, hair_double_buns: 150, hair_pigtails: 152,
};

type RGB = number[];
function rgb(hex: string): RGB {
  return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
}

const spriteCache = new Map<string, Promise<HTMLImageElement>>();
const spriteReady = new Set<string>();   // files already decoded
function loadSprite(file: string, priority: LoadPriority = 'auto') {
  let pending = spriteCache.get(file);
  if (!pending) {
    const image = new Image();
    image.fetchPriority = priority;
    image.src = './sprites/kid_back/' + file;
    pending = image.decode().then(() => { spriteReady.add(file); return image; }).catch(error => {
      spriteCache.delete(file);
      throw error;
    });
    spriteCache.set(file, pending);
  }
  return pending;
}

// Every sprite a customer can be drawn from, loaded in the background one at a time (low
// priority, so it never slows down a picture that is about to show).
export async function preloadCustomers(): Promise<void> {
  const files = [...outfits, ...hair, ...handProps, ...wheelchairs].map(item => item.file)
    .concat(caps.map(cap => 'headwear/' + cap + '.png'));
  for (const file of files) await loadSprite(file, 'low').catch(() => null);
}

interface Layer { file: string; x: number; y: number; width: number; color: RGB }
function paint(ctx: CanvasRenderingContext2D, image: HTMLImageElement, layer: Layer, skin: RGB) {
  const tile = document.createElement('canvas');
  tile.width = layer.width;
  tile.height = Math.round(layer.width * image.height / image.width);
  const ink = tile.getContext('2d')!;
  ink.drawImage(image, 0, 0, tile.width, tile.height);
  const pixels = ink.getImageData(0, 0, tile.width, tile.height);
  const data = pixels.data;
  const peach = [255, 218, 195];
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // The originals use peach for exposed skin and plum-gray for tintable material.
    if (r > b + 24 && g > b && r > g) {
      for (let c = 0; c < 3; c++) data[i + c] *= skin[c] / peach[c];
    } else {
      const light = g / 255;
      const weight = 0.82 * Math.sin(Math.PI * light) ** 2;
      for (let c = 0; c < 3; c++) data[i + c] += (layer.color[c] - 144) * weight;
    }
  }
  ink.putImageData(pixels, 0, 0);
  ctx.drawImage(tile, layer.x, layer.y);
}

// A random customer, seen from behind, painted on a canvas of its own. Resolves once the
// canvas is fully painted, so the scene can draw the next customer ahead of time and swap it
// in without a blank frame. seated: in a wheelchair (rolls instead of walking).
export interface Customer { canvas: HTMLCanvasElement; seated: boolean }
export async function drawCustomer(random = Math.random): Promise<Customer> {
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  // While the sprites are still loading, customers are made from the ones already in.
  const pickSprite = <T extends { file: string }>(items: T[]) => {
    const loaded = items.filter(item => spriteReady.has(item.file));
    return pick(loaded.length ? loaded : items);
  };
  const seated = random() < 0.125;
  const clothes = rgb(pick(UNIFORM_PALETTES).base);
  const skin = rgb(pick(SKIN_PALETTES).base);
  const layers: Layer[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = 374;
  canvas.height = 520;
  if (seated) {
    const chair = pickSprite(wheelchairs);
    const width = Math.round(chair.width * 0.617);
    layers.push({ file: chair.file, x: (canvas.width - width) / 2,
      y: canvas.height - Math.round(chair.height * width / chair.width), width, color: clothes });
  } else {
    const outfit = pickSprite(outfits);
    const style = pickSprite(outfit.id === 'outfit_hoodie' ? hair.filter(h => shortHair.includes(h.id)) : hair);
    const collarX = 184;
    const collarY = canvas.height - outfit.height;
    const outfitX = collarX - outfit.width * 0.46;
    layers.push({ file: outfit.file, x: outfitX, y: collarY, width: outfit.width, color: clothes });
    // Register the skull to the collar. A braid or ponytail can extend below the neck.
    const neck = collarOffsets[style.id] ?? style.height - 28;
    const hairY = collarY - neck;
    const hairX = collarX - style.width * (style.id === 'hair_side_ponytail' ? 0.39 : 0.5);
    layers.push({ file: style.file, x: hairX, y: hairY, width: style.width, color: rgb(pick(HAIR_PALETTES.slice(0, 6)).base) });
    if (shortHair.includes(style.id) && random() < 0.3) {
      layers.push({ file: 'headwear/' + pick(caps) + '.png', x: collarX - 102, y: hairY - 4, width: 204, color: clothes });
    }
    if (random() < 0.28) {
      const prop = pickSprite(handProps);
      layers.push({ file: prop.file, x: outfitX - 6, y: collarY + outfit.height * 0.44, width: 52, color: rgb(pick(UNIFORM_PALETTES).base) });
    }
  }
  const images = await Promise.all(layers.map(layer => loadSprite(layer.file)));
  const ctx = canvas.getContext('2d')!;
  layers.forEach((layer, i) => paint(ctx, images[i], layer, skin));
  return { canvas, seated };
}

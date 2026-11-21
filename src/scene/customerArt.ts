import catalog from '../../public/sprites/kid_back/kid_back.json';
import { HAIR_PALETTES, SKIN_PALETTES, UNIFORM_PALETTES } from '../character';
import { whenIdle, type LoadPriority } from '../preload';

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

// Called once the page is idle: every sprite a customer can be drawn from is loaded in the
// background one at a time (low priority, so it never slows down a picture that is about to
// show), then the pool of looks below is drawn.
export async function prepareCustomers(): Promise<void> {
  const files = [...outfits, ...hair, ...handProps, ...wheelchairs].map(item => item.file)
    .concat(caps.map(cap => 'headwear/' + cap + '.png'));
  for (const file of files) await loadSprite(file, 'low').catch(() => null);
  void keepDrawing();
}

// The day scene shows a crowd, so customers are drawn ahead of time into a pool of looks
// (drawing one takes a moment, copying one is instant) and the scene copies a look for each
// person it shows. Looks are kept at LOOK_SCALE, still sharper than the scene shows them.
const POOL = 16;
const LOOK_SCALE = 0.6;
const looks: Customer[] = [];
let oldest = 0;          // the look replaced next when freshening
let stale = 0;           // looks still to be replaced with new ones
let urgent = 0;          // draw without waiting for idle moments until there are this many
let paused = false;      // the day scene is playing: no drawing (it could cost a frame)
let running = false;
const waiters: { count: number; resolve: () => void }[] = [];

async function drawLook(): Promise<Customer> {
  const full = await drawCustomer();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(full.canvas.width * LOOK_SCALE);
  canvas.height = Math.round(full.canvas.height * LOOK_SCALE);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(full.canvas, 0, 0, canvas.width, canvas.height);
  return { canvas, seated: full.seated };
}

// Looks the scene is waiting for are drawn even while it plays (better than nobody there).
const wanted = () => looks.length < urgent || (!paused && (looks.length < POOL || stale > 0));
async function keepDrawing(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (wanted()) {
      if (looks.length >= urgent) {
        await new Promise<void>(resolve => whenIdle(resolve));
        if (!wanted()) break;
      }
      const look = await drawLook();
      if (looks.length < POOL) looks.push(look);
      else { looks[oldest] = look; oldest = (oldest + 1) % POOL; stale--; }
      for (const waiter of waiters.filter(w => looks.length >= w.count)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve();
      }
    }
  } catch (error) {
    console.warn('Customer art could not load', error);
  } finally {
    running = false;
  }
}

// Resolves once there are count looks to copy (drawing them right away if they are not in yet).
export function customersReady(count: number): Promise<void> {
  count = Math.min(count, POOL);
  if (looks.length >= count) return Promise.resolve();
  urgent = Math.max(urgent, count);
  void keepDrawing();
  return new Promise(resolve => waiters.push({ count, resolve }));
}

// The day scene stops the drawing while it plays and asks for some new faces when it ends.
export function pauseCustomers(pause: boolean): void {
  paused = pause;
  if (!pause) void keepDrawing();
}
export function freshenCustomers(count: number): void {
  stale = Math.min(POOL, stale + count);
  if (!paused) void keepDrawing();
}

// A copy of one of the looks (index wraps around), or null if none is drawn yet.
export function copyCustomer(index: number): Customer | null {
  if (!looks.length) return null;
  const look = looks[index % looks.length];
  const canvas = document.createElement('canvas');
  canvas.width = look.canvas.width;
  canvas.height = look.canvas.height;
  canvas.getContext('2d')!.drawImage(look.canvas, 0, 0);
  return { canvas, seated: look.seated };
}

interface Layer { file: string; x: number; y: number; width: number; color: RGB }
function paint(ctx: CanvasRenderingContext2D, image: HTMLImageElement, layer: Layer, skin: RGB) {
  const tile = document.createElement('canvas');
  tile.width = layer.width;
  tile.height = Math.round(layer.width * image.height / image.width);
  const ink = tile.getContext('2d', { willReadFrequently: true })!;
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

// A random customer, seen from behind, painted on a canvas of its own (resolves once fully
// painted). seated: in a wheelchair (rolls instead of walking).
export interface Customer { canvas: HTMLCanvasElement; seated: boolean }
async function drawCustomer(random = Math.random): Promise<Customer> {
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

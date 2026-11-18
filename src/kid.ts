// src/kid.ts -- the player's kid, stacked from paper-doll layers (public/sprites/kid/, built by
// art_src/build_kid_art.py) and recolored with the kid's picks.
//
// Layers share one canvas: body, face (plus a light rim on dark skin), hair. A recolorable
// layer comes as <name>_shade.png (R = lightness, G = region id * 60, A = coverage) under
// <name>_fixed.png (outline and anything that never changes color).
import { SKIN_PALETTES, HAIR_PALETTES, UNIFORM_PALETTES } from './character';
import type { CharacterProfile } from './types';

export type KidMood = 'happy' | 'cheer' | 'soldout' | 'calm' | 'sleepy' | 'wink';

interface KidManifest {
  w: number;
  h: number;
  L0: Record<string, number>;
  hairs: { id: string; L0: number }[];
  faces: string[];
  head: [number, number, number, number];
}

const DIR = './sprites/kid/';
const REGION = { skin: 1, shirt: 2, apron: 3, hair: 4 } as const;
const SHIRT = '#FFFFFF';
const DARK_SKIN_FROM = 3;   // skin palettes from here on get the light rim around face lines

let manifest: KidManifest | null = null;
const images = new Map<string, HTMLImageElement>();
const shades = new Map<string, ImageData>();
const cache = new Map<string, string>();
let loading: Promise<void> | null = null;

function loadImage(name: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`kid art missing: ${name}`));
    im.src = `${DIR}${name}.png`;
  });
}

function canvas(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d', { willReadFrequently: true })!;
}

/** Loads the layers once. Resolves when kidImageURL can draw. */
export function loadKidArt(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      const m: KidManifest = await (await fetch(`${DIR}kid.json`)).json();
      const names = ['body_fixed', 'body_shade',
        ...m.hairs.flatMap(h => [`hair_${h.id}_fixed`, `hair_${h.id}_shade`]),
        ...m.faces.flatMap(f => [`face_${f}`, `face_${f}_rim`])];
      const loaded = await Promise.all(names.map(loadImage));
      names.forEach((n, i) => images.set(n, loaded[i]));
      for (const n of names.filter(x => x.endsWith('_shade'))) {
        const ctx = canvas(m.w, m.h);
        ctx.drawImage(images.get(n)!, 0, 0);
        shades.set(n, ctx.getImageData(0, 0, m.w, m.h));
      }
      manifest = m;
    })();
  }
  return loading;
}

export function kidArtReady(): boolean {
  return manifest !== null;
}

export function kidHairCount(): number {
  return manifest ? manifest.hairs.length : 0;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

// Lightness -> picked color: darker than the region's middle tone scales the color down,
// lighter blends it toward white (the shine). Same rule as the art build's preview.
function tint(src: ImageData, colors: Record<number, [number, number, number]>, L0: Record<number, number>): ImageData {
  const out = new ImageData(src.width, src.height);
  const s = src.data, d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3];
    if (!a) continue;
    const id = Math.round(s[i + 1] / 60);
    const c = colors[id];
    if (!c) continue;
    const l = s[i] / 255, mid = L0[id];
    for (let ch = 0; ch < 3; ch++) {
      const v = l <= mid ? c[ch] * (l / mid) : c[ch] + (1 - c[ch]) * Math.min(1, (l - mid) / (1 - mid)) * 0.9;
      d[i + ch] = Math.round(Math.max(0, Math.min(1, v)) * 255);
    }
    d[i + 3] = a;
  }
  return out;
}

function drawTinted(ctx: CanvasRenderingContext2D, data: ImageData) {
  const tmp = canvas(data.width, data.height);
  tmp.putImageData(data, 0, 0);
  ctx.drawImage(tmp.canvas, 0, 0);
}

/**
 * The kid as a PNG data URL (cached), or null until loadKidArt() finishes.
 * head = true gives the square head-and-hair crop used for small pictures.
 */
export function kidImageURL(p: CharacterProfile, mood: KidMood = 'happy', head = false): string | null {
  const m = manifest;
  if (!m) return null;
  const hair = m.hairs[((p.hairStyle % m.hairs.length) + m.hairs.length) % m.hairs.length];
  const face = m.faces.includes(mood) ? mood : 'happy';
  const key = [hair.id, p.skinTone, p.hairColor, p.uniformColor, face, head ? 1 : 0].join('/');
  const hit = cache.get(key);
  if (hit) return hit;

  const skin = SKIN_PALETTES[p.skinTone % SKIN_PALETTES.length];
  const hairC = HAIR_PALETTES[p.hairColor % HAIR_PALETTES.length];
  const apron = UNIFORM_PALETTES[p.uniformColor % UNIFORM_PALETTES.length];
  const ctx = canvas(m.w, m.h);
  drawTinted(ctx, tint(shades.get('body_shade')!,
    { [REGION.skin]: rgb(skin.base), [REGION.shirt]: rgb(SHIRT), [REGION.apron]: rgb(apron.base) },
    { [REGION.skin]: m.L0.skin, [REGION.shirt]: m.L0.shirt, [REGION.apron]: m.L0.apron }));
  ctx.drawImage(images.get('body_fixed')!, 0, 0);
  if (p.skinTone % SKIN_PALETTES.length >= DARK_SKIN_FROM) ctx.drawImage(images.get(`face_${face}_rim`)!, 0, 0);
  ctx.drawImage(images.get(`face_${face}`)!, 0, 0);
  drawTinted(ctx, tint(shades.get(`hair_${hair.id}_shade`)!, { [REGION.hair]: rgb(hairC.base) }, { [REGION.hair]: hair.L0 }));
  ctx.drawImage(images.get(`hair_${hair.id}_fixed`)!, 0, 0);

  let url: string;
  if (head) {
    const [x, y, w, h] = m.head;
    const crop = canvas(w, h);
    crop.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);
    url = crop.canvas.toDataURL('image/png');
  } else {
    url = ctx.canvas.toDataURL('image/png');
  }
  cache.set(key, url);
  return url;
}

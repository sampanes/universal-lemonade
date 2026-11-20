// src/kid.ts -- the player's kid, stacked from paper-doll layers (public/sprites/kid/, built by
// art_src/build_kid_art.py) and recolored with the kid's picks.
//
// Layers share one canvas: body, a skin-tinted rim on dark skin, hair, then the face on top
// (eyes and brows show through bangs, like anime). A recolorable
// layer comes as <name>_shade.png (R = lightness, G = region id * 60, A = coverage) under
// <name>_fixed.png (outline and anything that never changes color).
import { SKIN_PALETTES, HAIR_PALETTES, UNIFORM_PALETTES } from './character';
import type { HairFx, HairPalette } from './character';
import type { CharacterProfile } from './types';

import { HATS, SHADES, accessoryURL } from './headwear';

export type KidMood = 'happy' | 'cheer' | 'soldout' | 'calm' | 'sleepy' | 'wink'
  | 'grumpy' | 'smug' | 'surprised' | 'ennui' | 'sly' | 'determined';

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
const DARK_SKIN_FROM = 3;   // skin palettes from here on get a rim around the face lines
const RIM_LIGHTEN = 0.22;   // rim color: the skin moved this far toward white

let manifest: KidManifest | null = null;
const images = new Map<string, HTMLImageElement>();
const shades = new Map<string, ImageData>();
const cache = new Map<string, string>();
let loading: Promise<void> | null = null;

function loadImage(name: string, url = `${DIR}${name}.png`): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`kid art missing: ${name}`));
    im.src = url;
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
      const loaded = await Promise.all(names.map(name => loadImage(name)));
      names.forEach((n, i) => images.set(n, loaded[i]));
      for (const n of names.filter(x => x.endsWith('_shade'))) {
        const ctx = canvas(m.w, m.h);
        ctx.drawImage(images.get(n)!, 0, 0);
        shades.set(n, ctx.getImageData(0, 0, m.w, m.h));
      }
      await Promise.all([...HATS, SHADES].map(async item => {
        try { images.set(item.id, await loadImage(item.id, accessoryURL(item.id))); }
        catch (err) { console.warn(err); }
      }));
      manifest = m;
    })();
  }
  return loading;
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

// The rim art is a white mask; paint it a shade lighter than the skin.
function rimLayer(face: string, skinHex: string): HTMLCanvasElement {
  const mask = images.get(`face_${face}_rim`)!;
  const ctx = canvas(mask.width, mask.height);
  ctx.drawImage(mask, 0, 0);
  const c = rgb(skinHex).map(v => Math.round((v + (1 - v) * RIM_LIGHTEN) * 255));
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  ctx.fillRect(0, 0, mask.width, mask.height);
  return ctx.canvas;
}

// ---- Special hair (HairFx): a color per pixel instead of one color.
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t) as RGB;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
function hsl(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map(n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))) as RGB;
}
const CANDY: RGB[] = [rgb('#FF9FD2'), rgb('#9FD4FF')];
const GALAXY: RGB[] = [rgb('#2E2A7A'), rgb('#7B2FBF'), rgb('#D9468F')];
const GLITTER: RGB[] = [rgb('#D9A7FF'), rgb('#FFC2EA')];

/** The hair color at (u, v), the spot's place across and down the hair (0..1). */
function fxColor(fx: HairFx, u: number, v: number): RGB {
  switch (fx) {
    case 'candy': return mix(CANDY[0], CANDY[1], clamp01((0.35 * u + 0.65 * v - 0.2) / 0.6));
    case 'rainbow': return hsl(((0.45 * u + 0.8 * v) * 300) % 360, 0.9, 0.64);
    case 'galaxy': {
      const t = clamp01(0.3 * u + 0.8 * v - 0.1);
      return t < 0.5 ? mix(GALAXY[0], GALAXY[1], t * 2) : mix(GALAXY[1], GALAXY[2], (t - 0.5) * 2);
    }
    case 'glitter': return mix(GLITTER[0], GLITTER[1], clamp01(v));
  }
}

const boxes = new Map<string, [number, number, number, number]>();   // hair id -> x0, y0, x1, y1
function hairBox(id: string): [number, number, number, number] {
  let b = boxes.get(id);
  if (b) return b;
  const d = shades.get(`hair_${id}_shade`)!;
  let x0 = d.width, y0 = d.height, x1 = 0, y1 = 0;
  for (let y = 0; y < d.height; y++) {
    for (let x = 0; x < d.width; x++) {
      if (d.data[(y * d.width + x) * 4 + 3] > 128) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  b = [x0, y0, Math.max(x1, x0 + 1), Math.max(y1, y0 + 1)];
  boxes.set(id, b);
  return b;
}

/** The hair's color layer: one color, or a special color that changes across the hair. */
function hairFill(hairId: string, L0: number, color: HairPalette): ImageData {
  const src = shades.get(`hair_${hairId}_shade`)!;
  if (!color.fx) return tint(src, { [REGION.hair]: rgb(color.base) }, { [REGION.hair]: L0 });
  const fx = color.fx;
  const [x0, y0, x1, y1] = hairBox(hairId);
  const out = new ImageData(src.width, src.height);
  const s = src.data, d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3];
    if (!a || Math.round(s[i + 1] / 60) !== REGION.hair) continue;
    const px = (i / 4) % src.width, py = Math.floor(i / 4 / src.width);
    const c = fxColor(fx, (px - x0) / (x1 - x0), (py - y0) / (y1 - y0));
    const l = s[i] / 255;
    for (let ch = 0; ch < 3; ch++) {
      const v = l <= L0 ? c[ch] * (l / L0) : c[ch] + (1 - c[ch]) * Math.min(1, (l - L0) / (1 - L0)) * 0.9;
      d[i + ch] = Math.round(clamp01(v) * 255);
    }
    d[i + 3] = a;
  }
  return out;
}

function pick<T>(list: T[], i: number): T {
  return list[((i % list.length) + list.length) % list.length];
}

function worn(p: CharacterProfile) {
  const hat = HATS.find(h => h.id === p.hat);
  return [hat, p.sunglasses ? SHADES : undefined].filter(
    (item): item is typeof SHADES => !!item && images.has(item.id));
}

function frame(p: CharacterProfile, head: boolean): [number, number, number, number] {
  const m = manifest!;
  const base: [number, number, number, number] = head ? m.head : [0, 0, m.w, m.h];
  const hat = HATS.find(h => h.id === p.hat);
  if (!hat) return base;
  const [x, y, w, h] = base;
  const top = Math.min(y, hat.y - 4);
  const height = h + y - top;
  const width = Math.ceil(height * w / h);
  return [x - (width - w) / 2, top, width, height];
}

// AGY's neutral fabric picks up the apron color. Soft light keeps ink and highlights.
const coloredGear = new Map<string, HTMLCanvasElement>();
function coloredHat(id: string, apronIndex: number) {
  const color = pick(UNIFORM_PALETTES, apronIndex).base;
  const key = id + color;
  const hit = coloredGear.get(key);
  if (hit) return hit;
  const im = images.get(id)!;
  const ctx = canvas(im.width, im.height);
  ctx.drawImage(im, 0, 0);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, im.width, im.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(im, 0, 0);
  coloredGear.set(key, ctx.canvas);
  return ctx.canvas;
}

function drawAccessories(ctx: CanvasRenderingContext2D, p: CharacterProfile) {
  for (const item of worn(p)) {
    const im = item.id === SHADES.id ? images.get(item.id)! : coloredHat(item.id, p.uniformColor);
    ctx.drawImage(im, item.x, item.y, item.width, item.width * im.height / im.width);
  }
}

function toURL(ctx: CanvasRenderingContext2D, p: CharacterProfile, head: boolean, paint: 'wear' | 'mask' = 'wear'): string {
  if (!head && !p.hat && !p.sunglasses) return ctx.canvas.toDataURL('image/png');
  const [x, y, w, h] = frame(p, head);
  const out = canvas(w, h);
  out.translate(-x, -y);
  out.drawImage(ctx.canvas, 0, 0);
  if (paint === 'mask') out.globalCompositeOperation = 'destination-out';
  drawAccessories(out, p);
  return out.canvas.toDataURL('image/png');
}

/**
 * The kid as a PNG data URL (cached), or null until loadKidArt() finishes.
 * head = true gives the square head-and-hair crop used for small pictures.
 */
export function kidImageURL(p: CharacterProfile, mood: KidMood = 'happy', head = false): string | null {
  const m = manifest;
  if (!m) return null;
  const hair = pick(m.hairs, p.hairStyle);
  const face = m.faces.includes(mood) ? mood : 'happy';
  const key = [p.hat, !!p.sunglasses, hair.id, p.skinTone, p.hairColor, p.uniformColor, face, head ? 1 : 0].join('/');
  const hit = cache.get(key);
  if (hit) return hit;

  const skin = pick(SKIN_PALETTES, p.skinTone);
  const apron = pick(UNIFORM_PALETTES, p.uniformColor);
  const ctx = canvas(m.w, m.h);
  drawTinted(ctx, tint(shades.get('body_shade')!,
    { [REGION.skin]: rgb(skin.base), [REGION.shirt]: rgb(SHIRT), [REGION.apron]: rgb(apron.base) },
    { [REGION.skin]: m.L0.skin, [REGION.shirt]: m.L0.shirt, [REGION.apron]: m.L0.apron }));
  ctx.drawImage(images.get('body_fixed')!, 0, 0);
  if (p.skinTone % SKIN_PALETTES.length >= DARK_SKIN_FROM) ctx.drawImage(rimLayer(face, skin.base), 0, 0);
  drawTinted(ctx, hairFill(hair.id, hair.L0, pick(HAIR_PALETTES, p.hairColor)));
  ctx.drawImage(images.get(`hair_${hair.id}_fixed`)!, 0, 0);
  // The face goes over the hair, like anime: eyes and brows show through the bangs.
  ctx.drawImage(images.get(`face_${face}`)!, 0, 0);

  const url = toURL(ctx, p, head);
  cache.set(key, url);
  return url;
}

/** The hair style ids, in mirror order. */
export function kidHairIds(): string[] {
  return manifest ? manifest.hairs.map(h => h.id) : [];
}

export interface KidSparkle { x: number; y: number; size: number; delay: number }
export interface KidFx {
  fx: HairFx | '';
  hairFill: string | null;     // rainbow: the hair's color alone, for the flowing-color layer
  hairLines: string | null;    // rainbow: the hair's outline and the face, kept on top of that layer
  sparkles: KidSparkle[];      // glitter and galaxy: spots on the hair, as % of the picture
}

const fxCache = new Map<string, KidFx>();

// Where any face draws (all moods together), so sparkles stay off the eyes and stay put
// when the mood changes.
let faceArea: ImageData | null = null;
function anyFace(): ImageData {
  if (!faceArea) {
    const m = manifest!;
    const ctx = canvas(m.w, m.h);
    for (const f of m.faces) ctx.drawImage(images.get(`face_${f}`)!, 0, 0);
    faceArea = ctx.getImageData(0, 0, m.w, m.h);
  }
  return faceArea;
}

// A small steady random source, so a hair style always gets the same sparkle spots.
function seeded(text: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** What moves on top of the kid picture for special hair (nothing for plain colors). */
export function kidFx(p: CharacterProfile, mood: KidMood = 'happy', head = false): KidFx {
  const none: KidFx = { fx: '', hairFill: null, hairLines: null, sparkles: [] };
  const m = manifest;
  if (!m) return none;
  const color = pick(HAIR_PALETTES, p.hairColor);
  if (!color.fx || color.fx === 'candy') return none;
  const hair = pick(m.hairs, p.hairStyle);
  const face = m.faces.includes(mood) ? mood : 'happy';
  const key = [p.hat, !!p.sunglasses, hair.id, p.hairColor, color.fx === 'rainbow' ? face : '', head ? 1 : 0].join('/');
  const hit = fxCache.get(key);
  if (hit) return hit;

  const fx: KidFx = { fx: color.fx, hairFill: null, hairLines: null, sparkles: [] };
  if (color.fx === 'rainbow') {
    const fill = canvas(m.w, m.h);
    drawTinted(fill, hairFill(hair.id, hair.L0, color));
    fx.hairFill = toURL(fill, p, head, 'mask');
    const lines = canvas(m.w, m.h);
    lines.drawImage(images.get(`hair_${hair.id}_fixed`)!, 0, 0);
    lines.drawImage(images.get(`face_${face}`)!, 0, 0);
    fx.hairLines = toURL(lines, p, head, 'mask');
  } else {
    // Spots well inside the hair, spread apart.
    const [vx, vy, vw, vh] = frame(p, head);
    const overlay = canvas(m.w, m.h);
    drawAccessories(overlay, p);
    const cover = overlay.getImageData(0, 0, m.w, m.h).data;
    const d = shades.get(`hair_${hair.id}_shade`)!;
    const galaxy = color.fx === 'galaxy';
    const want = galaxy ? (head ? 6 : 10) : (head ? 4 : 7);
    const [lo, hi] = galaxy ? (head ? [7, 10] : [3.5, 5.5]) : (head ? [13, 17] : [6.5, 9.5]);
    const gap = (head ? 0.2 : 0.11) * vw;   // pixels between spots
    const rand = seeded(`${hair.id}/${color.id}/${head ? 1 : 0}`);
    const fa = anyFace();
    const solid = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < d.width && y < d.height && d.data[(y * d.width + x) * 4 + 3] > 230 &&
      fa.data[(y * fa.width + x) * 4 + 3] < 20 && cover[(y * m.w + x) * 4 + 3] < 20;
    const placed: [number, number][] = [];
    for (let tries = 0; tries < 4000 && placed.length < want; tries++) {
      const x = Math.floor(vx + rand() * vw), y = Math.floor(vy + rand() * vh);
      if (!solid(x, y) || !solid(x - 4, y) || !solid(x + 4, y) || !solid(x, y - 4) || !solid(x, y + 4)) continue;
      if (placed.some(([px, py]) => Math.hypot(px - x, py - y) < gap)) continue;
      placed.push([x, y]);
      fx.sparkles.push({ x: ((x - vx) / vw) * 100, y: ((y - vy) / vh) * 100, size: lo + rand() * (hi - lo), delay: rand() * 2.4 });
    }
  }
  fxCache.set(key, fx);
  return fx;
}

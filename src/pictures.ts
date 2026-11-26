// src/pictures.ts -- where the game's pictures are served from (public/sprites/, made by the
// scripts in art_src/: cut_sheets.py and build_sticker_art.py for the stickers, the build_*.py
// scripts for the rest). The house pictures are in src/ui/houseArt.js, the kid's paper-doll
// art in src/kid.ts, and each Stand Shop item names its own picture (src/shop.ts).
import type { SeasonName, SupplyItem } from './types';

export const fruitPic = (flavorId: string) => `./sprites/flavors/${flavorId}.png`;
export const brandPic = (id: string) => `./sprites/brand/${id}.png`;
export const yardPic = (id: string) => `./sprites/yard/${id}.png`;
export const trophyPic = (id: string) => `./sprites/trophies/${id}.png`;
export const wallpaperPic = (id: string) => `./sprites/wallpapers/${id}.webp`;
export const storePic = (id: string) => `./sprites/stores/${id}.png`;
// A friend's stand sticker and the neighborhood behind it (the sky cut out by
// art_src/build_backdrop_art.py), by the friend's place picture name (src/ui/places.js).
export const standPic = (place: string) => `./sprites/franchise/${place}.png`;
export const backdropPic = (place: string) => `./sprites/backdrops/${place}.webp`;
// A taste tester's face ('happy', 'sour', 'sweet', 'watery').
export const facePic = (face: string) => `./sprites/faces/taste_${face}.png`;
// The small icons shown beside words (art_src/icons/): a season, 'warning', 'lock'.
export const iconPic = (id: string) => `./sprites/icons/${id}.png`;
export const seasonPic = (season: SeasonName) => iconPic(season.toLowerCase());
export const ALL_ICONS = ['spring', 'summer', 'fall', 'winter', 'warning', 'lock'].map(iconPic);

export const SUPPLY_PICS: Record<SupplyItem, string> = {
  lemons: './sprites/lemon.png',
  sugar: './sprites/sugar_scoop.png',
  ice: './sprites/ice_cubes.png',
  cups: './sprites/lemonade_cup.png',
  bottles: './sprites/shop/bottles.png',
};

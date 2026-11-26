// src/shelf.ts -- what stands on My Shelf (drawn by src/ui/shelf.js): everything the kid has
// bought, in the order it was bought, and the money trophies, won or still to win.
import type { LemonadeEngine } from './engine';
import { SHOP_ITEMS, INVENTION } from './shop';
import { BRAND_STEPS } from './data/brand';
import { TROPHIES, type Trophy } from './data/trophies';
import { YARD_THINGS, YARD_STEPS } from './data/yard';
import { brandPic, yardPic, trophyPic } from './pictures';

// day: the day it was bought or won; null when it is not (yet), or when sim/jump.ts handed a
// thing over without a day.
export interface ShelfItem { pic: string; name: string; cost: number; day: number | null }
export interface ShelfTrophy extends Trophy { pic: string; day: number | null }

// The things bought so far, oldest first: the Stand Shop's things and the squeezer going
// worldwide (bought on the Invention card), the brand moves and the yard things.
export function shelfItems(engine: LemonadeEngine): ShelfItem[] {
  const s = engine.state;
  const project = (id: string, pic: string): ShelfItem | null => {
    const p = engine.projects.find(x => x.id === id);
    return p?.purchased ? { pic, name: p.name, cost: p.costCash, day: s.boughtOn[id] ?? null } : null;
  };
  const items = [
    ...SHOP_ITEMS.map(({ id, pic }) => project(id, pic)),
    project('global_licensing', INVENTION.worldPic),
    ...BRAND_STEPS.slice(0, s.brandLevel).map(b => ({ pic: brandPic(b.id), name: b.name, cost: b.cost, day: s.boughtOn[`brand:${b.id}`] ?? null })),
    ...s.yard.map((id, i) => ({ pic: yardPic(id), name: YARD_THINGS[id].name, cost: YARD_STEPS[i].cost, day: s.boughtOn[`yard:${id}`] ?? null })),
  ].filter((x): x is ShelfItem => x !== null);
  return items.sort((a, b) => (a.day ?? 0) - (b.day ?? 0));   // a stable sort: the same day keeps this order
}

// Every trophy, won or not.
export function shelfTrophies(engine: LemonadeEngine): ShelfTrophy[] {
  return TROPHIES.map((t, i) => ({ ...t, pic: trophyPic(t.id), day: engine.state.trophyDays[i] ?? null }));
}

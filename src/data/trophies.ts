// src/data/trophies.ts -- the money trophies, and the page wallpapers some of them bring.
//
// A trophy lands on My Shelf (src/ui/shelf.js) the first time the kid's sales since Day 1
// (state.totalRevenueEarned) pass its amount, and the Day Report says so. Trophies wait for
// the shelf: none comes before My House opens, and at most one comes a day, in this order.
// (The simulator's careful player: about days 36, 47, 75, 97 and 134; the island is about
// day 139.)
export interface Trophy {
  id: string;
  name: string;
  sales: number;         // sales since Day 1 that win it
  wallpaper?: string;    // the wallpaper it brings (WALLPAPERS)
}

export const TROPHIES: readonly Trophy[] = [
  { id: 'bronze', name: 'Bronze Trophy', sales: 1000 },
  { id: 'silver', name: 'Silver Trophy', sales: 10000 },
  { id: 'gold', name: 'Gold Trophy', sales: 100000, wallpaper: 'lemons' },
  { id: 'millionaire', name: 'Millionaire Trophy', sales: 1000000, wallpaper: 'fruit' },
  { id: 'billionaire', name: 'Billionaire Trophy', sales: 1000000000, wallpaper: 'stars' },
];

// The page behind the cards (state.wallpaper). Plain is the page's own dark color; the rest
// come with trophies and are picked in the shelf room. Pictures: art_src/build_wallpaper_art.py.
export const WALLPAPERS: readonly { id: string; name: string }[] = [
  { id: 'plain', name: 'Plain' },
  { id: 'lemons', name: 'Lemons' },
  { id: 'fruit', name: 'Fruit Party' },
  { id: 'stars', name: 'Gold Stars' },
];

// Placements are in the front-facing kid's 480 x 402 art coordinates.
export const HATS = [
  { id: 'hat_baseball_cap_front', name: 'Ball cap', x: 104, y: -65, width: 267 },
  { id: 'hat_cowboy_star', name: 'Cowboy hat', x: 78, y: -70, width: 320 },
  { id: 'acc_cat_ears_headband', name: 'Cat ears', x: 117, y: -40, width: 240 },
  { id: 'acc_ribbon_bow_headband', name: 'Bow', x: 140, y: -35, width: 198 },
  { id: 'acc_flower_wreath', name: 'Flower crown', x: 117, y: 2, width: 247 },
];
export const SHADES = { id: 'acc_sunglasses', name: 'Sunglasses', x: 151, y: 139, width: 178 };
export const accessoryURL = (id: string) => `./sprites/kid_back/headwear/${id}.png`;

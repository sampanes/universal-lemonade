// Placements are in the front-facing kid's 480 x 402 art coordinates.
export const HATS = [
  { id: 'hat_baseball_cap_front', name: 'Ball cap', x: 165, y: 36, width: 146 },
  { id: 'hat_cowboy_star', name: 'Cowboy hat', x: 143, y: 37, width: 192 },
  { id: 'acc_cat_ears_headband', name: 'Cat ears', x: 151, y: 37, width: 174 },
  { id: 'acc_ribbon_bow_headband', name: 'Bow', x: 159, y: 40, width: 131 },
  { id: 'acc_flower_wreath', name: 'Flower crown', x: 144, y: 49, width: 191 },
];
export const SHADES = { id: 'acc_sunglasses', name: 'Sunglasses', x: 151, y: 139, width: 178 };
export const accessoryURL = (id: string) => `./sprites/kid_back/headwear/${id}.png`;

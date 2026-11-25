// src/ui/places.js -- the friends' stands and the stores: names, pictures, and where things stand in the day scene.
import { kidHairIds, kidImageURL } from '../kid.ts';
import { housePicHTML, houseImageURLs, houseArtFor } from './houseArt.js';

// The pictures of the stores that buy bottles (Stage 3; src/data/wholesale.ts).
export const STORE_PICS = {
  bodega: './sprites/stores/bodega.png',
  market: './sprites/stores/market.png',
  sports: './sprites/stores/sports.png',
};

// Friends' stands (Stage 2; src/data/franchise.ts). Each friend is a paper-doll kid with a
// look of their own, standing behind their stand sticker (public/sprites/franchise/<pic>.png)
// in front of their neighborhood (public/sprites/backdrops/<pic>.webp, the sky cut out by
// art_src/build_backdrop_art.py).
export const FRIENDS = {
  timmy: { pic: 'elm', sellerX: 38, hair: 'sidepart', skinTone: 1, hairColor: 1, uniformColor: 2 },
  leo: { pic: 'ballpark', sellerX: 70, hair: 'curly', skinTone: 3, hairColor: 0, uniformColor: 4 },
  sarah: { pic: 'pool', sellerX: 26, hair: 'ponytail', skinTone: 0, hairColor: 3, uniformColor: 1 },
};
export function friendPortrait(id, mood, view = false) {
  const f = FRIENDS[id];
  if (!f) return null;
  const profile = { hairStyle: kidHairIds().indexOf(f.hair), skinTone: f.skinTone, hairColor: f.hairColor, uniformColor: f.uniformColor };
  return profile.hairStyle >= 0 ? kidImageURL(profile, mood, view) : null;
}

const standPic = (pic) => `./sprites/franchise/${pic}.png`;
const backdropPic = (pic) => `./sprites/backdrops/${pic}.webp`;

// The friends' stands and backdrops and the store pictures (for preloading).
export const ALL_PLACE_IMAGES = [
  ...Object.values(FRIENDS).flatMap(f => [standPic(f.pic), backdropPic(f.pic)]),
  ...Object.values(STORE_PICS),
];

// The day scene's picture of a stand ('driveway' or a friend's id): who sells there, the
// table, and what is behind it (a friend's neighborhood, or the family house behind the kid's
// own stand, which has Timmy's kind of table).
export function sceneLocation(id, engine, kidProfile) {
  const friend = FRIENDS[id];
  if (friend) {
    const stand = engine.franchiseStands[id];
    return {
      name: `${stand.workerName} \u00b7 ${stand.name}`,
      host: friendPortrait(id, 'happy', 'stand'),
      sellerX: friend.sellerX,
      table: standPic(friend.pic),
      backdrop: backdropPic(friend.pic),
    };
  }
  const level = engine.state.houseLevel;
  return {
    name: 'My driveway',
    host: kidImageURL(kidProfile, 'happy', 'stand'),
    sellerX: 64,
    table: standPic(FRIENDS.timmy.pic),
    house: housePicHTML(level, engine.state.houseColor),
    houseImages: houseImageURLs(level),
    standX: houseArtFor(level).standX,
  };
}

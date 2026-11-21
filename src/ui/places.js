// src/ui/places.js -- the friends' stands and the stores: names, pictures, and where things stand in the day scene.
import { kidHairIds, kidImageURL } from '../kid.ts';
import { housePicHTML, houseImageURLs, houseArtFor } from './houseArt.js';

// The stores that buy bottles (Stage 3): kid names and pictures for the engine's accounts.
export const STORES = {
  bodega: { name: 'Corner Store', pic: './sprites/stores/bodega.png' },
  market: { name: 'Farmers Market', pic: './sprites/stores/market.png' },
  sports: { name: 'Ballfield', pic: './sprites/stores/sports.png' },
};

// Friends' stands (Stage 2). Each friend is a paper-doll kid with a look of their own,
// standing behind their stand sticker (public/sprites/franchise/).
export const FRIENDS = {
  timmy: { place: 'Elm Street', pic: 'elm', backdrop: 'elm-stoop', sellerX: 38, hair: 'sidepart', skinTone: 1, hairColor: 1, uniformColor: 2 },
  leo: { place: 'Ballpark', pic: 'ballpark', sellerX: 70, hair: 'curly', skinTone: 3, hairColor: 0, uniformColor: 4 },
  sarah: { place: 'Pool', pic: 'pool', sellerX: 26, hair: 'ponytail', skinTone: 0, hairColor: 3, uniformColor: 1 },
};
export function friendPortrait(id, mood, view = false) {
  const f = FRIENDS[id];
  if (!f) return null;
  const profile = { name: id, hairStyle: kidHairIds().indexOf(f.hair), skinTone: f.skinTone, hairColor: f.hairColor, uniformColor: f.uniformColor };
  return profile.hairStyle >= 0 ? kidImageURL(profile, mood, view) : null;
}

// The friends' stands and backdrops and the store pictures (for preloading).
export const ALL_PLACE_IMAGES = [
  './sprites/franchise/elm.png',
  ...Object.values(FRIENDS).flatMap(f => [`./sprites/franchise/${f.pic}.png`, `./sprites/backdrops/${f.backdrop ?? f.pic}-clear.webp`]),
  ...Object.values(STORES).map(store => store.pic),
];

// The day scene's picture of a stand: who sells there, the table, and what is behind it (the
// family house behind the kid's own stand, a backdrop behind a friend's).
export function sceneLocation(id, engine, kidProfile) {
  const friend = FRIENDS[id];
  const level = engine.state.houseLevel;
  return {
    name: friend ? `${engine.franchiseStands[id].workerName} \u00b7 ${friend.place}` : id === 'driveway' ? 'My driveway' : 'Neighborhood stand',
    host: id === 'driveway' ? kidImageURL(kidProfile, 'happy', 'stand') : friendPortrait(id, 'happy', 'stand'),
    sellerX: friend?.sellerX ?? 64,
    backdrop: './sprites/backdrops/' + (friend?.backdrop ?? friend?.pic ?? 'elm') + '-clear.webp',
    house: friend ? null : housePicHTML(level, engine.state.houseColor),
    houseImages: friend ? [] : houseImageURLs(level),
    standX: houseArtFor(level).standX,
    table: './sprites/franchise/' + (friend?.pic || 'elm') + '.png',
  };
}

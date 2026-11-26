// src/ui/mirror.js -- the mirror (tap the kid beside the cash pill; a new player meets it
// before Day 1) and the secret looks (src/unlocks.ts): some hair styles and colors stay out of
// the mirror until a milestone happens. Nothing hints at what is next; a new look just shows
// up, with a surprise in the Day Report and a glow on it until the mirror is opened.
import { saveCharacterProfile, clearCharacterProfile, loadCharacterProfile, hasSavedCharacterProfile, SKIN_PALETTES, HAIR_PALETTES, UNIFORM_PALETTES } from '../character.ts';
import { HATS, SHADES, accessoryURL } from '../headwear.ts';
import { kidImageURL, kidHairCount, kidHairIds } from '../kid.ts';
import { loadUnlocks, saveUnlocks, clearUnlocks, advanceLookUnlocks, unlockCheckFrom, otherUnlockToday, lookOpen } from '../unlocks.ts';
import { kid, kidPicHTML, setKidImg, clearKidFlash } from './kidView.js';
import { setText, setHTMLIfChanged } from './dom.js';
import { session } from './session.js';

let unlocks = null;
const lookOfHair = (i) => `hair:${kidHairIds()[i]}`;
const lookOfColor = (i) => `color:${HAIR_PALETTES[i].id}`;
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

// The kid button glows while a new look waits in the mirror.
function refreshKidNew() {
  document.getElementById('btn-header-kid').classList.toggle('has-new', unlocks.unseen.size > 0);
}

// The new look the day brought (saved right away), or null. The report shows it
// (magicLookNews), and the kid button starts to glow (refreshKidNew) once the day scene is over.
export function checkMagicLooks(summary) {
  const look = advanceLookUnlocks(unlocks, unlockCheckFrom(session.engine.state, summary), otherUnlockToday(session.engine.state, summary));
  saveUnlocks(unlocks);   // also saves milestones waiting for a quiet day
  return look || null;
}

function profileWithLook(look) {
  const [kind, id] = look.split(':');
  if (kind === 'hair') {
    const i = kidHairIds().indexOf(id);
    return i < 0 ? null : { ...kid.profile, hairStyle: i };
  }
  const i = HAIR_PALETTES.findIndex(p => p.id === id);
  return i < 0 ? null : { ...kid.profile, hairColor: i };
}

const MAGIC_LINES = ['Whoa! Magic in the mirror!', 'Something sparkly appeared!', 'Psst... check the mirror!'];
// The Day Report banner for a new look (src/ui/reportModal.js).
export function magicLookNews(look) {
  refreshKidNew();
  const profile = profileWithLook(look);
  return {
    pic: `<div class="magic-look-pics">${profile ? kidPicHTML(profile, 'surprised', true) : ''}</div>`,
    title: pickOne(MAGIC_LINES),
    text: 'A new look showed up in your mirror.',
    button: 'Try it on!',
    onPress: () => openMirror(false),
  };
}

const mirror = () => document.getElementById('kid-mirror-backdrop');
const MIRROR_CHEERS = ['Looking good!', 'So cool!', 'Love it!', 'Ready to sell!', 'Lookin\' fresh!'];
const MIRROR_POSES = ['cheer', 'smug', 'sly', 'wink'];
let mirrorMood = 'happy';
let mirrorCheerTimer = 0;
const mirrorOpen = () => mirror().classList.contains('active');

// lookOf: (index) -> look id, for options that can be secret; hidden until earned.
function swatchesHTML(palettes, current, key, label, lookOf) {
  return palettes.map((p, i) => {
    const on = i === current;
    const look = lookOf ? lookOf(i) : '';
    if (look && !on && !lookOpen(unlocks, look)) return '';
    const isNew = look && unlocks.unseen.has(look);
    return `<button type="button" class="kid-swatch${on ? ' on' : ''}${isNew ? ' is-new' : ''}" data-key="${key}" data-i="${i}" ` +
      `style="--sw:${p.swatch || p.base}" aria-label="${p.name || label + ' ' + (i + 1)}" aria-pressed="${on}"></button>`;
  }).join('');
}

export function renderMirror() {
  if (!mirrorOpen()) return;
  const profile = kid.profile;
  setKidImg(document.getElementById('kid-mirror-preview'), mirrorMood, false);
  const n = kidHairCount();
  const gearButton = (id, label, on, key) => `<button type="button" class="kid-hair-opt${on ? ' on' : ''}" data-key="${key}" data-id="${id}" title="${label}" aria-label="${label}" aria-pressed="${on}">${id ? `<img src="${accessoryURL(id)}" alt="">` : 'None'}</button>`;
  setHTMLIfChanged(document.getElementById('kid-opt-hats'),
    gearButton('', 'No hat', !profile.hat, 'hat') +
    HATS.map(h => gearButton(h.id, h.name, profile.hat === h.id, 'hat')).join('') +
    gearButton(SHADES.id, 'Toggle sunglasses', !!profile.sunglasses, 'sunglasses'));
  const hairOn = n ? profile.hairStyle % n : -1;
  setHTMLIfChanged(document.getElementById('kid-opt-hair'), Array.from({ length: n }, (_, i) => {
    const look = lookOfHair(i);
    if (i !== hairOn && !lookOpen(unlocks, look)) return '';
    const isNew = unlocks.unseen.has(look);
    const url = kidImageURL({ ...profile, hat: undefined, sunglasses: false, hairStyle: i }, 'happy', true);
    return `<button type="button" class="kid-hair-opt${i === hairOn ? ' on' : ''}${isNew ? ' is-new' : ''}" data-key="hairStyle" data-i="${i}" ` +
      `aria-label="Hair style ${i + 1}" aria-pressed="${i === hairOn}"><img src="${url}" alt="" /></button>`;
  }).join(''));
  setHTMLIfChanged(document.getElementById('kid-opt-skin'), swatchesHTML(SKIN_PALETTES, profile.skinTone, 'skinTone', 'Skin tone'));
  setHTMLIfChanged(document.getElementById('kid-opt-haircolor'), swatchesHTML(HAIR_PALETTES, profile.hairColor, 'hairColor', 'Hair color', lookOfColor));
  setHTMLIfChanged(document.getElementById('kid-opt-apron'), swatchesHTML(UNIFORM_PALETTES, profile.uniformColor, 'uniformColor', 'Apron color'));
}

// first: a new player's mirror (no close button; "Start My Stand!").
function openMirror(first) {
  setText(document.getElementById('btn-kid-mirror-done'), first ? 'Start My Stand!' : 'Done!');
  setText(document.getElementById('kid-mirror-bubble'), 'How do I look?');
  document.getElementById('btn-kid-mirror-x').hidden = first;
  mirrorMood = 'happy';
  mirror().classList.add('active');
  mirror().setAttribute('aria-hidden', 'false');
  renderMirror();
}

function closeMirror() {
  if (!mirrorOpen()) return;
  saveCharacterProfile(kid.profile);
  if (unlocks.unseen.size) {       // seen now: the glows go away
    unlocks.unseen.clear();
    saveUnlocks(unlocks);
    refreshKidNew();
  }
  mirror().classList.remove('active');
  mirror().setAttribute('aria-hidden', 'true');
}

// Reset: forget the look and the secret looks, then meet the mirror like a new player.
export function resetLooks() {
  clearCharacterProfile();
  clearUnlocks();
  kid.profile = loadCharacterProfile();
  unlocks = loadUnlocks();
  clearKidFlash();
  kid.version++;
  refreshKidNew();
  openMirror(true);
}

// onOpen: runs as the mirror opens from the kid button (close other popups).
export function initMirror({ onOpen }) {
  unlocks = loadUnlocks();
  mirror().addEventListener('click', (e) => {
    const b = e.target.closest('[data-key]');
    if (!b) return;
    const key = b.dataset.key;
    const value = key === 'hat' ? b.dataset.id : key === 'sunglasses' ? !kid.profile.sunglasses : Number(b.dataset.i);
    kid.profile = { ...kid.profile, [key]: value };
    saveCharacterProfile(kid.profile);
    kid.version++;
    mirrorMood = pickOne(MIRROR_POSES);
    setText(document.getElementById('kid-mirror-bubble'), pickOne(MIRROR_CHEERS));
    clearTimeout(mirrorCheerTimer);
    mirrorCheerTimer = setTimeout(() => { mirrorMood = 'happy'; renderMirror(); }, 1100);
    renderMirror();
  });
  document.getElementById('btn-kid-mirror-done').onclick = closeMirror;
  document.getElementById('btn-kid-mirror-x').onclick = closeMirror;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMirror(); });
  document.getElementById('btn-header-kid').onclick = (e) => { e.stopPropagation(); onOpen(); openMirror(false); };
  refreshKidNew();
  // A new player meets the mirror before Day 1.
  const s = session.engine.state;
  if (!hasSavedCharacterProfile() && s.day === 1 && !s.lastDaySummary) openMirror(true);
}

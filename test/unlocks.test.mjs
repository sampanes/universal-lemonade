// Secret looks: milestones that put new hair styles and colors in the mirror. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

const sim = await import(new URL('../.sim-build/index.js', import.meta.url).href);
const { LemonadeEngine, MILESTONES, SECRET_LOOKS, newUnlocks, unlockCheckFrom, lookOpen, advanceLookUnlocks, otherUnlockToday, shopReady, loadUnlocks, saveUnlocks } = sim;

const check = (summary, extra = {}) => ({
  summary: { day: 1, tempF: 70, weather: 'SUNNY', netProfit: 5, soldOut: false, reviews: [], notes: [], ...summary },
  totalCupsSold: 0, cash: 0, reputation: 0.5, phase: 1, hasTreat: false, ...extra,
});

test('every secret look has one milestone, and the natural looks are free', () => {
  assert.equal(SECRET_LOOKS.size, MILESTONES.length);
  const none = { have: new Set(), unseen: new Set() };
  assert.equal(lookOpen(none, 'color:black'), true);
  assert.equal(lookOpen(none, 'hair:swoop'), true);
  assert.equal(lookOpen(none, 'hair:locs'), true);
  assert.equal(lookOpen(none, 'color:rainbow'), false);
  assert.equal(lookOpen(none, 'hair:mohawk'), false);
  assert.equal(lookOpen({ have: new Set(['color:rainbow']), unseen: new Set() }, 'color:rainbow'), true);
});

test('the first looks wait a few days, and a day with no profit unlocks nothing', () => {
  assert.deepEqual(newUnlocks(new Set(), check({ day: 1 })), [], 'nothing on day 1');
  assert.deepEqual(newUnlocks(new Set(), check({ day: 3, netProfit: 0 })), []);
  assert.deepEqual(newUnlocks(new Set(), check({ day: 3 })), ['color:grape']);
  assert.deepEqual(newUnlocks(new Set(['color:grape']), check({ day: 3 })), [], 'a look is only earned once');
});

test('milestones read the day and the whole game', () => {
  const have = new Set(['color:grape']);
  assert.deepEqual(newUnlocks(have, check({ soldOut: true })), ['hair:messybun']);
  assert.deepEqual(newUnlocks(have, check({ weather: 'RAINY' })), ['color:ocean']);
  assert.deepEqual(newUnlocks(have, check({}, { totalCupsSold: 100 })), ['hair:spiky']);
  assert.deepEqual(newUnlocks(have, check({ recipeJustLocked: true })), ['hair:windswept']);
  assert.deepEqual(newUnlocks(have, check({}, { totalCupsSold: 1000 })), ['hair:spiky', 'hair:mohawk']);
});

test('the special colors wait for the big moments', () => {
  const have = new Set(['color:grape']);
  assert.deepEqual(newUnlocks(have, check({}, { phase: 2 })), ['hair:undercut']);
  assert.deepEqual(newUnlocks(have, check({}, { phase: 3 })), ['hair:undercut', 'color:candy']);
  assert.deepEqual(newUnlocks(have, check({}, { phase: 5 })),
    ['hair:undercut', 'color:candy', 'color:glitter', 'color:rainbow']);
  assert.deepEqual(newUnlocks(have, check({ day: 99 })), ['hair:bangs', 'color:snow']);
  assert.ok(newUnlocks(have, check({ day: 100 })).includes('color:galaxy'));
});

test('earned looks wait for quiet days and one-day milestones are not lost', () => {
  const u = { have: new Set(), unseen: new Set() };
  const day3 = check({ day: 3, weather: 'RAINY', recipeJustLocked: true });
  assert.equal(advanceLookUnlocks(u, day3, true), null);
  assert.deepEqual(u.pending, ['color:grape', 'color:ocean', 'hair:windswept']);
  assert.equal(advanceLookUnlocks(u, check({ day: 4 }), false), null, 'one quiet day after another unlock');
  assert.equal(advanceLookUnlocks(u, check({ day: 5 }), false), 'color:grape');
  assert.equal(advanceLookUnlocks(u, check({ day: 6 }), false), null);
  assert.equal(advanceLookUnlocks(u, check({ day: 7 }), true), null, 'another unlock takes priority');
  assert.equal(advanceLookUnlocks(u, check({ day: 8 }), false), null, 'day after another unlock stays quiet');
  assert.equal(advanceLookUnlocks(u, check({ day: 9 }), false), 'color:ocean');
  assert.equal(advanceLookUnlocks(u, check({ day: 12 }), false), 'hair:windswept');
  assert.equal(u.have.size, 3);
  assert.equal(u.unseen.size, 3);
});

test('look queue survives reload and the shop waits a whole day', () => {
  const saved = new Map();
  globalThis.localStorage = { getItem: k => saved.get(k) ?? null, setItem: (k,v) => saved.set(k,v) };
  try {
    const u = { have: new Set(), unseen: new Set() };
    advanceLookUnlocks(u, check({ day: 3, weather: 'RAINY' }), true);
    saveUnlocks(u);
    const loaded = loadUnlocks();
    assert.deepEqual(loaded.pending, ['color:grape', 'color:ocean']);
    assert.equal(advanceLookUnlocks(loaded, check({ day: 4 }), false), null);
    assert.equal(advanceLookUnlocks(loaded, check({ day: 5 }), false), 'color:grape');
    saveUnlocks(loaded);
    const reloaded = loadUnlocks();
    assert.equal(advanceLookUnlocks(reloaded, check({ day: 6 }), false), null);
    assert.equal(advanceLookUnlocks(reloaded, check({ day: 8 }), false), 'color:ocean');
    advanceLookUnlocks(reloaded, check({ day: 1, recipeJustLocked: true }), false);
    assert.equal(reloaded.lastAwardDay, undefined, 'a new game resets the day-based cooldown');
    assert.ok(reloaded.pending.includes('hair:windswept'));
  } finally { delete globalThis.localStorage; }
  const e = new LemonadeEngine({ seed: 7 });
  e.state.day = 3; e.state.cash = e.state.cash.add(500);
  assert.ok(e.buyProject('auto_ice_dispenser'));
  assert.equal(shopReady(e.state), false);
  e.state.day = 4; assert.equal(shopReady(e.state), false);
  e.state.day = 5; assert.equal(shopReady(e.state), true);
  assert.ok(otherUnlockToday(e.state, check({ day: 5 }).summary), 'next shop item has its own day');
  assert.ok(otherUnlockToday(e.state, check({ day: 6, recipeJustLocked: true }).summary));
});

test('the check is built from a real game state', () => {
  const e = new LemonadeEngine({ seed: 7 });
  e.autoRestockForToday();
  const sum = e.runDay();
  const c = unlockCheckFrom(e.state, sum);
  assert.equal(c.summary, sum);
  assert.equal(c.totalCupsSold, e.state.totalCupsSold.toNumber());
  assert.equal(c.phase, e.state.phase);
  assert.equal(c.hasTreat, false);
  e.state.flags.hasSkateboard = true;
  assert.equal(unlockCheckFrom(e.state, sum).hasTreat, true);
});

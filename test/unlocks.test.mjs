// Secret looks: milestones that put new hair styles and colors in the mirror. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

const sim = await import(new URL('../.sim-build/index.js', import.meta.url).href);
const { LemonadeEngine, MILESTONES, SECRET_LOOKS, newUnlocks, unlockCheckFrom, lookOpen } = sim;

const check = (summary, extra = {}) => ({
  summary: { day: 1, tempF: 70, weather: 'SUNNY', netProfit: 5, soldOut: false, reviews: [], notes: [], ...summary },
  totalCupsSold: 0, cash: 0, reputation: 0.5, bestReviews: false, hasTreat: false, ...extra,
});

test('every secret look has one milestone, and the natural looks are free', () => {
  assert.equal(SECRET_LOOKS.size, MILESTONES.length);
  const none = { have: new Set(), unseen: new Set() };
  assert.equal(lookOpen(none, 'color:black'), true);
  assert.equal(lookOpen(none, 'hair:swoop'), true);
  assert.equal(lookOpen(none, 'hair:locs'), true);
  assert.equal(lookOpen(none, 'color:rainbow'), false);
  assert.equal(lookOpen({ have: new Set(['color:rainbow']), unseen: new Set() }, 'color:rainbow'), true);
});

test('a day with no profit unlocks nothing; the first good day unlocks a color', () => {
  assert.deepEqual(newUnlocks(new Set(), check({ netProfit: 0 })), []);
  assert.deepEqual(newUnlocks(new Set(), check({})), ['color:grape']);
  assert.deepEqual(newUnlocks(new Set(['color:grape']), check({})), [], 'a look is only earned once');
});

test('milestones read the day and the whole game', () => {
  const have = new Set(['color:grape']);
  assert.deepEqual(newUnlocks(have, check({ soldOut: true })), ['hair:messybun']);
  assert.deepEqual(newUnlocks(have, check({ weather: 'RAINY' })), ['color:ocean']);
  assert.deepEqual(newUnlocks(have, check({}, { totalCupsSold: 100 })), ['hair:spiky']);
  assert.deepEqual(newUnlocks(have, check({ recipeJustLocked: true })), ['color:rainbow']);
  assert.deepEqual(newUnlocks(have, check({}, { totalCupsSold: 1000 })), ['hair:spiky', 'color:galaxy']);
});

test('the check is built from a real game state', () => {
  const e = new LemonadeEngine({ seed: 7 });
  e.autoRestockForToday();
  const sum = e.runDay();
  const c = unlockCheckFrom(e.state, sum, false);
  assert.equal(c.summary, sum);
  assert.equal(c.totalCupsSold, e.state.totalCupsSold.toNumber());
  assert.equal(c.hasTreat, false);
  e.state.flags.hasSkateboard = true;
  assert.equal(unlockCheckFrom(e.state, sum, false).hasTreat, true);
});

// Engine and simulator checks. Run with: npm test
// Uses Node's built-in test runner against the bundled engine in .sim-build/.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const sim = await import(new URL('../.sim-build/index.js', import.meta.url).href);
const { LemonadeEngine, BALANCE, BOTS, runGame, runBatch, withOverrides, summarize } = sim;

// Plays a fixed little routine and returns a fingerprint of the whole state each day.
function playFingerprint(engine, days = 30) {
  const prints = [];
  for (let d = 0; d < days; d++) {
    const s = engine.state;
    s.recipe.lemonsPerPitcher = 3; s.recipe.sugarPerPitcher = 3;
    s.recipe.icePerCup = engine.computeIdealIce();
    engine.autoRestockForToday();
    engine.tick(60); engine.doChore();
    const sum = engine.runDay();
    prints.push(JSON.stringify([s.day, s.tempF, s.weather, s.cash.toNumber(), s.reputation, sum.netProfit, s.currentChore.name]));
  }
  return prints;
}

test('same seed and same actions give the same game', () => {
  const a = playFingerprint(new LemonadeEngine({ seed: 4242 }));
  const b = playFingerprint(new LemonadeEngine({ seed: 4242 }));
  assert.deepEqual(a, b);
});

test('different seeds give different weather', () => {
  const weather = (seed) => {
    const e = new LemonadeEngine({ seed });
    const out = [];
    for (let d = 0; d < 20; d++) { out.push(`${e.state.weather}${e.state.tempF}`); e.runDay(); }
    return out.join(',');
  };
  assert.notEqual(weather(1), weather(2));
});

test('no seed means the default seed', () => {
  assert.deepEqual(playFingerprint(new LemonadeEngine()), playFingerprint(new LemonadeEngine({ seed: sim.DEFAULT_SEED })));
});

test('morning forecast matches the real day when supplies are plentiful', () => {
  let checked = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const e = new LemonadeEngine({ seed });
    for (let d = 0; d < 40; d++) {
      const s = e.state;
      s.recipe.lemonsPerPitcher = 1 + (d % 6); s.recipe.sugarPerPitcher = 1 + ((d * 5) % 6);
      s.recipe.icePerCup = 1 + (d % 5); s.recipe.pricePerCup = 0.5 + (d % 8) * 0.5;
      s.inv.lemons = 9999; s.inv.sugar = 9999; s.inv.ice = 99999; s.inv.cups = 9999;
      if (d === 10 && s.phase === 1) e.state.phase = 2;   // include franchise stands
      if (d === 10) Object.values(e.franchiseStands).forEach(st => { st.hired = true; });
      const est = e.getDailyDemandEstimate();
      const sum = e.runDay();
      assert.equal(sum.drivewayCupsSold + sum.franchiseCupsSold, est.totalEstCups, `seed ${seed} day ${s.day - 1}`);
      checked++;
    }
  }
  assert.ok(checked >= 1600);
});

test('balance overrides change only the named setting and never touch BALANCE', () => {
  const before = JSON.stringify(BALANCE);
  const b = withOverrides({ 'buzz.neighbors': 99, 'reputation.alpha': 0.5 });
  assert.equal(b.buzz.neighbors, 99);
  assert.equal(b.reputation.alpha, 0.5);
  assert.equal(b.demand.priceExponent, BALANCE.demand.priceExponent);
  assert.equal(JSON.stringify(BALANCE), before);
  assert.throws(() => withOverrides({ 'demand.noSuchThing': 1 }), /No balance setting/);
});

test('a balance override actually changes the game', () => {
  const base = runGame(777, 'careful', 20);
  const busier = runGame(777, 'careful', 20, withOverrides({ 'buzz.neighbors': 130 }));
  assert.ok(busier.totalEarned > base.totalEarned);
});

test('every bot can play a full game without throwing', () => {
  for (const name of Object.keys(BOTS)) {
    const r = runGame(12345, name, 60);
    assert.ok(Number.isFinite(r.finalCash), name);
  }
});

// ---- Golden recipe ----

test('golden recipe is picked per seed from the balance ranges, all combinations show up', () => {
  const { goldenLemons: gl, goldenSugar: gs } = BALANCE.recipe;
  const seen = new Set();
  for (let seed = 1; seed <= 2000; seed++) {
    const g = new LemonadeEngine({ seed }).getGoldenRecipe();
    assert.ok(g.lemons >= gl.min && g.lemons <= gl.max, `lemons ${g.lemons}`);
    assert.ok(g.sugar >= gs.min && g.sugar <= gs.max, `sugar ${g.sugar}`);
    seen.add(`${g.lemons}:${g.sugar}`);
  }
  assert.equal(seen.size, (gl.max - gl.min + 1) * (gs.max - gs.min + 1));
  assert.deepEqual(new LemonadeEngine({ seed: 31337 }).getGoldenRecipe(), new LemonadeEngine({ seed: 31337 }).getGoldenRecipe());
});

test('quality is 100% only at the golden recipe with ideal ice, and only exact golden is named golden', () => {
  const e = new LemonadeEngine({ seed: 2024 });
  const g = e.getGoldenRecipe(), r = e.state.recipe;
  r.lemonsPerPitcher = g.lemons; r.sugarPerPitcher = g.sugar; r.icePerCup = e.computeIdealIce();
  assert.equal(e.computeRecipeQuality(), 1);
  assert.equal(e.getRecipeProfile().tasteName, 'Golden Ratio Perfection');
  r.lemonsPerPitcher = g.lemons + 1;
  assert.ok(e.computeRecipeQuality() < 1);
  assert.equal(e.getRecipeProfile().tasteName, 'Almost Golden!');
});

test('close-to-golden earns clearly less than exact golden at the same price', () => {
  const golden = summarize(runBatch(5, 0, 400, 'goldenFixedPrice', 20));
  const near = summarize(runBatch(5, 0, 400, 'nearGolden', 20));
  assert.ok(near.cashDay20.p50 < golden.cashDay20.p50 * 0.7,
    `near $${near.cashDay20.p50.toFixed(0)} vs golden $${golden.cashDay20.p50.toFixed(0)} on day 20`);
  assert.ok(near.avgReputation.p50 < golden.avgReputation.p50);
});

test('ice hint says just right only at the ideal ice, and points the right way otherwise', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const e = new LemonadeEngine({ seed });
    for (let d = 0; d < 20; d++) {
      const ideal = e.computeIdealIce();
      for (let ice = 1; ice <= 8; ice++) {
        e.state.recipe.icePerCup = ice;
        const h = e.getIceHint();
        const want = ice === ideal ? 'right' : ice < ideal ? 'more' : 'less';
        assert.equal(h.mood, want, `temp ${e.state.tempF} ice ${ice} ideal ${ideal}`);
        assert.ok(!/\d/.test(h.text), 'the hint never shows a number');
      }
      e.runDay();
    }
  }
});

test('busy-day meter: hot sunny days look busier than cold rainy ones', () => {
  const e = new LemonadeEngine({ seed: 1 });
  e.state.weather = 'RAINY'; e.state.tempF = 45;
  assert.equal(e.getCrowdLevel(), 1);
  e.state.weather = 'SUNNY'; e.state.tempF = 95;
  assert.equal(e.getCrowdLevel(), 4);
});

test('each chore today makes the next rest longer, and a new day resets it', () => {
  const e = new LemonadeEngine({ seed: 11 });
  const g = BALANCE.chores.cooldownGrowth;
  const rests = [];
  for (let i = 0; i < 5; i++) {
    const base = e.state.currentChore.cooldownSec;
    assert.ok(e.doChore());
    rests.push(e.state.currentChore.remainingSec);
    assert.ok(Math.abs(e.state.currentChore.remainingSec - base * Math.pow(g, i)) < 1e-9);
    assert.equal(e.doChore(), null, 'cannot do a chore while resting');
    e.tick(e.state.currentChore.remainingSec);
  }
  e.runDay();
  assert.equal(e.state.currentChore.remainingSec, 0);
  const base = e.state.currentChore.cooldownSec;
  e.doChore();
  assert.equal(e.state.currentChore.remainingSec, base, 'rest is back to normal on a new day');
});

// ---- Taste feedback and the golden lock ----

// Sets the recipe to golden plus the given offsets, with plenty of supplies, and runs a day.
function playDay(e, dL = 0, dS = 0) {
  const g = e.getGoldenRecipe(), s = e.state;
  s.recipe.lemonsPerPitcher = g.lemons + dL; s.recipe.sugarPerPitcher = g.sugar + dS;
  s.recipe.icePerCup = e.computeIdealIce(); s.recipe.pricePerCup = 1;
  s.inv.lemons = 9999; s.inv.sugar = 9999; s.inv.ice = 99999; s.inv.cups = 9999;
  return e.runDay();
}

test('every off-golden recipe gets a taste hint that points toward golden, never a number', () => {
  for (let dL = -2; dL <= 2; dL++) {
    for (let dS = -2; dS <= 2; dS++) {
      const e = new LemonadeEngine({ seed: 5 });
      const r = playDay(e, dL, dS).reviews.find(x => x.topic === 'taste');
      assert.ok(r, `a taste review for ${dL},${dS}`);
      const q = r.quote;
      assert.ok(!/\d/.test(q), q);
      assert.equal(/more lemon/.test(q), dL < 0, `${dL},${dS}: ${q}`);
      assert.equal(/less lemon/.test(q), dL > 0, `${dL},${dS}: ${q}`);
      assert.equal(/more sugar/.test(q), dS < 0, `${dL},${dS}: ${q}`);
      assert.equal(/less sugar/.test(q), dS > 0, `${dL},${dS}: ${q}`);
      if (dL === 0 && dS === 0) assert.equal(r.stars, 5);
      const face = dL === 0 && dS === 0 ? 'happy' : dL < 0 && dS < 0 ? 'watery' : dL > 0 || dS < 0 ? 'sour' : 'sweet';
      assert.equal(r.face, face, `${dL},${dS}: face`);
    }
  }
});

test('three golden open days in a row lock the recipe; an off day starts the count over', () => {
  const need = BALANCE.recipe.lockStreak;
  const e = new LemonadeEngine({ seed: 21 });
  for (let i = 0; i < need - 1; i++) playDay(e);
  playDay(e, 1, 0);                                   // one step off resets the streak
  assert.equal(e.state.goldenStreak, 0);
  for (let i = 0; i < need - 1; i++) assert.ok(!playDay(e).recipeJustLocked);
  assert.equal(e.isRecipeLocked(), false);
  const sum = playDay(e);
  assert.ok(sum.recipeJustLocked && e.isRecipeLocked());
  assert.ok(sum.reviews.some(r => r.topic === 'taste' && /GOLDEN/.test(r.quote)));

  // Locked: the controls do nothing, and a recipe changed behind its back is put back.
  const g = e.getGoldenRecipe();
  assert.equal(e.adjustRecipe('lemons', 1), false);
  e.state.recipe.sugarPerPitcher = g.sugar + 3;
  e.runDay();
  assert.equal(e.state.recipe.sugarPerPitcher, g.sugar);
  assert.ok(!e.state.lastDaySummary.recipeJustLocked, 'the lock moment happens once');

  // After the lock the kid already knows: no more taste comments, even on a day with sales.
  const later = playDay(e);
  assert.ok(later.drivewayCupsSold > 0);
  assert.ok(!later.reviews.some(r => r.topic === 'taste'), 'no taste review once locked');
});

test('melted ice and spoiled lemons get the full tip twice, then one short line', () => {
  const e = new LemonadeEngine({ seed: 21 });
  const spoil = (n) => /melted|went bad/.test(n);
  for (let day = 1; day <= 2; day++) {
    const notes = playDay(e).notes.filter(spoil);
    assert.equal(notes.length, 2, `day ${day}: ${notes}`);
    assert.ok(notes.some(n => /Ice only lasts one day/.test(n)) && notes.some(n => /Lemons spoil/.test(n)));
  }
  const notes = playDay(e).notes.filter(spoil);
  assert.equal(notes.length, 1, String(notes));
  assert.match(notes[0], /^Overnight: \d+ ice cubes melted, \d+ lemons went bad\.$/);
});

test('a day with no sales does not count toward the golden lock', () => {
  const e = new LemonadeEngine({ seed: 21 });
  playDay(e);
  const s = e.state, g = e.getGoldenRecipe();
  s.recipe.lemonsPerPitcher = g.lemons; s.recipe.sugarPerPitcher = g.sugar;
  s.inv.cups = 0;
  const sum = e.runDay();
  assert.equal(sum.drivewayCupsSold, 0);
  assert.equal(e.state.goldenStreak, 1, 'unchanged by the empty day');
  assert.ok(!sum.reviews.some(r => r.topic === 'taste'), 'nobody tasted it');
});

// ---- Pacing guard rails: loose on purpose, they catch big regressions, not small tuning. ----

test('a careful kid reaches the neighborhood (phase 2) around day 12', () => {
  const s = summarize(runBatch(99, 0, 300, 'careful', 15));
  assert.ok(s.phase2Day.reached >= 0.95, `reached ${(s.phase2Day.reached * 100).toFixed(1)}%`);
  assert.ok(s.phase2Day.p50 <= 12, `median day ${s.phase2Day.p50}`);
  assert.ok(s.phase2Day.p90 <= 13, `p90 day ${s.phase2Day.p90}`);
});

// Known problem, not yet fixed: once 3 neighborhood stands are hired their wages are owed
// every day and a kid cannot let a stand go, so a bad stretch drives cash to $0 again and
// again. Every $0 day in the sim is in phase 2-3 with stands hired, never the slow start.
// Loosened from 15% when the slow start (buzz) arrived, and from 30% when the stand upgrades
// went up to $125 / $275 / $605 (this bot buys all three, so it starts Phase 2 with less
// cushion for wages). Tighten it after the wage problem is fixed.
test('a careful kid does not go broke too often', () => {
  const s = summarize(runBatch(99, 0, 300, 'careful', 60));
  assert.ok(s.hitZero.mean <= 0.40, `${(s.hitZero.mean * 100).toFixed(1)}% of games hit $0`);
});

// ---- Storage: the bucket and bowl hold only so much; the upgrades lift the limits ----

test('buying sells only what fits, and a part pack costs its share', () => {
  const e = new LemonadeEngine({ seed: 3 });
  const s = e.state;
  s.cash = s.cash.add(500);
  s.inv.ice = 300;                                   // bucket holds 400
  assert.deepEqual(e.buyOffer('ice'), { qty: 100, cost: 2, full: false });
  assert.ok(e.buySupplies('ice'));
  assert.equal(s.inv.ice, 400);
  assert.equal(e.buyOffer('ice').full, true);
  assert.equal(e.buySupplies('ice'), false, 'a full bucket sells nothing');
  s.inv.lemons = 40;                                 // bowl holds 48
  assert.equal(e.buyOffer('lemons').qty, 8);
  assert.equal(e.buyOffer('cups').qty, 50, 'cups have no limit');
});

test('each upgrade lifts its limit', () => {
  const e = new LemonadeEngine({ seed: 3 });
  const s = e.state, B = e.balance.storage;
  assert.equal(e.storageCap('ice'), B.iceBucket);
  s.flags.hasCooler = true;
  assert.equal(e.storageCap('ice'), B.iceCooler);
  s.flags.hasAutoIce = true;
  assert.equal(e.storageCap('ice'), Infinity);
  assert.equal(e.storageCap('lemons'), B.lemonBowl);
  s.flags.hasMiniFridge = true;
  assert.equal(e.storageCap('lemons'), Infinity);
});

test('the ice machine makes the ice a day needs, free', () => {
  const e = new LemonadeEngine({ seed: 11 });
  playDay(e);
  const s = e.state, g = e.getGoldenRecipe();
  s.recipe.lemonsPerPitcher = g.lemons; s.recipe.sugarPerPitcher = g.sugar;
  s.flags.hasAutoIce = true;
  s.inv.ice = 0; s.inv.lemons = 200; s.inv.sugar = 200; s.inv.cups = 500;
  const want = e.getDailyDemandEstimate().totalEstCups;
  const sum = e.runDay();
  assert.ok(want > 0);
  assert.equal(sum.drivewayCupsSold, want, 'ice never runs out');
  assert.ok(sum.iceMadeByMachine > 0 && sum.upgradeSavings > 0);
});

test('a full ice bucket on a big day says the cooler would help', () => {
  const e = new LemonadeEngine({ seed: 11 });
  playDay(e);
  const s = e.state, g = e.getGoldenRecipe();
  s.recipe.lemonsPerPitcher = g.lemons; s.recipe.sugarPerPitcher = g.sugar;
  s.buzz = 1; s.reputation = 1; s.tempF = 100; s.weather = 'SUNNY';
  s.recipe.icePerCup = e.computeIdealIce();
  s.inv.ice = e.storageCap('ice'); s.inv.lemons = 48; s.inv.sugar = 200; s.inv.cups = 500;
  assert.ok(e.getKidDemandAdvice().fullItems.includes('ice'));
  const sum = e.runDay();
  assert.equal(sum.storageShort, 'ice');
  assert.ok(sum.notes.some(n => n.includes('A cooler holds')));
});

// The kid Stand Shop only spends money left over after today's supplies. Played that way,
// the upgrades never leave the stand broke, and nobody gets the cooler right away.
test('the kid shop never leaves a careful kid broke in Phase 1', () => {
  const SHOP = ['cooler', 'auto_ice_dispenser', 'fridge'];
  let zeroDays = 0, shortMornings = 0, firstCooler = Infinity, games = 0, gotAll = 0;
  for (let g = 0; g < 100; g++) {
    const e = new LemonadeEngine({ seed: 5000 + g });
    const buy = e.buyProject.bind(e);
    e.buyProject = () => false;               // the bot's own upgrade buying is off
    const ctx = { rand: () => 0.5, day: 1, memory: {} };
    for (let d = 1; d <= 40; d++) {
      ctx.day = d;
      BOTS.careful.morning(e, ctx);
      if (e.restockCostForToday() > 0) shortMornings++;   // could not afford today's supplies
      const p = SHOP.map(id => e.projects.find(x => x.id === id)).find(x => !x.purchased);
      if (p && p.unlocked(e.state) && e.state.cash.toNumber() - e.restockCostForToday() >= p.costCash) {
        buy(p.id);
        if (p.id === 'cooler') firstCooler = Math.min(firstCooler, d);
      }
      const sum = e.runDay();
      e.tick(e.balance.secondsPerDay);
      if (sum.notes.some(n => n.includes('Balance hit $0.00'))) zeroDays++;
    }
    games++;
    if (SHOP.every(id => e.projects.find(x => x.id === id).purchased)) gotAll++;
  }
  assert.equal(zeroDays, 0, `${zeroDays} days hit $0`);
  assert.ok(shortMornings / games <= 0.5, `${(shortMornings / games).toFixed(2)} short mornings per game`);
  assert.ok(firstCooler >= 4, `earliest cooler on day ${firstCooler}`);
  assert.ok(gotAll / games >= 0.8, `${gotAll}/${games} games bought all three by day 40`);
});

// ---- Slow start: buzz ----

test('a new stand starts slow and grows as the word spreads', () => {
  const s = summarize(runBatch(7, 0, 300, 'perfect', 10));
  assert.ok(s.cupsDay1.p50 >= 5 && s.cupsDay1.p50 <= 12, `day 1 median ${s.cupsDay1.p50} cups`);
  assert.ok(s.cupsDay5.p50 > s.cupsDay1.p50 * 2, `day 5 median ${s.cupsDay5.p50}`);
  assert.ok(s.cupsDay10.p50 >= 50, `day 10 median ${s.cupsDay10.p50}`);
  assert.equal(new LemonadeEngine({ seed: 3 }).getBuzz(), BALANCE.buzz.start);
});

test('good lemonade spreads the word faster than bad lemonade', () => {
  const good = summarize(runBatch(7, 0, 200, 'perfect', 10));
  const bad = summarize(runBatch(7, 0, 200, 'sloppy', 10));
  assert.ok(good.buzzDay10.p50 > bad.buzzDay10.p50 + 0.3, `good ${good.buzzDay10.p50} bad ${bad.buzzDay10.p50}`);
});

test('always selling at 50 cents does worse than a fair price', () => {
  const fair = summarize(runBatch(7, 0, 200, 'perfect', 30));
  const cheap = summarize(runBatch(7, 0, 200, 'cheapskate', 30));
  assert.ok(cheap.cashDay20.p50 < fair.cashDay20.p50 * 0.2);
});

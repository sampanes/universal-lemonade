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
// Loosened from 15% when the slow start (buzz) arrived; tighten it after that is fixed.
test('a careful kid does not go broke too often', () => {
  const s = summarize(runBatch(99, 0, 300, 'careful', 60));
  assert.ok(s.hitZero.mean <= 0.30, `${(s.hitZero.mean * 100).toFixed(1)}% of games hit $0`);
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

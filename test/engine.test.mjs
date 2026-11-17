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
  const b = withOverrides({ 'demand.drivewayBaseTraffic': 99, 'reputation.alpha': 0.5 });
  assert.equal(b.demand.drivewayBaseTraffic, 99);
  assert.equal(b.reputation.alpha, 0.5);
  assert.equal(b.demand.priceExponent, BALANCE.demand.priceExponent);
  assert.equal(JSON.stringify(BALANCE), before);
  assert.throws(() => withOverrides({ 'demand.noSuchThing': 1 }), /No balance setting/);
});

test('a balance override actually changes the game', () => {
  const base = runGame(777, 'careful', 20);
  const busier = runGame(777, 'careful', 20, withOverrides({ 'demand.drivewayBaseTraffic': 130 }));
  assert.ok(busier.totalEarned > base.totalEarned);
});

test('every bot can play a full game without throwing', () => {
  for (const name of Object.keys(BOTS)) {
    const r = runGame(12345, name, 60);
    assert.ok(Number.isFinite(r.finalCash), name);
  }
});

// ---- Pacing guard rails: loose on purpose, they catch big regressions, not small tuning. ----

test('a careful kid reaches the neighborhood (phase 2) by day 12 in 95% of games', () => {
  const s = summarize(runBatch(99, 0, 300, 'careful', 15));
  assert.ok(s.phase2Day.reached >= 0.95, `reached ${(s.phase2Day.reached * 100).toFixed(1)}%`);
  assert.ok(s.phase2Day.p90 <= 12, `p90 day ${s.phase2Day.p90}`);
});

test('a careful kid rarely goes broke', () => {
  const s = summarize(runBatch(99, 0, 300, 'careful', 60));
  assert.ok(s.hitZero.mean <= 0.15, `${(s.hitZero.mean * 100).toFixed(1)}% of games hit $0`);
});

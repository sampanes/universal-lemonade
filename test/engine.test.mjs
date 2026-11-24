// Engine and simulator checks. Run with: npm test
// Uses Node's built-in test runner against the bundled engine in .sim-build/.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const sim = await import(new URL('../.sim-build/index.js', import.meta.url).href);
const { LemonadeEngine, BALANCE, BOTS, FIRST_CHOICE, otherUnlockToday, runGame, runBatch, withOverrides, summarize } = sim;

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

test('price comments match temperature, price, and whether anyone bought', () => {
  const e = new LemonadeEngine({ seed: 1 });
  const priceReview = (tempF, pricePerCup, sold = 1, totalTraffic = 1) => sim.generateDailyReviews({
    state: e.state, franchiseStands: {}, tempF, pricePerCup, fairPrice: 2, totalTraffic,
    drivewayCupsSold: sold, franchiseCupsSold: 0, soldOutStands: [], rand: () => 0
  }).find(r => r.topic === 'price');
  for (const [temp, description] of [
    [44, 'cold'], [45, 'very cool'], [54, 'very cool'], [55, 'cool'],
    [64, 'cool'], [65, 'warm'], [74, 'warm'], [75, 'very warm'],
    [84, 'very warm'], [85, 'hot'], [94, 'hot'], [95, 'very hot']
  ]) {
    assert.equal(priceReview(temp, 2).quote, `Fair price for a ${description} day!`);
    assert.equal(priceReview(temp, 1).quote, `$1.00? Great deal on a ${description} day!`);
  }
  assert.equal(priceReview(70, 0.5).quote, "$0.50? I'd pay more!");
  assert.equal(priceReview(70, 0.9).quote, "$0.90? I'd pay more!");
  assert.equal(priceReview(70, 0.91).quote, '$0.91? Great deal on a warm day!');
  assert.equal(priceReview(70, 1.4).quote, '$1.40? Great deal on a warm day!');
  assert.equal(priceReview(70, 1.41).quote, 'Fair price for a warm day!');
  assert.equal(priceReview(70, 0.5, 0), undefined, 'no low-price review without sales');
  assert.equal(priceReview(60, 2.4).quote, '$2.40 is a little steep for a cool day.');
  assert.equal(priceReview(70, 2.4).quote, '$2.40 is a little pricey.');
  assert.equal(priceReview(84, 2.4).quote, '$2.40 is a little pricey.');
  assert.equal(priceReview(85, 2.4).quote, '$2.40 is a little steep, even for a hot day.');
  assert.equal(priceReview(95, 2.4).quote, '$2.40 is a little steep, even for a very hot day.');
  assert.equal(priceReview(44, 3).quote, "$3.00? It's too cold out for that price!");
  assert.equal(priceReview(45, 3).quote, "$3.00? It's not hot enough out for that!");
  assert.equal(priceReview(64, 3).quote, "$3.00? It's not hot enough out for that!");
  assert.equal(priceReview(65, 3).quote, '$3.00 is too high for a warm day.');
  assert.equal(priceReview(70, 3).quote, '$3.00 is too high for a warm day.');
  assert.equal(priceReview(90, 3).quote, '$3.00 is a lot, even on a hot day.');
  assert.equal(priceReview(100, 3).quote, '$3.00 is a lot, even on a very hot day.');
  assert.equal(priceReview(70, 2, 0), undefined, 'no positive review without sales');
  const noSales = priceReview(70, 3, 0);
  assert.ok(noSales && !/bought|try|lower price/i.test(noSales.quote));
  assert.equal(priceReview(70, 3, 0, 0), undefined, 'no price review when nobody visited');
});

test('rating trends ignore small dips but show a real decline', () => {
  assert.equal(sim.reputationTrend([0.99, 0.975]), 'steady');
  assert.equal(sim.reputationTrend([0.99, 0.97, 0.95, 0.94]), 'steady', '4.7 stars is still strong');
  assert.equal(sim.reputationTrend([0.89, 0.865, 0.84]), 'down', 'sustained decline');
  assert.equal(sim.reputationTrend([0.99, 0.89]), 'down', 'a sharp drop still warns');
  assert.equal(sim.reputationTrend([0.89, 0.86, 0.86]), 'steady', 'no warning once the drop stops');
  assert.equal(sim.reputationTrend([0.89, 0.86, 0.87]), 'up');
});

test('rating remembers a little more history and persists its trend', () => {
  const e = new LemonadeEngine({ seed: 8 });
  e.state.reputation = 0.99;
  assert.ok(Math.abs(sim.nextReputation(e.state, 0.94) - 0.9775) < 1e-9);
  assert.equal(sim.nextReputation(e.state, null), 0.99, 'no customers leaves the rating alone');
  assert.ok(sim.nextReputation(e.state, 1, e.balance, true) <= 0.97 + 1e-9,
    'excessive pricing still lowers reputation');
  e.state.avgRecipeQuality = 0.5;
  e.state.totalQualityDays = 1;
  const day = e.runDay();
  assert.ok(Math.abs(e.state.avgRecipeQuality - (0.5 * 0.7 + day.recipeQuality * 0.3)) < 1e-9,
    'recipe quality keeps its previous smoothing');
  const saved = JSON.parse(JSON.stringify(e.toSave()));
  const loaded = LemonadeEngine.fromSave(saved);
  assert.deepEqual(loaded.state.reputationHistory, e.state.reputationHistory);
  assert.equal(loaded.state.lastDaySummary.reputationTrend, day.reputationTrend);
  const nextA = e.runDay(), nextB = loaded.runDay();
  assert.equal(nextA.reputationTrend, nextB.reputationTrend);
});

test('excessive prices lower reputation only when people can see the stand', () => {
  const setup = (balance) => {
    const e = new LemonadeEngine({ seed: 33, balance });
    const s = e.state;
    s.tempF = 70; s.weather = 'SUNNY'; s.reputation = 0.5; s.buzz = 1;
    s.recipe.lemonsPerPitcher = s.goldenRecipe.lemons;
    s.recipe.sugarPerPitcher = s.goldenRecipe.sugar;
    s.recipe.icePerCup = e.computeIdealIce();
    s.cash = s.cash.add(10000);
    return e;
  };
  const priced = setup();
  priced.state.recipe.pricePerCup = 2.8; // exactly 1.4 times the fair price
  priced.autoRestockForToday();
  const before = priced.state.reputation;
  priced.runDay();
  assert.ok(priced.state.reputation <= before - 0.02 + 1e-9);

  const turnedAway = setup();
  turnedAway.state.recipe.pricePerCup = 100000;
  const noBuyers = turnedAway.runDay();
  assert.equal(noBuyers.drivewayCupsSold, 0);
  assert.ok(Math.abs(turnedAway.state.reputation - 0.48) < 1e-9);

  const noTraffic = setup(withOverrides({ 'demand.weatherMult.RAINY': 0 }));
  noTraffic.state.weather = 'RAINY';
  noTraffic.state.recipe.pricePerCup = 100000;
  noTraffic.runDay();
  assert.equal(noTraffic.state.reputation, 0.5);

  const reasonable = setup();
  reasonable.state.recipe.pricePerCup = 2.6;
  reasonable.autoRestockForToday();
  reasonable.runDay();
  assert.ok(reasonable.state.reputation > 0.5, 'a price below the excessive threshold can still build reputation');
});

test('limited sales never exceed demand or the available cups', () => {
  for (let a = 0; a <= 3; a++) for (let b = 0; b <= 3; b++)
    for (let c = 0; c <= 3; c++) for (let d = 0; d <= 3; d++) {
      const demand = [a,b,c,d];
      const total = demand.reduce((x,y) => x+y, 0);
      for (let available = 0; available <= total + 1; available++) {
        const sold = sim.allocateStandSales(demand.map(demand => ({ demand })), available);
        assert.equal(sold.reduce((x,y) => x+y, 0), Math.min(total, available));
        sold.forEach((n, i) => assert.ok(n >= 0 && n <= demand[i]));
      }
    }
  const e = new LemonadeEngine({ seed: 1 });
  e.dadJumpToPhase(2);
  Object.values(e.franchiseStands).forEach(st => { st.hired = true; });
  Object.assign(e.state, { buzz: 0.7, reputation: 0.8, weather: 'RAINY', tempF: 45 });
  e.state.recipe.pricePerCup = 0.5; e.state.recipe.icePerCup = e.computeIdealIce();
  Object.assign(e.state.inv, { lemons: 1000, sugar: 1000, ice: 1000, cups: 2 });
  const forecast = e.getDailyDemandEstimate();
  const day = e.runDay();
  assert.equal(day.drivewayCupsSold + day.franchiseCupsSold, 2);
  assert.ok(day.drivewayCupsSold <= forecast.estDrivewayCups);
  for (const friend of day.friends) {
    assert.ok(friend.cups <= forecast.franchiseEstimates.find(x => x.id === friend.id).estCups);
  }
});

test('stock and team comments match what happened', () => {
  const e = new LemonadeEngine({ seed: 1 });
  e.dadJumpToPhase(2);
  Object.values(e.franchiseStands).forEach(st => { st.hired = true; });
  const params = { state: e.state, franchiseStands: e.franchiseStands, tempF: 70,
    pricePerCup: 1, fairPrice: 2, totalTraffic: 10, drivewayCupsSold: 2,
    franchiseCupsSold: 3, soldOutStands: [], rand: () => 0 };
  const comments = extra => sim.generateDailyReviews({ ...params, ...extra });
  const sarah = e.franchiseStands.sarah;
  const short = comments({ soldOutStands: [sarah.name], bottleneck: 'Cups' }).find(r => r.topic === 'team');
  assert.ok(short.reviewer.startsWith('Sarah'));
  assert.equal(short.quote, 'We ran out of cups today!');
  const driveway = comments({ soldOutStands: ['Driveway Stand'] });
  assert.ok(driveway.some(r => r.topic === 'stock'));
  assert.ok(!driveway.some(r => r.topic === 'team' && /ran out/i.test(r.quote)));
  const quiet = comments({ franchiseCupsSold: 0 }).find(r => r.topic === 'team');
  assert.equal(quiet.quote, 'No cups sold at our stands today.');
  assert.ok(!comments({}).some(r => /sold out/i.test(r.quote)));

  const empty = new LemonadeEngine({ seed: 4 });
  empty.state.weather = 'SUNNY'; empty.state.tempF = 80; empty.state.buzz = 0.8;
  empty.state.recipe.lemonsPerPitcher = empty.state.goldenRecipe.lemons;
  empty.state.recipe.sugarPerPitcher = empty.state.goldenRecipe.sugar;
  empty.state.recipe.pricePerCup = 1; empty.state.inv.cups = 0;
  const closed = empty.runDay();
  assert.equal(closed.drivewayCupsSold, 0);
  assert.ok(closed.reviews.some(r => r.topic === 'stock' && /driveway/i.test(r.quote)), 'the driveway can run out on its own');
  assert.ok(!closed.notes.some(n => /wages paid.*0\.00/i.test(n)));

  const nobody = new LemonadeEngine({ seed: 4, balance: withOverrides({ 'demand.weatherMult.RAINY': 0 }) });
  nobody.state.weather = 'RAINY'; nobody.state.recipe.pricePerCup = 100;
  const quietDay = nobody.runDay();
  assert.ok(!quietDay.reviews.some(r => r.topic === 'price'), 'no customer can comment when nobody visited');
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
  // Cash on hand varies with the timing of upgrades; compare sales before spending.
  assert.ok(near.totalEarned.p50 < golden.totalEarned.p50 * 0.85,
    `near $${near.totalEarned.p50.toFixed(0)} vs golden $${golden.totalEarned.p50.toFixed(0)} in sales`);
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

test('a careful player can reach the neighborhood without rushing the opening', () => {
  const s = summarize(runBatch(99, 0, 300, 'careful', 50));
  assert.ok(s.phase2Day.reached >= 0.95, `reached ${(s.phase2Day.reached * 100).toFixed(1)}%`);
  assert.ok(s.phase2Day.p50 >= 20 && s.phase2Day.p50 <= 36, `median day ${s.phase2Day.p50}`);
  assert.ok(s.phase2Day.p90 <= 40, `p90 day ${s.phase2Day.p90}`);
});

// This bot keeps every hired friend working, even on slow days. A player can pause them
// to avoid wages; the bot's result does not measure that strategy.
test('a careful kid does not go broke too often', () => {
  const s = summarize(runBatch(99, 0, 300, 'careful', 60));
  assert.ok(s.hitZero.mean <= 0.40, `${(s.hitZero.mean * 100).toFixed(1)}% of games hit $0`);
});

// ---- Money Bag: the day's money diary always matches the cash ----

test('money in minus money out is exactly how much cash changed', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const e = new LemonadeEngine({ seed });
    const ctx = { rand: () => 0.5, day: 1, memory: {} };
    for (let d = 1; d <= 30; d++) {
      const before = e.state.cash.toNumber();
      ctx.day = d;
      BOTS.careful.morning(e, ctx);      // shopping, chores, upgrades
      const sum = e.runDay();
      e.tick(e.balance.secondsPerDay);
      if (sum.notes.some(n => n.includes('Balance hit $0.00'))) continue;   // bailout day
      const l = e.state.lastLedger;
      assert.equal(l.day, d);
      assert.ok(Math.abs(before + sim.ledgerKept(l) - e.state.cash.toNumber()) < 0.01,
        `seed ${seed} day ${d}: ${before} + ${sim.ledgerKept(l)} != ${e.state.cash.toNumber()}`);
    }
  }
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
  s.inv.lemons = 16;                                 // bowl holds 24
  assert.equal(e.buyOffer('lemons').qty, 8);
  assert.equal(e.buyOffer('cups').qty, 50, 'cups have no limit');
});

test('the fridge stops spoilage and attracts more customers', () => {
  const make = () => {
    const e = new LemonadeEngine({ seed: 3 });
    const s = e.state;
    s.day = 3; s.tempF = 75; s.weather = 'SUNNY'; s.buzz = 1;
    s.recipe.lemonsPerPitcher = s.goldenRecipe.lemons;
    s.recipe.sugarPerPitcher = s.goldenRecipe.sugar;
    s.recipe.icePerCup = e.computeIdealIce(); s.recipe.pricePerCup = 0.5;
    s.cash = s.cash.add(2000);
    return e;
  };
  const before = make(), after = make();
  assert.equal(before.storageCap('lemons'), 24);
  assert.ok(after.buyProject('fridge'));
  assert.equal(after.state.reputation, before.state.reputation, 'no hidden reputation bump');
  assert.ok(after.getDailyDemandEstimate().totalEstCups > before.getDailyDemandEstimate().totalEstCups);
  assert.equal(after.storageCap('lemons'), Infinity);
  for (const e of [before, after]) {
    e.state.inv.lemons = 24; e.state.inv.cups = 0;
    e.runDay();
  }
  assert.equal(before.state.inv.lemons, 16, '30% of leftover lemons spoil');
  assert.equal(after.state.inv.lemons, 24, 'fridge preserves the lemons');
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

test('ice machine savings count only ice used in sold drinks', () => {
  const make = cups => {
    const e = new LemonadeEngine({ seed: 3 });
    const s = e.state;
    s.buzz = 1; s.reputation = 1; s.tempF = 90; s.weather = 'SUNNY';
    s.flags.hasAutoIce = true; s.flags.autoIceEnabled = true;
    s.recipe.lemonsPerPitcher = s.goldenRecipe.lemons;
    s.recipe.sugarPerPitcher = s.goldenRecipe.sugar;
    s.recipe.pricePerCup = 0.5;
    Object.assign(s.inv, { ice: 0, lemons: 1000, sugar: 1000, cups });
    return e;
  };
  const empty = make(0), emptyDay = empty.runDay();
  assert.ok(emptyDay.iceMadeByMachine > 0, 'machine prepared for demand');
  assert.equal(emptyDay.upgradeSavings, 0, 'unused ice does not count as money saved');
  assert.ok(!emptyDay.notes.some(n => /free ice cubes/.test(n)));

  const partial = make(5), idealIce = partial.computeIdealIce(), day = partial.runDay();
  const freeIceUsed = day.drivewayCupsSold * idealIce;
  const icePrice = partial.supplyPack('ice').cost / partial.supplyPack('ice').qty;
  assert.equal(day.upgradeSavings, +(freeIceUsed * icePrice).toFixed(2));
  assert.ok(day.iceMadeByMachine > freeIceUsed, 'forecast exceeded actual sales');
});

test('a full ice bucket on a big day says the ice machine would help', () => {
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
  assert.equal(sum.soldOut, true, 'a sold-out day is flagged (the kid makes the sold-out face)');
  assert.ok(sum.notes.some(n => n.includes('An ice machine makes all the ice')));
});

// The kid Stand Shop only spends money left over after today's supplies. Played that way,
// the upgrades never leave the stand broke, and nobody gets the first upgrade right away.
// Half the games pick the fridge first (the shop's first choice), half the ice machine.
test('the kid shop never leaves a careful kid broke in Phase 1', () => {
  let zeroDays = 0, shortMornings = 0, firstBuy = Infinity, games = 0, gotAll = 0;
  for (let g = 0; g < 100; g++) {
    const SHOP = g % 2 ? ['fridge', 'auto_ice_dispenser'] : ['auto_ice_dispenser', 'fridge'];
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
        if (p.id === SHOP[0]) firstBuy = Math.min(firstBuy, d);
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
  assert.ok(firstBuy >= 6, `earliest first upgrade on day ${firstBuy}`);
  assert.ok(gotAll / games >= 0.8, `${gotAll}/${games} games bought both by day 40`);
});

// The shop's first choice is a fair pick: the two open together on Day 3 at the same price,
// and buying either one leaves the other to buy next.
test('the ice machine and the fridge are a choice', () => {
  const e = new LemonadeEngine({ seed: 21 });
  const [a, b] = FIRST_CHOICE.map(id => e.projects.find(p => p.id === id));
  assert.deepEqual([a.id, b.id].sort(), ['auto_ice_dispenser', 'fridge']);
  assert.equal(a.costCash, b.costCash, 'same price, so the pick is about what each does');
  e.state.cash = e.state.cash.add(2000);
  e.state.day = 2;
  assert.ok(!a.unlocked(e.state) && !b.unlocked(e.state), 'not before Day 3');
  e.state.day = 3;
  assert.ok(a.unlocked(e.state) && b.unlocked(e.state), 'both open on Day 3');
  assert.ok(e.buyProject(b.id));
  assert.ok(a.unlocked(e.state) && !a.purchased, 'the other one is still for sale');
  assert.ok(e.buyProject(a.id));
});

// ---- Slow start: buzz ----

test('a new stand starts slow and grows as the word spreads', () => {
  const s = summarize(runBatch(7, 0, 300, 'perfect', 10));
  assert.ok(s.cupsDay1.p50 >= 5 && s.cupsDay1.p50 <= 12, `day 1 median ${s.cupsDay1.p50} cups`);
  assert.ok(s.cupsDay5.p50 > s.cupsDay1.p50 * 2, `day 5 median ${s.cupsDay5.p50}`);
  assert.ok(s.cupsDay10.p50 > s.cupsDay1.p50 * 1.5, `day 10 median ${s.cupsDay10.p50}`);
  assert.ok(s.buzzDay10.p50 > BALANCE.buzz.start, `day 10 buzz ${s.buzzDay10.p50}`);
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
  assert.ok(cheap.totalEarned.p50 < fair.totalEarned.p50 * 0.3,
    `cheap sales ${cheap.totalEarned.p50} vs fair ${fair.totalEarned.p50}`);
});

test('Dad Mode stage jump sets up a played-looking game for each stage', () => {
  const e = new LemonadeEngine({ seed: 99 });
  const owned = (id) => e.projects.find(p => p.id === id).purchased;
  assert.equal(e.dadJumpToPhase(2), true);
  assert.equal(e.state.phase, 2);
  assert.ok(owned('auto_ice_dispenser') && owned('fridge') && owned('franchise_license'));
  assert.equal(e.state.recipeLocked, true);
  assert.equal(e.state.recipe.lemonsPerPitcher, e.state.goldenRecipe.lemons);
  assert.ok(Object.values(e.franchiseStands).every(st => !st.hired), 'the target stage starts fresh');
  assert.equal(e.ledger.shop, 0, 'nothing charged');
  assert.equal(e.dadJumpToPhase(2), false, 'no jumping to the stage you are in');

  const f = new LemonadeEngine({ seed: 99 });
  assert.equal(f.dadJumpToPhase(5), true);
  assert.equal(f.state.phase, 5);
  assert.ok(Object.values(f.franchiseStands).every(st => st.hired));
  assert.ok(Object.values(f.wholesaleAccounts).every(w => w.active));
  assert.ok(f.patent.licensed && f.copacker.active);
  assert.ok(f.projects.filter(p => p.phase === 5).every(p => !p.purchased), 'stage 5 upgrades left to buy');
  f.autoRestockForToday();
  const sum = f.runDay();
  assert.ok(Number.isFinite(sum.netProfit));
});

test('a saved game loads back and plays on exactly the same', () => {
  const a = new LemonadeEngine({ seed: 777 });
  playFingerprint(a, 12);
  a.dadJumpToPhase(3);
  a.hireFranchiseStand('timmy');
  const json = JSON.stringify(a.toSave());
  const b = LemonadeEngine.fromSave(JSON.parse(json));
  assert.ok(b, 'loads');
  assert.equal(b.state.phase, 3);
  assert.equal(b.state.cash.toNumber(), a.state.cash.toNumber());
  assert.equal(b.state.totalCupsSold.toNumber(), a.state.totalCupsSold.toNumber());
  assert.deepEqual(b.projects.filter(p => p.purchased).map(p => p.id), a.projects.filter(p => p.purchased).map(p => p.id));
  assert.deepEqual(b.franchiseStands, a.franchiseStands);
  assert.deepEqual(playFingerprint(b, 15), playFingerprint(a, 15));
});

test('lifetime sales add business revenue across stages and survive saving', () => {
  const e = new LemonadeEngine({ seed: 41 });
  let expected = 0;
  const play = () => {
    e.autoRestockForToday();
    const s = e.runDay();
    const components = s.drivewayRevenue + s.franchiseGrossRevenue + s.wholesaleRevenue
      + s.patentRoyalties + s.copackerNet;
    expected += components * e.state.brandMultiplier;
    assert.ok(Math.abs(e.state.totalRevenueEarned.toNumber() - expected) < 1e-6);
    return s;
  };
  play();
  e.dadJumpToPhase(5);
  e.patent.licensed = true;
  e.copacker.active = true;
  Object.assign(e.state.inv, { lemons: 100000, sugar: 100000, ice: 100000, cups: 100000, bottles: 100000 });
  const day = play();
  assert.ok(day.drivewayRevenue > 0 && day.franchiseGrossRevenue > 0 && day.wholesaleRevenue > 0);
  assert.ok(day.patentRoyalties > 0 && day.copackerNet > 0);
  const before = e.state.totalRevenueEarned.toNumber();
  e.tick(3600);
  e.doChore();
  e.buyProject('cargo_wagon');
  assert.equal(e.state.totalRevenueEarned.toNumber(), before, 'chores and purchases are not sales');
  const loaded = LemonadeEngine.fromSave(JSON.parse(JSON.stringify(e.toSave())));
  assert.equal(loaded.state.totalRevenueEarned.toNumber(), before);
  loaded.autoRestockForToday();
  const next = loaded.runDay();
  assert.ok(Math.abs(loaded.state.totalRevenueEarned.toNumber() - (before + next.totalRevenue)) < 1e-6);
});

test('profit since Day 1 is sales minus supplies and pay; upgrades and hiring do not lower it', () => {
  const e = new LemonadeEngine({ seed: 41 });
  let expect = 0;
  for (let i = 0; i < 25; i++) {
    if (i === 12) {
      e.dadJumpToPhase(2);
      e.hireFranchiseStand('timmy');
    }
    if (i === 15) e.buyProject('costco_card');
    e.autoRestockForToday();
    e.runDay();
    const l = e.state.lastLedger;
    expect += l.sales - Object.values(l.supplies).reduce((a, b) => a + b, 0) - l.wages - l.packaging;
  }
  assert.ok(Math.abs(e.state.grossProfitTotal - expect) < 1e-6);
  assert.ok(e.state.grossProfitTotal > 0);
  const before = e.state.grossProfitTotal;
  e.state.cash = e.state.cash.add(1000);
  e.buyProject('cargo_wagon');
  e.hireFranchiseStand('leo');
  assert.equal(e.state.grossProfitTotal, before);
  const save = JSON.parse(JSON.stringify(e.toSave()));
  assert.equal(LemonadeEngine.fromSave(save).state.grossProfitTotal, before);
});

test('store shelves cost money, grow orders, and survive save and load', () => {
  const e = new LemonadeEngine({ seed: 22 });
  e.dadJumpToPhase(3);
  e.state.cash = e.state.cash.add(10000);
  const store = e.wholesaleAccounts.bodega;
  assert.equal(e.upgradeWholesaleAccount(store.id), false, 'unsigned stores cannot be upgraded');
  assert.ok(e.signWholesaleAccount(store.id));
  assert.equal(store.level, 1);
  const oldDemand = e.getDailyDemandEstimate().neededBottles;
  const cash = e.state.cash.toNumber();
  const cost = store.levels[1].cost;
  assert.equal(e.upgradeWholesaleAccount(store.id), false, 'sales and time are required');
  e.state.day += 2; e.state.totalBottlesSold += e.balance.expansion.storeBottles;
  const keptBefore = sim.ledgerKept(e.ledger);
  assert.ok(e.upgradeWholesaleAccount(store.id));
  assert.equal(sim.ledgerKept(e.ledger), keptBefore - cost);
  assert.equal(store.level, 2);
  assert.ok(e.getDailyDemandEstimate().neededBottles > oldDemand);
  assert.ok(Math.abs(e.state.cash.toNumber() - (cash - cost)) < 1e-6);
  assert.equal(e.ledger.storeUpgrades, cost);
  const loaded = LemonadeEngine.fromSave(JSON.parse(JSON.stringify(e.toSave())));
  assert.equal(loaded.wholesaleAccounts.bodega.level, 2);
  assert.equal(loaded.wholesaleAccounts.bodega.bottlesPerDay, store.bottlesPerDay);
  assert.equal(loaded.upgradeWholesaleAccount(store.id), false, 'progress survives loading');
  loaded.state.day += 2; loaded.state.totalBottlesSold += loaded.balance.expansion.storeBottles;
  assert.ok(loaded.upgradeWholesaleAccount(store.id));
  assert.equal(loaded.upgradeWholesaleAccount(store.id), false, 'maximum level cannot be upgraded');
  const other = loaded.wholesaleAccounts.market;
  loaded.state.day += 2; loaded.state.totalBottlesSold += loaded.balance.expansion.storeBottles;
  assert.ok(loaded.signWholesaleAccount(other.id));
  loaded.state.cash = loaded.state.cash.sub(loaded.state.cash);
  assert.equal(loaded.upgradeWholesaleAccount(other.id), false, 'cannot spend money not owned');
  assert.equal(other.level, 1);
});

test('invention counts actual bottle sales and saves progress', () => {
  const e = new LemonadeEngine({ seed: 23 });
  e.dadJumpToPhase(3);
  e.state.cash = e.state.cash.add(10000);
  const patent = e.projects.find(p => p.id === 'patent_filing');
  assert.equal(patent.unlocked(e.state), false);
  assert.equal(e.buyProject(patent.id), false);
  assert.ok(e.signWholesaleAccount('bodega'));
  Object.assign(e.state.inv, { lemons: 10000, sugar: 10000, ice: 10000, cups: 10000, bottles: 10000 });
  const day = e.runDay();
  assert.ok(day.bottlesSold > 0);
  assert.equal(e.state.totalBottlesSold, day.bottlesSold);
  const save = JSON.parse(JSON.stringify(e.toSave()));
  assert.equal(LemonadeEngine.fromSave(save).state.totalBottlesSold, day.bottlesSold);
  e.state.totalBottlesSold = 1499;
  assert.equal(patent.unlocked(e.state), false);
  e.state.totalBottlesSold = 1500;
  assert.equal(patent.unlocked(e.state), true);
  assert.ok(e.buyProject(patent.id));
  save.v -= 1;
  assert.equal(LemonadeEngine.fromSave(save), null, 'a save from an older version starts a new game');
});

test('the squeezer grows in four steps, each opened by lifetime squeezer sales', () => {
  const e = new LemonadeEngine({ seed: 71 });
  e.dadJumpToPhase(4);
  e.state.cash = e.state.cash.add(100000);
  assert.deepEqual([e.patent.level, e.patent.baseUnitsPerDay, e.patent.royaltyPerUnit], [1, 50, 2.5]);
  assert.equal(e.buyProject('squeezer_tv'), false, 'needs 300 squeezers sold');
  const first = e.runDay().patentUnitsSold;
  assert.ok(first > 0);
  assert.equal(e.state.totalSqueezersSold, first);

  const steps = [['squeezer_tv', 300, 2, 200, 2.5], ['squeezer_states', 2000, 3, 800, 2.75], ['global_licensing', 8000, 4, 3200, 3.25]];
  for (const [id, sales, level, perDay, royalty] of steps) {
    e.state.totalSqueezersSold = sales - 1;
    assert.equal(e.buyProject(id), false, id + ' waits for ' + sales + ' sold');
    e.state.totalSqueezersSold = sales;
    assert.ok(e.buyProject(id), id);
    assert.deepEqual([e.patent.level, e.patent.baseUnitsPerDay, e.patent.royaltyPerUnit], [level, perDay, royalty]);
  }
  const big = e.runDay().patentUnitsSold;
  assert.ok(big > 2500, 'worldwide sells about 3,200 a day');

  const save = JSON.parse(JSON.stringify(e.toSave()));
  const loaded = LemonadeEngine.fromSave(save);
  assert.equal(loaded.patent.level, 4);
  assert.equal(loaded.state.totalSqueezersSold, e.state.totalSqueezersSold);
});

test('kid shop offers the helpers in Stage 4, opens the factory after worldwide licensing and grows it in order across saves', () => {
  let e = new LemonadeEngine({ seed: 72 });
  e.dadJumpToPhase(4);
  e.state.cash = e.state.cash.add(100000000);
  for (const id of ['supply_truck', 'stand_captain']) {
    assert.equal(sim.kidShopNext(e, e.state).item.id, id);
    assert.ok(e.buyProject(id));
    assert.equal(sim.kidShopNext(e, e.state), null, 'shop waits after a purchase');
    e.state.day += 2;
  }
  assert.equal(sim.kidShopNext(e, e.state), null, 'factory waits for worldwide licensing');
  e.state.totalSqueezersSold = 8000;
  assert.ok(e.buyProject('global_licensing'));
  assert.equal(sim.kidShopNext(e, e.state), null, 'shop waits after a purchase');
  e.state.day += 2;
  const stages = [
    ['copacker_deal', 40], ['regional_supermarkets', 300], ['delivery_route', 300], ['automated_canning_line', 1500], ['flavor_lab', 1500],
    ['national_bigbox', 6000], ['club_store_pallets', 25000],
    ['qsr_fountain_licensing', 100000], ['global_beverage_jv', 350000],
  ];
  for (const [id, cases] of stages) {
    assert.equal(sim.kidShopNext(e, e.state).item.id, id);
    assert.ok(e.buyProject(id));
    assert.equal(e.copacker.casesPerDay, cases);
    assert.equal(sim.kidShopNext(e, e.state), null);
    e.state.day += 2;
    e = LemonadeEngine.fromSave(JSON.parse(JSON.stringify(e.toSave())));
    assert.equal(e.copacker.casesPerDay, cases);
  }
  assert.equal(sim.kidShopNext(e, e.state), null);
  const day = e.runDay();
  assert.ok(day.copackerCasesSold > 0 && day.copackerNet > 0);
  assert.equal(day.copackerNet, day.copackerCasesSold * e.copacker.netPerCase);
});

test('the Supply Truck shops for the forecast the moment it comes and every morning after', () => {
  const e = new LemonadeEngine({ seed: 74 });
  e.dadJumpToPhase(4);
  e.state.cash = e.state.cash.add(50000);
  Object.assign(e.state.inv, { lemons: 0, sugar: 0, cups: 0, bottles: 0 });
  assert.equal(e.getKidDemandAdvice().isFullyStocked, false);
  assert.ok(e.buyProject('supply_truck'));
  assert.equal(e.getKidDemandAdvice().isFullyStocked, true, 'stocked right away');
  for (let i = 0; i < 5; i++) {
    const day = e.runDay();
    assert.ok(day.drivewayCupsSold > 0 && !day.soldOut, 'nothing runs out');
    assert.equal(e.getKidDemandAdvice().isFullyStocked, true, 'the new morning is stocked too');
    const shopping = Object.values(e.ledger.supplies).reduce((a, b) => a + b, 0);
    assert.ok(shopping > 0, "the truck's shopping is in the new day's money diary");
  }
  const save = LemonadeEngine.fromSave(JSON.parse(JSON.stringify(e.toSave())));
  assert.equal(save.state.flags.hasSupplyTruck, true);
});

test('the Stand Captain hires the friends, prices at most fair, and sends a friend home on a losing day', () => {
  const e = new LemonadeEngine({ seed: 75 });
  e.dadJumpToPhase(4);
  e.state.cash = e.state.cash.add(50000);
  Object.values(e.franchiseStands).forEach(st => { st.hired = false; });
  e.state.friendExpansion = undefined;
  assert.ok(e.buyProject('stand_captain'));
  assert.ok(Object.values(e.franchiseStands).some(st => st.hired), 'hires a friend right away');
  e.state.friendExpansion = undefined;      // the next hire is open
  e.runHelpers();
  const price = e.state.recipe.pricePerCup;
  assert.equal(price, e.captainPrice());
  assert.equal(price * 4, Math.round(price * 4), 'a quarter step');

  // A hot sunny day: everybody works, except a friend whose pay is more than their stand sells.
  Object.values(e.franchiseStands).forEach(st => { st.hired = true; });
  Object.assign(e.state, { weather: 'SUNNY', tempF: 95 });
  e.runHelpers();
  assert.ok(Object.values(e.franchiseStands).every(st => !st.dayOff), 'a hot day: all work');
  const leo = Object.values(e.franchiseStands)[1];
  const pay = leo.dailyWage;
  leo.dailyWage = 100000;
  e.runHelpers();
  assert.equal(leo.dayOff, true, 'a friend who would cost more than they sell stays home');
  assert.ok(Object.values(e.franchiseStands).filter(st => st !== leo).every(st => !st.dayOff));
  // A cold, rainy day: nobody sells enough to cover their pay.
  leo.dailyWage = pay;
  Object.assign(e.state, { weather: 'RAINY', tempF: 40 });
  e.runHelpers();
  const est = Object.values(e.franchiseStands).map(st => st.dayOff);
  assert.ok(est.some(off => off), 'a losing day sends someone home');
  assert.ok(e.runDay().franchiseWagesPaid <= pay * 3);
});

test('the Delivery Route signs up and grows the stores when the store rules allow', () => {
  const e = new LemonadeEngine({ seed: 76 });
  e.dadJumpToPhase(5);
  e.state.cash = e.state.cash.add(10000000);
  const accounts = Object.values(e.wholesaleAccounts);
  accounts[2].active = false; accounts[2].level = 0;
  e.state.storeExpansion = undefined;
  assert.ok(e.buyProject('delivery_route'));
  assert.equal(accounts[2].active, true, 'signs the missing store first');
  assert.equal(accounts.filter(a => a.level > 1).length, 0, 'one store move at a time');
  for (let i = 0; i < 6; i++) {
    e.state.storeExpansion = { day: -100, bottles: -1000000 };   // the next move is open
    e.runHelpers();
  }
  assert.ok(accounts.every(a => a.level === a.levels.length), 'every shelf grows to the biggest');
});

test('the Flavor Lab: the testers point the way, and the right mix goes to the stores', () => {
  const e = new LemonadeEngine({ seed: 77 });
  e.dadJumpToPhase(5);
  e.state.cash = e.state.cash.add(1000000);
  assert.equal(e.currentFlavor(), null, 'no lab yet');
  assert.equal(e.runDay().flavorTaste, null);
  assert.ok(e.buyProject('flavor_lab'));
  assert.equal(e.currentFlavor().id, 'strawberry');
  assert.notDeepEqual(e.flavorGolden(), { fruit: 3, sugar: 3 }, 'never the starting mix');
  let days = 0, last;
  while (days < 12) {
    last = e.runDay().flavorTaste; days++;
    assert.equal(last.id, 'strawberry');
    if (last.launched) break;
    // Follow the comment: one scoop for "a little", two for "way".
    for (const [item, word] of [['fruit', 'strawberry'], ['sugar', 'sugar']]) {
      const m = last.review.quote.match(new RegExp(`(a little|way) (more|less) ${word}`));
      if (m) e.adjustFlavor(item, (m[2] === 'more' ? 1 : -1) * (m[1] === 'way' ? 2 : 1));
    }
  }
  assert.ok(last.launched && days <= 5, 'the comments lead to it in a few days');
  assert.deepEqual(e.state.flavorsLaunched, ['strawberry']);
  assert.equal(e.currentFlavor().id, 'peach', 'the next flavor starts');
  assert.deepEqual(e.state.flavorMix, { fruit: 3, sugar: 3 });

  // Same day twice from one save, with and without the flavor: 20% more cases.
  const save = JSON.stringify(e.toSave());
  const a = LemonadeEngine.fromSave(JSON.parse(save)), b = LemonadeEngine.fromSave(JSON.parse(save));
  assert.equal(a.currentFlavor().id, 'peach', 'saved');
  b.state.flavorsLaunched = [];
  const ca = a.runDay().copackerCasesSold, cb = b.runDay().copackerCasesSold;
  assert.ok(Math.abs(ca / cb - 1.2) < 0.01, `${ca} vs ${cb}`);
});

test('every flavor taste comment points toward the best mix', () => {
  for (const [dF, dS] of [[1, 0], [-2, 0], [0, 1], [0, -3], [2, -1], [-1, -1], [1, 2]]) {
    const q = sim.flavorTasteReview(dF, dS, 'mint', 'Mint Lemonade').quote;
    if (dF) assert.match(q, new RegExp(`${Math.abs(dF) >= 2 ? 'way' : 'a little'} ${dF < 0 ? 'more' : 'less'} mint`));
    else assert.doesNotMatch(q, /mint\./);
    if (dS) assert.match(q, new RegExp(`${Math.abs(dS) >= 2 ? 'way' : 'a little'} ${dS < 0 ? 'more' : 'less'} sugar`));
  }
  assert.match(sim.flavorTasteReview(0, 0, 'mint', 'Mint Lemonade').quote, /PERFECT/);
});

test('house upgrades go in order, wait for their stage, and save', () => {
  const e = new LemonadeEngine({ seed: 73 });
  const cash = (n) => { e.state.cash = e.state.cash.constructor.fromNumber(n); };
  cash(1000);
  assert.equal(e.nextHouseStep().id, 'paint');
  assert.equal(e.buyHouseStep(), false, 'paint waits for the house to open');
  e.state.houseOpen = true;
  assert.ok(e.buyHouseStep(), 'paint opens with the house, in Stage 1');
  assert.equal(e.state.houseLevel, 1);
  assert.equal(e.ledger.house, 250);
  assert.equal(e.state.cash.toNumber(), 750);
  cash(3000);
  assert.equal(e.buyHouseStep(), false, 'the second floor waits for Stage 2');
  e.dadJumpToPhase(2);
  assert.equal(e.state.houseColor, 'mint', 'fresh paint starts mint');
  assert.ok(e.setHouseColor('sky'));
  assert.equal(e.setHouseColor('plaid'), false);
  assert.equal(e.state.houseColor, 'sky');
  cash(3000);
  assert.ok(e.buyHouseStep(), 'second floor');
  assert.equal(e.nextHouseStep().id, 'treehouse');
  cash(100000);
  assert.equal(e.buyHouseStep(), false, 'the treehouse waits for Stage 3');
  const loaded = LemonadeEngine.fromSave(JSON.parse(JSON.stringify(e.toSave())));
  assert.equal(loaded.state.houseOpen, true);
  assert.equal(loaded.state.houseLevel, 2);
  assert.equal(loaded.nextHouseStep().id, 'treehouse');
  assert.equal(loaded.state.houseColor, 'sky');

  assert.equal(new LemonadeEngine({ seed: 75 }).setHouseColor('sky'), false, 'no repainting before Fresh Paint');
  const jumped = new LemonadeEngine({ seed: 76 });
  jumped.dadJumpToPhase(2);
  assert.equal(jumped.state.houseOpen, true, "Dad Mode's jump opens the house");
});

test('my house opens on the first quiet day after $2,000 in sales', () => {
  const e = new LemonadeEngine({ seed: 77 });
  const BigNum = e.state.cash.constructor;
  e.state.cash = BigNum.fromNumber(500);
  assert.equal(e.runDay().houseOpened, false);
  assert.equal(e.state.houseOpen, false, 'not before $2,000 in sales');

  e.state.totalRevenueEarned = BigNum.fromNumber(2000);
  e.state.lastShopPurchaseDay = e.state.day - 1;   // bought something yesterday: today shows the next item
  assert.equal(e.runDay().houseOpened, false, 'not on a day with other news');
  assert.equal(e.runDay().houseOpened, false, 'not the day the next shop item shows');
  const quiet = e.runDay();
  assert.equal(quiet.houseOpened, true, 'the first quiet day');
  assert.equal(e.state.houseOpen, true);
  assert.ok(otherUnlockToday(e.state, quiet), 'a magic look waits for another day');
  assert.equal(e.runDay().houseOpened, false, 'only once');

  // A kid who keeps buying never has a quiet day: past $5,000 the house opens anyway.
  const busy = new LemonadeEngine({ seed: 78 });
  busy.state.cash = BigNum.fromNumber(500);
  busy.state.totalRevenueEarned = BigNum.fromNumber(4000);   // the day's own sales stay under $5,000
  busy.state.lastShopPurchaseDay = busy.state.day - 1;
  assert.equal(busy.runDay().houseOpened, false, 'a busy day under $5,000 waits');
  busy.state.totalRevenueEarned = BigNum.fromNumber(5000);
  assert.equal(busy.runDay().houseOpened, true, 'a busy day at $5,000 opens it');
});

test('stores buy the forecast bottles, the forecast counts their lemons and sugar, and the labeler makes bottles cheaper', () => {
  const e = new LemonadeEngine({ seed: 52 });
  e.dadJumpToPhase(3);
  assert.equal(e.getDailyDemandEstimate().neededBottles, 0, 'no store signed, no bottles needed');
  const lemonsBefore = e.getDailyDemandEstimate().neededLemons;
  assert.ok(e.signWholesaleAccount('bodega'));
  const est = e.getDailyDemandEstimate();
  const want = est.storeEstimates.find(x => x.id === 'bodega').estBottles;
  assert.ok(want > 0);
  assert.equal(est.neededBottles, want);
  assert.ok(est.neededLemons > lemonsBefore, 'bottles use lemons too');
  e.state.inv.bottles = 0;
  assert.ok(e.getKidDemandAdvice().lowItems.includes('bottles'));
  assert.ok(e.autoRestockForToday().success);
  assert.ok(e.state.inv.bottles >= want);
  assert.equal(e.getKidDemandAdvice().lowItems.length, 0, 'restock covers stands and stores');
  const d = e.runDay();
  const st = d.stores.find(x => x.id === 'bodega');
  assert.equal(st.bottles, want);
  assert.equal(st.wanted, want);
  assert.equal(d.packagingCosts, 0, 'caps and labels are in the bottle price');
  const before = e.supplyPack('bottles').cost;
  e.state.cash = e.state.cash.add(1000);
  assert.equal(e.buyProject('commercial_labeler'), false, 'the labeler waits for 250 bottles sold');
  e.state.totalBottlesSold = 250;
  assert.ok(e.buyProject('commercial_labeler'));
  assert.ok(e.supplyPack('bottles').cost < before);
});

test('a broken or unknown save gives no game (a new one starts instead)', () => {
  assert.equal(LemonadeEngine.fromSave(null), null);
  assert.equal(LemonadeEngine.fromSave({ v: 999, seed: 1, state: {} }), null);
  assert.equal(LemonadeEngine.fromSave({ v: 1, seed: 1 }), null);
});

test('friends keep their work or day-off state across days and reloads', () => {
  let e = new LemonadeEngine({ seed: 31 });
  e.dadJumpToPhase(2);
  e.state.cash = e.state.cash.add(500);
  assert.equal(e.toggleFriendDayOff('sarah'), false, 'not hired');
  Object.values(e.franchiseStands).forEach(st => { st.hired = true; });
  assert.ok(e.toggleFriendDayOff('timmy'));
  assert.ok(e.toggleFriendDayOff('sarah'));
  for (let day = 0; day < 2; day++) {
    e.autoRestockForToday();
    const result = e.runDay();
    for (const id of ['timmy', 'sarah']) {
      const friend = result.friends.find(f => f.id === id);
      assert.deepEqual([friend.dayOff, friend.cups, friend.wage], [true, 0, 0]);
      assert.ok(!result.reviews.some(r => r.reviewer.startsWith(friend.workerName)));
      assert.equal(e.franchiseStands[id].dayOff, true);
    }
    assert.equal(result.franchiseWagesPaid, e.franchiseStands.leo.dailyWage);
    assert.ok(!e.franchiseStands.leo.dayOff, 'working friend stays working');
  }
  e = LemonadeEngine.fromSave(JSON.parse(JSON.stringify(e.toSave())));
  assert.equal(e.franchiseStands.timmy.dayOff, true);
  assert.equal(e.franchiseStands.sarah.dayOff, true);
  assert.ok(!e.franchiseStands.leo.dayOff);
  assert.ok(e.toggleFriendDayOff('timmy'));
  assert.ok(e.toggleFriendDayOff('leo'));
  e.autoRestockForToday();
  const next = e.runDay();
  assert.equal(next.friends.find(f => f.id === 'timmy').wage, e.franchiseStands.timmy.dailyWage);
  assert.deepEqual([next.friends.find(f => f.id === 'leo').dayOff, next.friends.find(f => f.id === 'leo').wage], [true, 0]);
  assert.equal(next.friends.find(f => f.id === 'sarah').wage, 0);
  assert.equal(next.franchiseWagesPaid, e.franchiseStands.timmy.dailyWage);
  assert.ok(!e.franchiseStands.timmy.dayOff && e.franchiseStands.leo.dayOff && e.franchiseStands.sarah.dayOff);
});

test('a friend with the day off says nothing in the report', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const e = new LemonadeEngine({ seed });
    e.dadJumpToPhase(2);
    e.state.cash = e.state.cash.add(500);
    e.franchiseStands.timmy.hired = true; e.franchiseStands.leo.hired = true;
    e.toggleFriendDayOff('leo');
    e.autoRestockForToday();
    const d = e.runDay();
    assert.ok(!d.reviews.some(r => r.reviewer.startsWith('Leo')), `seed ${seed}`);
  }
});


test('friend and store expansions require sales, time, and cash across saves', () => {
  let e = new LemonadeEngine({ seed: 301 });
  e.dadJumpToPhase(2);
  e.state.cash = e.state.cash.add(10000);
  assert.ok(e.hireFranchiseStand('sarah'), 'any friend can be first');
  assert.equal(e.hireFranchiseStand('timmy'), false);
  const initial = e.friendExpansionGoal();
  assert.equal(initial.remaining, 150);
  e.state.totalStandCupsSold += 150;
  assert.equal(e.hireFranchiseStand('timmy'), false, 'cannot hire on the same day');
  e.state.day += 2;
  e = LemonadeEngine.fromSave(JSON.parse(JSON.stringify(e.toSave())));
  assert.ok(e.hireFranchiseStand('timmy'));
  assert.equal(e.friendExpansionGoal().remaining, 300);
  assert.equal(e.hireFranchiseStand('leo'), false);
  e.state.totalStandCupsSold += 300; e.state.day += 2;
  assert.ok(e.hireFranchiseStand('leo'));
  e.state.phase = 3;
  assert.ok(e.signWholesaleAccount('market'), 'any store can be first');
  assert.equal(e.signWholesaleAccount('sports'), false);
  assert.equal(e.upgradeWholesaleAccount('market'), false);
  e.state.totalBottlesSold += 75;
  assert.equal(e.upgradeWholesaleAccount('market'), false, 'cannot expand on the same day');
  e.state.day += 2;
  assert.ok(e.upgradeWholesaleAccount('market'));
  assert.equal(e.storeExpansionGoal().remaining, 75);
  e.state.day += 2; e.state.totalBottlesSold += 75;
  assert.ok(e.signWholesaleAccount('sports'));
});

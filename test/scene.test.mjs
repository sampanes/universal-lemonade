import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LemonadeEngine, jumpToPhase, dayCrowds, crowdSize, shares } from '../.sim-build/index.js';

const sum = list => list.reduce((n, x) => n + x, 0);

test('each stand draws only people its real day had, and they add up to the real counts', () => {
  const e = new LemonadeEngine({seed: 41});
  jumpToPhase(e, 3);
  e.toggleFriendDayOff('leo');
  e.state.inv.cups = 2;
  const d = e.runDay();
  assert.deepEqual(d.standVisits.map(s => s.id), ['driveway', 'timmy', 'sarah']);
  assert.equal(d.standVisits.reduce((n,s) => n + s.sold, 0), d.drivewayCupsSold + d.franchiseCupsSold);
  for (const s of d.standVisits) {
    const [crowd] = dayCrowds([s]);
    assert.equal(sum(crowd.buyers), s.sold);
    assert.equal(sum(crowd.missed), s.wanted - s.sold);
    assert.equal(sum(crowd.passers), s.traffic - s.wanted);
    for (const share of [...crowd.buyers, ...crowd.missed, ...crowd.passers]) assert.ok(share >= 1);
  }
  assert.deepEqual(dayCrowds([{id:'driveway',traffic:0,wanted:0,sold:0}]),
    [{stand:'driveway', closed:false, buyers:[], missed:[], passers:[]}]);
});

test('a day off gets one closed stop in route order', () => {
  const e = new LemonadeEngine({seed: 41});
  jumpToPhase(e, 3);
  e.toggleFriendDayOff('leo');
  const d = e.runDay();
  const crowds = dayCrowds(d.standVisits, d.friends);
  assert.deepEqual(crowds.map(c => c.stand), ['driveway','timmy','leo','sarah']);
  assert.deepEqual(crowds[2], {stand:'leo', closed:true, buyers:[], missed:[], passers:[]});
});

test('a busier day draws a bigger crowd, up to a cap', () => {
  const buyers = n => crowdSize(n, 0.85, 8);
  assert.deepEqual([0, 1, 2, 10, 40, 100, 500, 100000].map(buyers), [0, 1, 2, 3, 5, 6, 8, 8]);
  for (let n = 1; n < 2000; n++) assert.ok(buyers(n + 1) >= buyers(n));
  assert.ok(crowdSize(3, 5, 8) <= 3);   // never more people than really came
});

test('a severe shortage shows more sold-out customers, bounded by real ones', () => {
  const misses = (wanted, sold) => dayCrowds([{id:'driveway',traffic:wanted,wanted,sold}])[0].missed.length;
  assert.equal(misses(20, 19), 1);
  assert.equal(misses(20, 0), 3);
  assert.equal(misses(500, 0), 4);
  assert.equal(misses(3, 0), 2);
  assert.equal(misses(20, 20), 0);
});

test('shares split a count evenly into whole people', () => {
  assert.deepEqual(shares(10, 3), [3, 3, 4]);
  assert.deepEqual(shares(7, 7), [1, 1, 1, 1, 1, 1, 1]);
  assert.equal(sum(shares(12345, 8)), 12345);
});

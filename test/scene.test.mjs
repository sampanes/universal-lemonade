import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LemonadeEngine, dayBeats } from '../.sim-build/index.js';

test('each open stand shows only encounters supported by its actual sales', () => {
  const e = new LemonadeEngine({seed: 41});
  e.dadJumpToPhase(3);
  e.toggleFriendDayOff('leo');
  e.state.inv.cups = 2;
  const d = e.runDay();
  assert.deepEqual(d.standVisits.map(s => s.id), ['driveway', 'timmy', 'sarah']);
  assert.equal(d.standVisits.reduce((n,s) => n + s.sold, 0), d.drivewayCupsSold + d.franchiseCupsSold);
  for (const s of d.standVisits) {
    const beats = dayBeats([s]).map(b => b.visit);
    assert.equal(beats.includes('sale'), s.sold > 0);
    assert.equal(beats.includes('short'), s.sold < s.wanted);
    assert.equal(beats.includes('walk'), s.traffic > s.wanted);
    if (beats.includes('short')) assert.equal(beats.at(-1), 'short');
  }
  assert.deepEqual(dayBeats([{id:'driveway',traffic:0,wanted:0,sold:0}]), [{stand:'driveway',visit:'quiet'}]);
});

test('a day off gets one closed stop in route order', () => {
  const e = new LemonadeEngine({seed: 41});
  e.dadJumpToPhase(3);
  e.toggleFriendDayOff('leo');
  const d = e.runDay();
  const beats = dayBeats(d.standVisits, d.friends);
  assert.deepEqual([...new Set(beats.map(b => b.stand))], ['driveway','timmy','leo','sarah']);
  assert.deepEqual(beats.filter(b => b.stand === 'leo'), [{stand:'leo', visit:'closed'}]);
});

test('a severe shortage shows more missed sales, bounded by real customers', () => {
  const misses = (wanted, sold) => dayBeats([{id:'driveway',traffic:wanted,wanted,sold}])
    .filter(b => b.visit === 'short').length;
  assert.equal(misses(20, 19), 1);
  assert.equal(misses(20, 0), 4);
  assert.equal(misses(2, 0), 2);
  assert.equal(misses(20, 20), 0);
});

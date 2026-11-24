// sim/run.ts -- Plays one game with a bot and records what happened.
import { LemonadeEngine } from '../src/engine';
import { BALANCE, type Balance } from '../src/balance';
import { BOTS } from './bots';

// Everything recorded about one game. Days are 1-based; NaN means "never happened".
export interface GameResult {
  seed: number;
  phase2Day: number;
  phase3Day: number;
  phase4Day: number;
  phase5Day: number;
  wonDay: number;
  finalPhase: number;
  finalCash: number;
  totalEarned: number;
  cashDay10: number;
  cashDay20: number;
  cashDay40: number;
  zeroCashDays: number;      // days that ended with the "Balance hit $0.00" bailout
  hitZero: number;           // 1 if that happened at least once, else 0
  lossDays: number;          // days with a negative profit
  choresDone: number;
  avgReputation: number;
  avgQuality: number;
  cupsDay1: number;          // cups sold at the driveway stand that day (not hired stands)
  cupsDay5: number;
  cupsDay10: number;
  buzzDay10: number;         // share of the neighborhood that knows the stand
  lockDay: number;           // day the neighbors locked the golden recipe in
  houseDay: number;          // day My House opened (src/data/house.ts)
}

export const METRICS: (keyof GameResult)[] = [
  'phase2Day', 'phase3Day', 'phase4Day', 'phase5Day', 'wonDay', 'finalPhase', 'finalCash', 'totalEarned',
  'cashDay10', 'cashDay20', 'cashDay40', 'zeroCashDays', 'hitZero', 'lossDays', 'choresDone', 'avgReputation', 'avgQuality',
  'cupsDay1', 'cupsDay5', 'cupsDay10', 'buzzDay10', 'lockDay', 'houseDay'
];

const PHASE_KEYS = ['phase2Day', 'phase3Day', 'phase4Day', 'phase5Day'] as const;

// Small, fast PRNG for the bot's own choices, so bot randomness never shifts the game's.
export function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Spreads consecutive game numbers over the 32-bit seed space.
export function seedForGame(baseSeed: number, gameIndex: number): number {
  let h = (baseSeed ^ Math.imul(gameIndex + 1, 0x9E3779B1)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B);
  h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
  h ^= h >>> 16;
  return h | 0 || 1;
}

export function runGame(seed: number, botName: string, days: number, balance: Balance = BALANCE): GameResult {
  const bot = BOTS[botName];
  if (!bot) throw new Error(`Unknown bot "${botName}". Bots: ${Object.keys(BOTS).join(', ')}`);
  const e = new LemonadeEngine({ seed, balance });
  const ctx = { rand: mulberry32(seed ^ 0x5bd1e995), day: 1, memory: {} as Record<string, number> };

  const r: GameResult = {
    seed, phase2Day: NaN, phase3Day: NaN, phase4Day: NaN, phase5Day: NaN, wonDay: NaN, finalPhase: 1,
    finalCash: 0, totalEarned: 0, cashDay10: NaN, cashDay20: NaN, cashDay40: NaN,
    zeroCashDays: 0, hitZero: 0, lossDays: 0, choresDone: 0, avgReputation: 0, avgQuality: 0,
    cupsDay1: NaN, cupsDay5: NaN, cupsDay10: NaN, buzzDay10: NaN, lockDay: NaN, houseDay: NaN
  };
  const origDoChore = e.doChore.bind(e);
  e.doChore = () => { const res = origDoChore(); if (res) r.choresDone++; return res; };

  let repSum = 0, qSum = 0;
  for (let d = 1; d <= days; d++) {
    ctx.day = d;
    bot.morning(e, ctx);
    const sum = e.runDay();
    e.tick(e.balance.secondsPerDay);
    const s = e.state;

    repSum += s.reputation;
    qSum += sum.recipeQuality;
    if (sum.netProfit < 0) r.lossDays++;
    if (sum.notes.some(n => n.includes('Balance hit $0.00'))) r.zeroCashDays++;
    // Record the first day each phase was reached (filling all lower ones too).
    for (let p = 2; p <= s.phase; p++) {
      const k = PHASE_KEYS[p - 2];
      if (Number.isNaN(r[k])) r[k] = d;
    }
    if (s.gameWon && Number.isNaN(r.wonDay)) r.wonDay = d;
    if (sum.recipeJustLocked) r.lockDay = d;
    if (sum.houseOpened) r.houseDay = d;
    const cups = sum.drivewayCupsSold;
    if (d === 1) r.cupsDay1 = cups;
    if (d === 5) r.cupsDay5 = cups;
    if (d === 10) { r.cupsDay10 = cups; r.buzzDay10 = s.buzz; }
    if (d === 10) r.cashDay10 = s.cash.toNumber();
    if (d === 20) r.cashDay20 = s.cash.toNumber();
    if (d === 40) r.cashDay40 = s.cash.toNumber();
  }

  const s = e.state;
  r.hitZero = r.zeroCashDays > 0 ? 1 : 0;
  r.finalPhase = s.phase;
  r.finalCash = s.cash.toNumber();
  r.totalEarned = s.totalRevenueEarned.toNumber();
  r.avgReputation = repSum / days;
  r.avgQuality = qSum / days;
  return r;
}

// Deep-copies the balance and applies "a.b.c" = value overrides.
export function withOverrides(overrides: Record<string, unknown>, base: Balance = BALANCE): Balance {
  const b = structuredClone(base) as Balance;
  for (const [path, value] of Object.entries(overrides)) {
    const keys = path.split('.');
    let obj: Record<string, unknown> = b as unknown as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) {
      if (typeof obj[k] !== 'object' || obj[k] === null) throw new Error(`No balance setting "${path}"`);
      obj = obj[k] as Record<string, unknown>;
    }
    const last = keys[keys.length - 1];
    if (!(last in obj)) throw new Error(`No balance setting "${path}"`);
    obj[last] = value;
  }
  return b;
}

// Plays games [start, start+count) and returns one Float64Array per metric (column store,
// cheap to send between worker threads).
export function runBatch(baseSeed: number, start: number, count: number, botName: string, days: number,
  overrides: Record<string, unknown> = {}): Record<string, Float64Array> {
  const balance = Object.keys(overrides).length ? withOverrides(overrides) : BALANCE;
  const cols: Record<string, Float64Array> = {};
  for (const m of METRICS) cols[m] = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const res = runGame(seedForGame(baseSeed, start + i), botName, days, balance);
    for (const m of METRICS) cols[m][i] = res[m] as number;
  }
  return cols;
}

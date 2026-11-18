// sim/report.ts -- Turns per-game columns into percentiles and a readable table.
import { METRICS } from './run';

export interface MetricSummary {
  reached: number;   // share of games where the value is not NaN (for "day reached" metrics)
  p10: number;
  p50: number;
  p90: number;
  mean: number;
}

export type Summary = Record<string, MetricSummary> & { games: { reached: number; p10: number; p50: number; p90: number; mean: number } };

function percentile(sorted: Float64Array, q: number): number {
  if (sorted.length === 0) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
}

export function summarize(cols: Record<string, Float64Array>): Summary {
  const out: Record<string, MetricSummary> = {};
  let n = 0;
  for (const m of METRICS) {
    const all = cols[m];
    n = all.length;
    const vals = all.filter(v => !Number.isNaN(v)).sort();
    let sum = 0;
    for (const v of vals) sum += v;
    out[m] = {
      reached: all.length ? vals.length / all.length : 0,
      p10: percentile(vals, 0.1),
      p50: percentile(vals, 0.5),
      p90: percentile(vals, 0.9),
      mean: vals.length ? sum / vals.length : NaN,
    };
  }
  return { ...out, games: { reached: 1, p10: n, p50: n, p90: n, mean: n } } as Summary;
}

// Merges column chunks from several workers into one set of columns.
export function concatColumns(chunks: Record<string, Float64Array>[]): Record<string, Float64Array> {
  const out: Record<string, Float64Array> = {};
  for (const m of METRICS) {
    const total = chunks.reduce((n, c) => n + c[m].length, 0);
    const arr = new Float64Array(total);
    let off = 0;
    for (const c of chunks) { arr.set(c[m], off); off += c[m].length; }
    out[m] = arr;
  }
  return out;
}

const money = (v: number) => Number.isNaN(v) ? '-' : `$${Math.round(v).toLocaleString('en-US')}`;
const num = (v: number, dp = 0) => Number.isNaN(v) ? '-' : v.toFixed(dp);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

// Rows shown in the table: [label, how to format a summary].
const ROWS: [string, (s: Summary) => string][] = [
  ['games', s => String(s.games.p50)],
  ['reach phase 2 (day p10/p50/p90)', s => `${pct(s.phase2Day.reached)}  ${num(s.phase2Day.p10)}/${num(s.phase2Day.p50)}/${num(s.phase2Day.p90)}`],
  ['reach phase 3', s => `${pct(s.phase3Day.reached)}  ${num(s.phase3Day.p10)}/${num(s.phase3Day.p50)}/${num(s.phase3Day.p90)}`],
  ['reach phase 4', s => `${pct(s.phase4Day.reached)}  ${num(s.phase4Day.p10)}/${num(s.phase4Day.p50)}/${num(s.phase4Day.p90)}`],
  ['reach phase 5', s => `${pct(s.phase5Day.reached)}  ${num(s.phase5Day.p10)}/${num(s.phase5Day.p50)}/${num(s.phase5Day.p90)}`],
  ['win the game', s => `${pct(s.wonDay.reached)}  ${num(s.wonDay.p50)}`],
  ['cash day 10 (p10/p50/p90)', s => `${money(s.cashDay10.p10)} / ${money(s.cashDay10.p50)} / ${money(s.cashDay10.p90)}`],
  ['cash day 20', s => `${money(s.cashDay20.p10)} / ${money(s.cashDay20.p50)} / ${money(s.cashDay20.p90)}`],
  ['cash day 40', s => `${money(s.cashDay40.p10)} / ${money(s.cashDay40.p50)} / ${money(s.cashDay40.p90)}`],
  ['total earned', s => `${money(s.totalEarned.p10)} / ${money(s.totalEarned.p50)} / ${money(s.totalEarned.p90)}`],
  ['games that hit $0 at least once', s => pct(s.hitZero.mean)],
  ['days at $0 (mean)', s => num(s.zeroCashDays.mean, 2)],
  ['losing days (mean)', s => num(s.lossDays.mean, 1)],
  ['chores done (p50/p90)', s => `${num(s.choresDone.p50)} / ${num(s.choresDone.p90)}`],
  ['avg reputation (p50)', s => num(s.avgReputation.p50, 2)],
  ['avg recipe quality (p50)', s => num(s.avgQuality.p50, 2)],
  ['driveway cups day 1 (p10/p50/p90)', s => `${num(s.cupsDay1.p10)} / ${num(s.cupsDay1.p50)} / ${num(s.cupsDay1.p90)}`],
  ['cups sold day 5', s => `${num(s.cupsDay5.p10)} / ${num(s.cupsDay5.p50)} / ${num(s.cupsDay5.p90)}`],
  ['cups sold day 10', s => `${num(s.cupsDay10.p10)} / ${num(s.cupsDay10.p50)} / ${num(s.cupsDay10.p90)}`],
  ['buzz day 10 (p10/p50/p90)', s => `${num(s.buzzDay10.p10, 2)} / ${num(s.buzzDay10.p50, 2)} / ${num(s.buzzDay10.p90, 2)}`],
];

// One column per run (e.g. per bot, or base vs --vs).
export function formatTable(runs: { label: string; summary: Summary }[]): string {
  const labelW = Math.max(...ROWS.map(r => r[0].length)) + 2;
  const cells = runs.map(r => ROWS.map(([, f]) => f(r.summary)));
  const colW = runs.map((r, i) => Math.max(r.label.length, ...cells[i].map(c => c.length)) + 2);
  const line = (label: string, vals: string[]) => label.padEnd(labelW) + vals.map((v, i) => v.padEnd(colW[i])).join('');
  const out = [line('', runs.map(r => r.label)), line('', runs.map((_, i) => '-'.repeat(colW[i] - 2)))];
  ROWS.forEach(([label], ri) => out.push(line(label, cells.map(c => c[ri]))));
  return out.join('\n');
}

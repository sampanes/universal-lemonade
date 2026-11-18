// sim/cli.mjs -- Plays many games headlessly across all CPU cores and prints a report.
//
//   npm run sim                                   1,000 games per bot, 60 days, all bots
//   npm run sim -- --games 100000 --bots careful,sloppy
//   npm run sim -- --days 40 --seed 7
//   npm run sim -- --set buzz.wordOfMouth=0.4
//   npm run sim -- --vs buzz.wordOfMouth=0.4     compare current vs changed
//   npm run sim -- --json results.json                    also save the numbers
//
// --set changes the balance for the whole run; --vs runs each bot twice (current settings,
// then current + the --vs changes) and prints the columns side by side. Both take
// comma-separated key=value pairs; keys are paths into src/balance.ts.
import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BUILD = new URL('../.sim-build/index.js', import.meta.url);
const sim = await import(BUILD.href);

function parseArgs(argv) {
  const opts = { games: 1000, days: 60, seed: 20251117, bots: Object.keys(sim.BOTS), set: {}, vs: null, json: '', threads: availableParallelism() };
  const pairs = (s) => Object.fromEntries(s.split(',').filter(Boolean).map(kv => {
    const i = kv.indexOf('=');
    if (i < 0) throw new Error(`Expected key=value, got "${kv}"`);
    const raw = kv.slice(i + 1);
    let val; try { val = JSON.parse(raw); } catch { val = raw; }
    return [kv.slice(0, i), val];
  }));
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === '--games') opts.games = Math.max(1, parseInt(next(), 10));
    else if (a === '--days') opts.days = Math.max(1, parseInt(next(), 10));
    else if (a === '--seed') opts.seed = parseInt(next(), 10);
    else if (a === '--bots') opts.bots = next().split(',');
    else if (a === '--set') Object.assign(opts.set, pairs(next()));
    else if (a === '--vs') opts.vs = pairs(next());
    else if (a === '--json') opts.json = next();
    else if (a === '--threads') opts.threads = Math.max(1, parseInt(next(), 10));
    else if (a === '--help' || a === '-h') { opts.help = true; }
    else throw new Error(`Unknown option ${a} (try --help)`);
  }
  return opts;
}

function runOnWorkers(opts, bot, overrides) {
  const threads = Math.min(opts.threads, opts.games);
  const per = Math.ceil(opts.games / threads);
  const jobs = [];
  for (let t = 0; t < threads; t++) {
    const start = t * per, count = Math.min(per, opts.games - start);
    if (count <= 0) break;
    jobs.push(new Promise((resolve, reject) => {
      const w = new Worker(fileURLToPath(new URL('./worker.mjs', import.meta.url)), {
        workerData: { build: BUILD.href, seed: opts.seed, start, count, bot, days: opts.days, overrides }
      });
      w.once('message', resolve);
      w.once('error', reject);
    }));
  }
  return Promise.all(jobs).then(chunks => sim.concatColumns(chunks));
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  const src = (await import('node:fs')).readFileSync(fileURLToPath(import.meta.url), 'utf8');
  console.log(src.split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
  console.log('Bots:\n' + Object.values(sim.BOTS).map(b => `  ${b.name.padEnd(17)} ${b.description}`).join('\n'));
  process.exit(0);
}
for (const b of opts.bots) if (!sim.BOTS[b]) throw new Error(`Unknown bot "${b}". Bots: ${Object.keys(sim.BOTS).join(', ')}`);
sim.withOverrides({ ...opts.set, ...(opts.vs || {}) }); // fail fast on a bad key

const t0 = performance.now();
const runs = [];
for (const bot of opts.bots) {
  const base = sim.summarize(await runOnWorkers(opts, bot, opts.set));
  runs.push({ label: opts.vs ? `${bot} (now)` : bot, summary: base });
  if (opts.vs) {
    const alt = sim.summarize(await runOnWorkers(opts, bot, { ...opts.set, ...opts.vs }));
    runs.push({ label: `${bot} (vs)`, summary: alt });
  }
}
const secs = (performance.now() - t0) / 1000;

console.log(`\n${opts.games.toLocaleString('en-US')} games x ${opts.days} days per column, seed ${opts.seed}, ${opts.threads} threads, ${secs.toFixed(1)} s`);
if (Object.keys(opts.set).length) console.log('set: ' + JSON.stringify(opts.set));
if (opts.vs) console.log('vs:  ' + JSON.stringify(opts.vs));
console.log('Values are p10 / p50 (median) / p90 across games; days are in-game days.\n');
console.log(sim.formatTable(runs));
if (opts.json) {
  writeFileSync(opts.json, JSON.stringify({ opts, runs }, null, 2));
  console.log(`\n[OK] wrote ${opts.json}`);
}

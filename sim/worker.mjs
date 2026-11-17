// sim/worker.mjs -- One worker thread: plays a slice of the games and sends back columns.
import { parentPort, workerData } from 'node:worker_threads';

const { build, seed, start, count, bot, days, overrides } = workerData;
const sim = await import(build);
const cols = sim.runBatch(seed, start, count, bot, days, overrides);
parentPort.postMessage(cols, Object.values(cols).map(a => a.buffer));

// sim/index.ts -- Entry point bundled to .sim-build/index.js for the CLI, workers and tests.
export { LemonadeEngine, BALANCE, DEFAULT_SEED, ledgerKept } from '../src/engine';
export { FIRST_CHOICE } from '../src/data/projects';
// The UI is plain JavaScript; Vite bundles it here for the shop progression test.
// @ts-expect-error The JavaScript UI has no TypeScript declarations.
export { kidShopNext } from '../src/ui/kidShop.js';
export { generateDailyReviews, flavorTasteReview } from '../src/simulation/reviews';
export { reputationTrend, nextReputation } from '../src/simulation/reputation';
export { allocateStandSales } from '../src/simulation/demand';
export { dayCrowds, crowdSize, shares } from '../src/scene/dayScene';
export { BOTS } from './bots';
export { runGame, runBatch, withOverrides, seedForGame, mulberry32, METRICS } from './run';
export { summarize, concatColumns, formatTable } from './report';
export { MILESTONES, SECRET_LOOKS, newUnlocks, unlockCheckFrom, lookOpen, advanceLookUnlocks, otherUnlockToday, shopReady, loadUnlocks, saveUnlocks } from '../src/unlocks';

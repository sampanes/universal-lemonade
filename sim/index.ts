// sim/index.ts -- Entry point bundled to .sim-build/index.js for the CLI, workers and tests.
export { LemonadeEngine, BALANCE, DEFAULT_SEED, ledgerKept } from '../src/engine';
export { FIRST_CHOICE } from '../src/data/projects';
export { TROPHIES, WALLPAPERS } from '../src/data/trophies';
export { YARD_STEPS, YARD_DAYS_BETWEEN } from '../src/data/yard';
export { nextShopOffer } from '../src/shop';
export { shelfItems, shelfTrophies } from '../src/shelf';
export { generateDailyReviews, flavorTasteReview } from '../src/simulation/reviews';
export { reputationTrend, nextReputation } from '../src/simulation/reputation';
export { allocateStandSales } from '../src/simulation/demand';
export { dayCrowds, crowdSize, shares } from '../src/scene/dayScene';
export { BOTS } from './bots';
export { jumpToPhase } from './jump';
export { runGame, runBatch, withOverrides, seedForGame, mulberry32, METRICS } from './run';
export { summarize, concatColumns, formatTable } from './report';
export { MILESTONES, SECRET_LOOKS, newUnlocks, unlockCheckFrom, lookOpen, advanceLookUnlocks, otherUnlockToday, shopReady, loadUnlocks, saveUnlocks } from '../src/unlocks';

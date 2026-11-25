// sim/bots.ts -- Simulated players. Each bot gets called once per in-game morning, makes its
// choices through the same engine API the page uses, and then the runner opens the stand.
//
// Bots only use what a kid can see on screen (yesterday's customer comments, the ice hint,
// the customer estimate) unless they are explicitly "perfect" players.

import type { LemonadeEngine } from '../src/engine';
import { SQUEEZER_LEVELS } from '../src/data/projects';
// @ts-expect-error The JavaScript UI has no TypeScript declarations.
import { kidShopNext } from '../src/ui/kidShop.js';

export interface BotContext {
  rand: () => number;          // the bot's own random numbers (separate from the game's)
  day: number;
  memory: Record<string, number>;
}

export interface Bot {
  name: string;
  description: string;
  morning(e: LemonadeEngine, ctx: BotContext): void;
}

const PRICE_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 5];

function goldenOf(e: LemonadeEngine): { lemons: number; sugar: number } {
  return e.getGoldenRecipe();
}

// Kid taps chores whenever the button is ready and cash is low. The runner advances the
// chore timer between days, so this models "did a few chores while waiting".
function choresIfBroke(e: LemonadeEngine, below: number, maxChores: number): void {
  for (let i = 0; i < maxChores && e.state.cash.toNumber() < below; i++) {
    e.tick(60);
    if (!e.doChore()) break;
  }
}

// Price that the forecast says brings in the most money today.
function bestForecastPrice(e: LemonadeEngine): number {
  const s = e.state;
  const keep = s.recipe.pricePerCup;
  let best = keep, bestRev = -1;
  for (const p of PRICE_STEPS) {
    s.recipe.pricePerCup = p;
    const rev = e.getDailyDemandEstimate().totalEstCups * p;
    if (rev > bestRev) { bestRev = rev; best = p; }
  }
  s.recipe.pricePerCup = keep;
  return best;
}

// Follows yesterday's taste comment (the page shows no taste score): one tap on each
// ingredient the customer mentioned ("a little more lemon and way less sugar").
function nudgeFromCustomers(e: LemonadeEngine): void {
  const last = e.state.lastDaySummary;
  const q = last?.reviews.find(r => r.topic === 'taste')?.quote ?? '';
  for (const item of ['lemons', 'sugar'] as const) {
    const word = item === 'lemons' ? 'lemon' : 'sugar';
    const m = q.match(new RegExp(`(a little|way) (more|less) ${word}`));
    if (m) e.adjustRecipe(item, m[2] === 'more' ? 1 : -1);
  }
}

// What the kid's page offers: the squeezer's next step on the Invention card, then the Stand
// Shop in its own order (kidShopNext: one item at a time, a day between buys, all the way to
// Citrus Cay). The shop starts with a choice (FIRST_CHOICE); games with an odd seed pick the
// second one first, so a run covers both. reserve: cash kept back besides today's supplies.
function buyUpgrades(e: LemonadeEngine, reserve: number, chance: number, rand: () => number): void {
  const s = e.state;
  const affordable = (cost: number) => s.cash.toNumber() >= cost + Math.max(reserve, e.restockCostForToday());
  const stepId = SQUEEZER_LEVELS[e.patent.level]?.project;
  const squeezer = stepId ? e.projects.find(p => p.id === stepId) : undefined;
  if (squeezer && !squeezer.purchased && squeezer.unlocked(s) && affordable(squeezer.costCash) && rand() < chance) {
    e.buyProject(squeezer.id);
    return;
  }
  const next = kidShopNext(e, s);
  if (!next) return;
  const p = next.choices ? next.choices[e.seed & 1].p : next.p;
  if (p.unlocked(s) && affordable(p.costCash) && rand() < chance) e.buyProject(p.id);
}

// Stage 5: the Flavor Lab's next try from yesterday's taste testers ("a little more
// strawberry and way less sugar"; "way" is two or more scoops off), and a brand move
// whenever the money is there.
function lateGame(e: LemonadeEngine): void {
  const s = e.state;
  const tasted = s.lastDaySummary?.flavorTaste;
  if (tasted && !tasted.launched && e.currentFlavor()?.id === tasted.id) {
    for (const item of ['fruit', 'sugar'] as const) {
      const re = item === 'sugar' ? /(a little|way) (more|less) sugar/ : /(a little|way) (more|less) (?!sugar)\w+/;
      const m = tasted.review.quote.match(re);
      if (m) e.adjustFlavor(item, (m[2] === 'more' ? 1 : -1) * (m[1] === 'way' ? 2 : 1));
    }
  }
  const step = e.nextBrandStep();
  if (step && e.brandOpen() && !e.brandWaitDays() && s.cash.toNumber() - e.restockCostForToday() >= step.cost) e.buyBrandStep();
}

function hireAndSign(e: LemonadeEngine, wageDaysReserve: number, chance: number, rand: () => number): void {
  const s = e.state;
  if (s.phase >= 2) {
    for (const st of Object.values(e.franchiseStands)) {
      if (st.hired) continue;
      if (s.cash.toNumber() >= st.setupCost + st.dailyWage * wageDaysReserve && rand() < chance) e.hireFranchiseStand(st.id);
    }
  }
  if (s.phase >= 3) {
    for (const acc of Object.values(e.wholesaleAccounts)) {
      if (!acc.active) {
        if (s.cash.toNumber() >= acc.setupCost * 1.5 && rand() < chance) e.signWholesaleAccount(acc.id);
      } else {
        const next = acc.levels[acc.level];
        if (next && s.cash.toNumber() >= next.cost * 1.5 && rand() < chance) e.upgradeWholesaleAccount(acc.id);
      }
    }
    const wanted = Object.values(e.wholesaleAccounts).filter(a => a.active).reduce((n, a) => n + a.bottlesPerDay, 0);
    while (s.inv.bottles < wanted && e.buySupplies('bottles', 1)) { /* keep buying */ }
  }
}

export const BOTS: Record<string, Bot> = {
  perfect: {
    name: 'perfect',
    description: 'Knows the golden recipe, ideal ice, best price; restocks to the forecast; buys each upgrade as soon as it can.',
    morning(e) {
      const s = e.state, g = goldenOf(e);
      s.recipe.lemonsPerPitcher = g.lemons;
      s.recipe.sugarPerPitcher = g.sugar;
      s.recipe.icePerCup = e.computeIdealIce();
      s.recipe.pricePerCup = bestForecastPrice(e);
      choresIfBroke(e, 15, 3);
      e.autoRestockForToday();
      buyUpgrades(e, 25, 1, () => 0);
      hireAndSign(e, 3, 1, () => 0);
      lateGame(e);
    }
  },

  careful: {
    name: 'careful',
    description: "Taps lemon and sugar once each as yesterday's customers suggest (the flavors too), uses the ice hint, charges $1.50, restocks to the forecast, buys the brand moves.",
    morning(e, ctx) {
      const s = e.state;
      nudgeFromCustomers(e);
      s.recipe.icePerCup = e.computeIdealIce();
      s.recipe.pricePerCup = 1.5;
      choresIfBroke(e, 10, 3);
      e.autoRestockForToday();
      buyUpgrades(e, 20, 1, ctx.rand);
      hireAndSign(e, 3, 1, ctx.rand);
      lateGame(e);
    }
  },

  nearGolden: {
    name: 'nearGolden',
    description: 'Like careful, but stuck one lemon over the golden recipe (to compare against golden).',
    morning(e, ctx) {
      const s = e.state, g = goldenOf(e);
      s.recipe.lemonsPerPitcher = g.lemons + 1;
      s.recipe.sugarPerPitcher = g.sugar;
      s.recipe.icePerCup = e.computeIdealIce();
      s.recipe.pricePerCup = 1.5;
      choresIfBroke(e, 10, 3);
      e.autoRestockForToday();
      buyUpgrades(e, 20, 1, ctx.rand);
      hireAndSign(e, 3, 1, ctx.rand);
      lateGame(e);
    }
  },

  goldenFixedPrice: {
    name: 'goldenFixedPrice',
    description: 'Like nearGolden but exactly on the golden recipe (the fair comparison for nearGolden).',
    morning(e, ctx) {
      const s = e.state, g = goldenOf(e);
      s.recipe.lemonsPerPitcher = g.lemons;
      s.recipe.sugarPerPitcher = g.sugar;
      s.recipe.icePerCup = e.computeIdealIce();
      s.recipe.pricePerCup = 1.5;
      choresIfBroke(e, 10, 3);
      e.autoRestockForToday();
      buyUpgrades(e, 20, 1, ctx.rand);
      hireAndSign(e, 3, 1, ctx.rand);
      lateGame(e);
    }
  },

  // Price-strategy bots: same perfect recipe, different prices, to see what cheap does.
  cheapskate: {
    name: 'cheapskate',
    description: 'Perfect recipe and upgrades like perfect, but always charges 50 cents.',
    morning(e) {
      BOTS.perfect.morning(e, { rand: () => 0, day: 0, memory: {} });
      e.state.recipe.pricePerCup = 0.5;
      e.autoRestockForToday();
    }
  },

  quarter: {
    name: 'quarter',
    description: 'Perfect recipe and upgrades like perfect, but always charges 25 cents.',
    morning(e) {
      BOTS.perfect.morning(e, { rand: () => 0, day: 0, memory: {} });
      e.state.recipe.pricePerCup = 0.25;
      e.autoRestockForToday();
    }
  },

  grandOpening: {
    name: 'grandOpening',
    description: 'Like perfect, but runs a 50-cent grand opening sale for the first 5 days.',
    morning(e, ctx) {
      BOTS.perfect.morning(e, ctx);
      if (ctx.day <= 5) {
        e.state.recipe.pricePerCup = 0.5;
        e.autoRestockForToday();
      }
    }
  },

  sloppy: {
    name: 'sloppy',
    description: 'Fiddles with the recipe at random, ignores the ice hint, random prices, forgets to restock sometimes.',
    morning(e, ctx) {
      const s = e.state, r = ctx.rand;
      if (r() < 0.5) {
        const k = r() < 0.5 ? 'lemonsPerPitcher' : 'sugarPerPitcher';
        s.recipe[k] = Math.max(1, Math.min(8, s.recipe[k] + (r() < 0.5 ? -1 : 1)));
      }
      if (r() < 0.2) s.recipe.icePerCup = 1 + Math.floor(r() * 4);
      if (r() < 0.3) s.recipe.pricePerCup = [1, 1.5, 2, 3][Math.floor(r() * 4)];
      choresIfBroke(e, 5, 2);
      if (r() < 0.7) {
        if (s.inv.cups < 40) e.buySupplies('cups', 1);
        if (s.inv.lemons < 20) e.buySupplies('lemons', 1);
        if (s.inv.sugar < 20) e.buySupplies('sugar', 1);
        if (s.inv.ice < 100) e.buySupplies('ice', 1);
      }
      buyUpgrades(e, 5, 0.3, r);
      hireAndSign(e, 1, 0.3, r);
    }
  },
};

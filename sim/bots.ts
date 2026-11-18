// sim/bots.ts -- Simulated players. Each bot gets called once per in-game morning, makes its
// choices through the same engine API the page uses, and then the runner opens the stand.
//
// Bots only use what a kid can see on screen (the quality percentage under the pitcher, the
// ideal-ice hint, the customer estimate) unless they are explicitly "perfect" players.

import type { LemonadeEngine } from '../src/engine';

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

export function goldenOf(e: LemonadeEngine): { lemons: number; sugar: number } {
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

// Hill-climb the recipe one tap at a time using the quality % the page shows.
function nudgeTowardBetterRecipe(e: LemonadeEngine): void {
  const r = e.state.recipe;
  const q0 = e.computeRecipeQuality();
  const moves: [keyof typeof r, number][] = [['lemonsPerPitcher', 1], ['lemonsPerPitcher', -1], ['sugarPerPitcher', 1], ['sugarPerPitcher', -1]];
  let best: [keyof typeof r, number] | null = null, bestQ = q0;
  for (const [k, d] of moves) {
    const v = r[k] + d;
    if (v < 1) continue;
    r[k] += d;
    const q = e.computeRecipeQuality();
    r[k] -= d;
    if (q > bestQ + 1e-9) { bestQ = q; best = [k, d]; }
  }
  if (best) r[best[0]] += best[1];
}

function buyUpgrades(e: LemonadeEngine, reserve: number, chance: number, rand: () => number): void {
  const s = e.state;
  for (const p of e.projects) {
    if (p.purchased || !p.unlocked(s)) continue;
    if (s.cash.toNumber() >= p.costCash + reserve && rand() < chance) e.buyProject(p.id);
  }
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
      if (acc.active) continue;
      if (s.cash.toNumber() >= acc.setupCost * 1.5 && rand() < chance) e.signWholesaleAccount(acc.id);
    }
    const wanted = Object.values(e.wholesaleAccounts).filter(a => a.active).reduce((n, a) => n + a.bottlesPerDay, 0);
    while (s.inv.bottles < wanted && e.buySupplies('bottles', 1)) { /* keep buying */ }
  }
}

function buyTrophies(e: LemonadeEngine, cashMultiple: number): void {
  const s = e.state;
  for (const t of e.trophies) {
    if (!t.purchased && t.phaseRequired <= s.phase && s.cash.toNumber() >= t.costCash * cashMultiple) e.buyTrophy(t.id);
  }
}

export const BOTS: Record<string, Bot> = {
  perfect: {
    name: 'perfect',
    description: 'Knows the golden recipe, ideal ice, best price; restocks to the forecast; upgrades early.',
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
      buyTrophies(e, 3);
    }
  },

  careful: {
    name: 'careful',
    description: 'Tweaks the recipe one tap a day toward a higher quality %, uses the ice hint, charges $1.50, restocks to the forecast.',
    morning(e, ctx) {
      const s = e.state;
      nudgeTowardBetterRecipe(e);
      s.recipe.icePerCup = e.computeIdealIce();
      s.recipe.pricePerCup = 1.5;
      choresIfBroke(e, 10, 3);
      e.autoRestockForToday();
      buyUpgrades(e, 20, 1, ctx.rand);
      hireAndSign(e, 3, 1, ctx.rand);
      buyTrophies(e, 4);
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
      buyTrophies(e, 4);
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
      buyTrophies(e, 4);
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
      buyTrophies(e, 1.2);
    }
  },
};

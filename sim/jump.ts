// sim/jump.ts -- skip a game ahead to the start of a later stage without playing to it, for
// tests and for looking at a late stage on the page. The game ends up as if it had been
// played there: the stand upgrades bought, the recipe locked golden, and every stage passed
// on the way finished (its upgrades bought, its friends hired, its stores signed). The target
// stage itself starts fresh. Nothing is charged and the money diary is untouched; cash and
// cups sold are raised to what a player usually has on arriving.
import { BigNum } from '../src/bignum';
import type { LemonadeEngine } from '../src/engine';
import type { GamePhase, ProjectDef } from '../src/types';

// The project bought in each stage that opens the next one (src/data/projects.ts).
const PHASE_OPENERS: Record<number, string> = {
  1: 'franchise_license',
  2: 'bottling_rig',
  3: 'patent_filing',
  4: 'copacker_deal',
};

// At least this much cash and this many cups sold on arrival. Rough amounts for a fresh start
// in each stage (enough to hire or sign the first thing, not enough to open the stage after it
// right away).
const ARRIVAL: Record<number, { cash: number; cups: number }> = {
  2: { cash: 200, cups: 120 },
  3: { cash: 600, cups: 1500 },
  4: { cash: 2500, cups: 6000 },
  5: { cash: 12000, cups: 20000 },
};

// false when the game is already at or past the target stage.
export function jumpToPhase(e: LemonadeEngine, target: GamePhase): boolean {
  const s = e.state;
  if (target <= s.phase || target > 5) return false;
  const giveFree = (p: ProjectDef) => { if (!p.purchased) { p.purchased = true; p.effect(e); } };

  for (const p of e.projects) if (p.phase === 1 && p.id !== PHASE_OPENERS[1]) giveFree(p);
  s.recipe.lemonsPerPitcher = s.goldenRecipe.lemons;
  s.recipe.sugarPerPitcher = s.goldenRecipe.sugar;
  s.goldenStreak = Math.max(s.goldenStreak, e.balance.recipe.lockStreak);
  s.recipeLocked = true;
  s.bestRecipeQuality = 1;
  s.avgRecipeQuality = Math.max(s.avgRecipeQuality, 0.95);
  s.reputation = Math.max(s.reputation, 0.85);

  while (s.phase < target) {
    const ph = s.phase;
    if (ph === 2) Object.values(e.franchiseStands).forEach(st => { st.hired = true; });
    if (ph === 3) Object.values(e.wholesaleAccounts).forEach(w => { w.active = true; w.level = 1; w.bottlesPerDay = w.levels[0].bottlesPerDay; });
    // This stage's upgrades first, then the one that opens the next stage.
    const opener = PHASE_OPENERS[ph];
    e.projects.filter(p => p.phase === ph && p.id !== opener).forEach(giveFree);
    const open = e.projects.find(p => p.id === opener);
    if (open) giveFree(open);
    if (s.phase === ph) s.phase = (ph + 1) as GamePhase;   // opener missing: step anyway
  }

  const arrive = ARRIVAL[target];
  s.houseOpen = true;   // every later stage is well past HOUSE_OPENS_AT_SALES
  if (s.cash.lt(arrive.cash)) s.cash = BigNum.fromNumber(arrive.cash);
  if (s.totalCupsSold.lt(arrive.cups)) s.totalCupsSold = BigNum.fromNumber(arrive.cups);
  return true;
}

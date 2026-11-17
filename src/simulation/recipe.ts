// src/simulation/recipe.ts -- Recipe quality scoring and the taste name / color under the pitcher.
import type { RecipeProfile, GoldenRecipe } from '../types';
import { computeIdealIce } from './weather';
import { BALANCE, type Balance } from '../balance';

export interface RecipeConfig {
  lemonsPerPitcher: number;
  sugarPerPitcher: number;
  icePerCup: number;
  pricePerCup: number;
}

// Picks this game's golden lemons:sugar from the seed. Uses its own hash of the seed rather
// than the game's random stream, so a given seed keeps the same weather and chores.
export function rollGoldenRecipe(seed: number, b: Balance = BALANCE): GoldenRecipe {
  const { goldenLemons: gl, goldenSugar: gs } = b.recipe;
  const nL = gl.max - gl.min + 1, nS = gs.max - gs.min + 1;
  let h = Math.imul(seed ^ 0x2545F491, 0x9E3779B1);
  h = Math.imul(h ^ (h >>> 15), 0x85EBCA6B);
  h ^= h >>> 13;
  const idx = (h >>> 0) % (nL * nS);
  return { lemons: gl.min + (idx % nL), sugar: gs.min + Math.floor(idx / nL) };
}

// 1.0 at the golden lemons:sugar with the ideal ice for the temperature; falls off with the
// squared distance from it.
export function computeRecipeQuality(recipe: RecipeConfig, tempF: number, golden: GoldenRecipe, b: Balance = BALANCE): number {
  const { lemonsPerPitcher: L, sugarPerPitcher: S, icePerCup: I } = recipe;
  const r = b.recipe;
  const idealI = computeIdealIce(tempF, b);
  const distSq = r.lemonWeight * Math.pow(L - golden.lemons, 2) + r.sugarWeight * Math.pow(S - golden.sugar, 2) + r.iceWeight * Math.pow(I - idealI, 2);
  return Math.exp(-distSq);
}

export function cupsPerPitcher(icePerCup: number, b: Balance = BALANCE): number {
  return b.recipe.cupsPerPitcherBase + icePerCup;
}

// Taste words are relative to this game's golden recipe, so "too sweet" means sweeter than
// golden, whatever golden happens to be.
export function getRecipeProfile(recipe: RecipeConfig, tempF: number, golden: GoldenRecipe, b: Balance = BALANCE): RecipeProfile {
  const quality = computeRecipeQuality(recipe, tempF, golden, b);
  const { lemonsPerPitcher: L, sugarPerPitcher: S } = recipe;
  const dL = L - golden.lemons;   // + means more lemon than golden
  const dS = S - golden.sugar;    // + means more sugar than golden
  const off = Math.abs(dL) + Math.abs(dS);

  let tasteName = "Refreshing Citrus Balance";
  // Natural progression: Clear -> Pleasant Soft Yellow -> Brownish Yellow (too dark)
  let liquidColor = "#FDE047"; // Pleasant natural soft yellow

  if (L <= 1 && S <= 1) {
    tasteName = "Just Plain Tap Water";
    liquidColor = "#E0F2FE"; // Clear soft water tint
  } else if (off === 0) {
    tasteName = "Golden Ratio Perfection";
    liquidColor = "#FACC15"; // Pleasant soft sunshine yellow (warm, not electric)
  } else if (dL <= -2) {
    tasteName = "Faint Lemon Water";
    liquidColor = "#FEF9C3"; // Very pale, near-clear soft lemon
  } else if (dS >= 3 || dS - dL >= 3) {
    tasteName = "Syrupy & Too Dark";
    liquidColor = "#B45309"; // Brownish yellow that's too dark
  } else if (dS - dL >= 2) {
    tasteName = "Sweet Honey Amber";
    liquidColor = "#D97706"; // Warm amber / brownish yellow
  } else if (dL - dS >= 3) {
    tasteName = "Super Tart Puckering";
    liquidColor = "#EAB308"; // Cloudy tart lemon
  } else if (off === 1) {
    tasteName = "Almost Golden!";
    liquidColor = "#FDE047";
  }

  return {
    quality,
    tasteName,
    liquidColor
  };
}

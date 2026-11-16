// src/simulation/recipe.ts — Recipe Quality Scoring & Sensory Profile
import type { RecipeProfile } from '../types';
import { computeIdealIce } from './weather';

export interface RecipeConfig {
  lemonsPerPitcher: number;
  sugarPerPitcher: number;
  icePerCup: number;
  pricePerCup: number;
}

export function computeRecipeQuality(recipe: RecipeConfig, tempF: number): number {
  const { lemonsPerPitcher: L, sugarPerPitcher: S, icePerCup: I } = recipe;
  const idealL = 4;
  const idealS = 4;
  const idealI = computeIdealIce(tempF);
  const distSq = 0.08 * Math.pow(L - idealL, 2) + 0.08 * Math.pow(S - idealS, 2) + 0.12 * Math.pow(I - idealI, 2);
  return Math.exp(-distSq);
}

export function getRecipeProfile(recipe: RecipeConfig, tempF: number): RecipeProfile {
  const quality = computeRecipeQuality(recipe, tempF);
  const { lemonsPerPitcher: L, sugarPerPitcher: S } = recipe;

  let tasteName = "Refreshing Citrus Balance";
  // Natural progression: Clear -> Pleasant Soft Yellow -> Brownish Yellow (too dark)
  let liquidColor = "#FDE047"; // Pleasant natural soft yellow

  if (L <= 1 && S <= 1) {
    tasteName = "Just Plain Tap Water";
    liquidColor = "#E0F2FE"; // Clear soft water tint
  } else if (L <= 2) {
    tasteName = "Faint Lemon Water";
    liquidColor = "#FEF9C3"; // Very pale, near-clear soft lemon
  } else if (S >= 7 || (S - L >= 3)) {
    tasteName = "Syrupy & Too Dark";
    liquidColor = "#B45309"; // Brownish yellow that's too dark
  } else if (S - L >= 2) {
    tasteName = "Sweet Honey Amber";
    liquidColor = "#D97706"; // Warm amber / brownish yellow
  } else if (L - S >= 3) {
    tasteName = "Super Tart Puckering";
    liquidColor = "#EAB308"; // Cloudy tart lemon
  } else if (quality >= 0.85) {
    tasteName = "Golden Ratio Perfection";
    liquidColor = "#FACC15"; // Pleasant soft sunshine yellow (warm, not electric)
  }

  return {
    quality,
    tasteName,
    liquidColor
  };
}

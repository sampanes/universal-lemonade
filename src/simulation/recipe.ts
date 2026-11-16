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
  let liquidColor = "#FFD700"; // Golden sunshine yellow

  if (L <= 2 && S <= 2) {
    tasteName = "Watery Lemonade";
    liquidColor = "#FFFACD"; // Very pale yellow
  } else if (L - S >= 2) {
    tasteName = "Super Sour Puckering";
    liquidColor = "#CCFF00"; // Neon acid greenish-yellow
  } else if (S - L >= 2) {
    tasteName = "Sweet & Syrupy";
    liquidColor = "#FFA500"; // Deep amber orange
  } else if (quality >= 0.85) {
    tasteName = "Golden Ratio Perfection";
    liquidColor = "#FFDE00"; // Vibrant golden citrus
  }

  return {
    quality,
    tasteName,
    liquidColor
  };
}

// src/data/wholesale.ts -- Wholesale Bottling Retail Accounts (Phase 3+)
import type { WholesaleAccount } from '../types';

export const BOTTLES_FOR_INVENTION = 1500;

export function createInitialWholesaleAccounts(): Record<string, WholesaleAccount> {
  return {
    bodega: {
      id: 'bodega',
      name: 'Corner Bodega & Deli',
      active: false,
      setupCost: 150,
      bottlesPerDay: 20,
      level: 0,
      levels: [{ cost: 150, bottlesPerDay: 20 }, { cost: 450, bottlesPerDay: 80 }, { cost: 1350, bottlesPerDay: 250 }],
      wholesalePrice: 2.40,
      weatherSens: 0.6,
      desc: 'A neighborhood shop with room to grow.'
    },
    market: {
      id: 'market',
      name: 'Saturday Farmers Market',
      active: false,
      setupCost: 250,
      bottlesPerDay: 20,
      level: 0,
      levels: [{ cost: 250, bottlesPerDay: 20 }, { cost: 750, bottlesPerDay: 80 }, { cost: 2250, bottlesPerDay: 280 }],
      wholesalePrice: 3.50,
      weatherSens: 1.5,
      desc: 'Weekend organic craft stall. Sells out premium bottles on sunny days!'
    },
    sports: {
      id: 'sports',
      name: 'Youth Sports Complex Concession',
      active: false,
      setupCost: 350,
      bottlesPerDay: 45,
      level: 0,
      levels: [{ cost: 350, bottlesPerDay: 45 }, { cost: 1050, bottlesPerDay: 180 }, { cost: 3150, bottlesPerDay: 600 }],
      wholesalePrice: 2.20,
      weatherSens: 1.3,
      desc: 'Supplies bottled sports drinks to concession stands across 4 fields.'
    }
  };
}

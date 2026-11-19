// src/data/wholesale.ts -- Wholesale Bottling Retail Accounts (Phase 3+)
import type { WholesaleAccount } from '../types';

export function createInitialWholesaleAccounts(): Record<string, WholesaleAccount> {
  return {
    bodega: {
      id: 'bodega',
      name: 'Corner Bodega & Deli',
      active: false,
      setupCost: 80.00,
      bottlesPerDay: 25,
      wholesalePrice: 2.40,
      weatherSens: 0.6,
      desc: 'Buys 25 bottled units daily for their refrigerated beverage case.'
    },
    market: {
      id: 'market',
      name: 'Saturday Farmers Market',
      active: false,
      setupCost: 140.00,
      bottlesPerDay: 60,
      wholesalePrice: 3.50,
      weatherSens: 1.5,
      desc: 'Weekend organic craft stall. Sells out premium bottles on sunny days!'
    },
    sports: {
      id: 'sports',
      name: 'Youth Sports Complex Concession',
      active: false,
      setupCost: 180.00,
      bottlesPerDay: 80,
      wholesalePrice: 2.20,
      weatherSens: 1.3,
      desc: 'Supplies bottled sports drinks to concession stands across 4 fields.'
    }
  };
}

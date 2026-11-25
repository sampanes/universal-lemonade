// src/data/franchise.ts -- the friends' stands (Stage 2+). Their pictures and looks are in
// src/ui/places.js.
import type { FranchiseStand } from '../types';

export function createInitialFranchiseStands(): Record<string, FranchiseStand> {
  return {
    timmy: {
      id: 'timmy',
      name: 'Elm Street',
      workerName: 'Timmy',
      hired: false,
      setupCost: 150.00,
      dailyWage: 12.00,
      baseCapacity: 35,
      weatherSens: 0.8,
      desc: 'Steady traffic on a quiet street. Timmy is reliable and easygoing.'
    },
    leo: {
      id: 'leo',
      name: 'Ballpark',
      workerName: 'Leo',
      hired: false,
      setupCost: 300.00,
      dailyWage: 16.00,
      baseCapacity: 70,
      weatherSens: 1.2,
      desc: 'Big crowds at weekend games and sunny tournaments.'
    },
    sarah: {
      id: 'sarah',
      name: 'Pool',
      workerName: 'Sarah',
      hired: false,
      setupCost: 600.00,
      dailyWage: 20.00,
      baseCapacity: 100,
      weatherSens: 1.8,
      desc: 'Sells the most on scorching days. Slow when it is cloudy.'
    }
  };
}

// src/data/franchise.ts — Neighborhood Franchise Stands (Phase 2+)
import type { FranchiseStand } from '../types';

export function createInitialFranchiseStands(): Record<string, FranchiseStand> {
  return {
    timmy: {
      id: 'timmy',
      name: 'Elm Street Stand',
      workerName: 'Timmy',
      location: 'Elm St & 4th Ave',
      hired: false,
      setupCost: 45.00,
      dailyWage: 12.00,
      baseCapacity: 35,
      weatherSens: 0.8,
      desc: 'Steady residential traffic. Timmy is reliable and easygoing.'
    },
    leo: {
      id: 'leo',
      name: 'Ballpark Stand',
      workerName: 'Leo',
      location: 'Little League Park',
      hired: false,
      setupCost: 75.00,
      dailyWage: 16.00,
      baseCapacity: 70,
      weatherSens: 1.2,
      desc: 'Crushes weekend games and sunny tournaments! Huge crowds.'
    },
    sarah: {
      id: 'sarah',
      name: 'Poolside Stand',
      workerName: 'Sarah',
      location: 'Community Pool Entrance',
      hired: false,
      setupCost: 95.00,
      dailyWage: 20.00,
      baseCapacity: 100,
      weatherSens: 1.8,
      desc: 'Insane volume on scorchers above 80°F! Slow when cloudy.'
    }
  };
}

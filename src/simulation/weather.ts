// src/simulation/weather.ts — Daily Weather Generation & Ice Calibration
import type { WeatherCondition } from '../types';

export function rollWeatherForecast(rand: () => number, weatherLocked95F: boolean = false): {
  weather: WeatherCondition;
  tempF: number;
} {
  if (weatherLocked95F) {
    return { weather: 'SUNNY', tempF: 95 };
  }
  const rW = rand();
  const weather: WeatherCondition = rW < 0.60 ? 'SUNNY' : rW < 0.85 ? 'CLOUDY' : 'RAINY';
  const baseTemp = weather === 'SUNNY' ? 82 : weather === 'CLOUDY' ? 72 : 62;
  const tempF = Math.round(baseTemp + (rand() - 0.5) * 24);
  return { weather, tempF };
}

export function computeIdealIce(tempF: number): number {
  return Math.max(1, Math.min(8, Math.round((tempF - 50) / 7)));
}

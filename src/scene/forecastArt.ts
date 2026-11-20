import type { WeatherCondition } from '../types';

export function skyCondition(weather: WeatherCondition, tempF: number) {
  return weather === 'RAINY' && tempF <= 32 ? 'SNOWY' : weather;
}

export function temperatureBand(tempF: number) {
  return tempF < 55 ? 'cold' : tempF < 70 ? 'cool' : tempF < 85 ? 'warm' : 'hot';
}

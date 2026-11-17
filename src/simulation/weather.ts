// src/simulation/weather.ts — Daily Weather Generation, 5-Day Seasons & Ice Calibration
import type { WeatherCondition, SeasonName, SeasonInfo } from '../types';
import { BALANCE, type Balance } from '../balance';

export function getSeasonInfo(day: number, b: Balance = BALANCE): SeasonInfo {
  const safeDay = Math.max(1, Math.floor(day));
  const seasonLength = b.weather.seasonLength;
  const daysInYear = seasonLength * 4; // 20 days per year
  const dayInYear = (safeDay - 1) % daysInYear; // 0..19
  const seasonIdx = Math.floor(dayInYear / seasonLength); // 0: Spring, 1: Summer, 2: Fall, 3: Winter
  const dayInSeason = (dayInYear % seasonLength) + 1; // 1..5
  const year = Math.floor((safeDay - 1) / daysInYear) + 1;

  const seasons: { name: SeasonName; displayName: string; icon: string }[] = [
    { name: 'SPRING', displayName: 'Spring', icon: '🌸' },
    { name: 'SUMMER', displayName: 'Summer', icon: '☀️' },
    { name: 'FALL', displayName: 'Fall', icon: '🍂' },
    { name: 'WINTER', displayName: 'Winter', icon: '❄️' }
  ];

  const current = seasons[seasonIdx];
  return {
    season: current.name,
    displayName: current.displayName,
    icon: current.icon,
    dayInSeason,
    seasonLength,
    year,
    badge: `${current.icon} ${current.displayName} · Day ${dayInSeason} of ${seasonLength}`
  };
}

export function rollWeatherForecast(
  rand: () => number,
  weatherLocked95F: boolean = false,
  day: number = 1,
  b: Balance = BALANCE
): {
  weather: WeatherCondition;
  tempF: number;
  seasonInfo: SeasonInfo;
} {
  const seasonInfo = getSeasonInfo(day, b);

  if (weatherLocked95F) {
    return { weather: 'SUNNY', tempF: b.weather.lockedTempF, seasonInfo };
  }

  // Spring warms up, summer peaks, fall cools down, winter bottoms out (curves in balance.ts).
  const sw = b.weather.seasons[seasonInfo.season];
  const step = seasonInfo.dayInSeason - 1;
  const rW = rand();
  const weather: WeatherCondition = rW < sw.sunnyBelow ? 'SUNNY' : rW < sw.cloudyBelow ? 'CLOUDY' : 'RAINY';
  const baseTemp = sw.tempCurve[step];
  const weatherDelta = sw.delta[weather];

  const jitter = (rand() - 0.5) * sw.jitter;
  const tempF = Math.max(b.weather.minF, Math.min(b.weather.maxF, Math.round(baseTemp + weatherDelta + jitter)));

  return { weather, tempF, seasonInfo };
}

export function computeIdealIce(tempF: number, b: Balance = BALANCE): number {
  return Math.max(b.ice.min, Math.min(b.ice.max, Math.round((tempF - b.ice.zeroAtF) / b.ice.degreesPerCube)));
}

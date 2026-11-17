// src/simulation/weather.ts — Daily Weather Generation, 5-Day Seasons & Ice Calibration
import type { WeatherCondition, SeasonName, SeasonInfo } from '../types';

export function getSeasonInfo(day: number): SeasonInfo {
  const safeDay = Math.max(1, Math.floor(day));
  const seasonLength = 5;
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
  day: number = 1
): {
  weather: WeatherCondition;
  tempF: number;
  seasonInfo: SeasonInfo;
} {
  const seasonInfo = getSeasonInfo(day);

  if (weatherLocked95F) {
    return { weather: 'SUNNY', tempF: 95, seasonInfo };
  }

  const step = seasonInfo.dayInSeason - 1; // 0..4
  const rW = rand();
  let weather: WeatherCondition = 'SUNNY';
  let baseTemp = 75;
  let weatherDelta = 0;
  let jitterScale = 5;

  switch (seasonInfo.season) {
    case 'SPRING': {
      // Lows ramp up: cool spring thaw into warm pre-summer (53°F -> 75°F)
      const curve = [53, 58, 64, 69, 75];
      baseTemp = curve[step];
      weather = rW < 0.55 ? 'SUNNY' : rW < 0.80 ? 'CLOUDY' : 'RAINY'; // 20% spring showers
      weatherDelta = weather === 'SUNNY' ? 3 : weather === 'CLOUDY' ? -2 : -6;
      jitterScale = 5;
      break;
    }
    case 'SUMMER': {
      // High scorchers: warm summer climbs into peak heatwave scorchers (82°F -> 96°F -> 85°F)
      const curve = [82, 88, 96, 92, 85];
      baseTemp = curve[step];
      weather = rW < 0.70 ? 'SUNNY' : rW < 0.85 ? 'CLOUDY' : 'RAINY'; // 15% summer thunderstorms
      weatherDelta = weather === 'SUNNY' ? 4 : weather === 'CLOUDY' ? -2 : -5;
      jitterScale = 6;
      break;
    }
    case 'FALL': {
      // Highs ramp down: crisp autumn cooling down toward winter (76°F -> 49°F)
      const curve = [76, 70, 63, 56, 49];
      baseTemp = curve[step];
      weather = rW < 0.55 ? 'SUNNY' : rW < 0.85 ? 'CLOUDY' : 'RAINY'; // 15% autumn drizzle
      weatherDelta = weather === 'SUNNY' ? 2 : weather === 'CLOUDY' ? -2 : -5;
      jitterScale = 5;
      break;
    }
    case 'WINTER': {
      // Cold freeze: winter chill dipping down to annual freeze (46°F -> 36°F -> 47°F)
      const curve = [46, 41, 36, 42, 47];
      baseTemp = curve[step];
      weather = rW < 0.45 ? 'SUNNY' : rW < 0.80 ? 'CLOUDY' : 'RAINY'; // 45% bright sunny winter days
      weatherDelta = weather === 'SUNNY' ? 2 : weather === 'CLOUDY' ? -2 : -5;
      jitterScale = 5;
      break;
    }
  }

  const jitter = (rand() - 0.5) * jitterScale;
  const tempF = Math.max(32, Math.min(108, Math.round(baseTemp + weatherDelta + jitter)));

  return { weather, tempF, seasonInfo };
}

export function computeIdealIce(tempF: number): number {
  return Math.max(1, Math.min(8, Math.round((tempF - 50) / 7)));
}

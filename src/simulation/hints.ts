// src/simulation/hints.ts -- Kid-friendly words for the morning weather card.
//
// The card used to show "Expect ~44 cups" and "Ideal: 1 cube/cup". Those numbers gave the
// answer away and made the card busy. The cup count is gone (the pantry tip covers it), and
// the ice hint says it in words, following the kid's own ice setting until it matches.

// How busy the day looks, 1 (slow) to 4 (huge crowd), from weather and heat only (not the
// recipe or price), so it reads like a weather report. Shown as lit-up cups, not words.
// outdoorMult = weather multiplier * temperature factor (see computeDayDemand).
export function crowdLevel(outdoorMult: number): 1 | 2 | 3 | 4 {
  if (outdoorMult < 0.35) return 1;
  if (outdoorMult < 0.7) return 2;
  if (outdoorMult < 1.15) return 3;
  return 4;
}

export type IceMood = 'right' | 'more' | 'less';

export interface IceHint {
  mood: IceMood;
  text: string;
}

// How the kid's ice per cup compares to today's ideal.
export function iceHint(currentIce: number, idealIce: number, tempF: number): IceHint {
  const diff = idealIce - currentIce;
  // Kept to a few words: the card was too busy with text.
  if (diff === 0) return { mood: 'right', text: 'Perfect ice!' };
  if (diff > 0) {
    if (diff >= 3) return { mood: 'more', text: 'Way more ice!' };
    return { mood: 'more', text: tempF >= 80 ? 'Hot! More ice' : 'More ice' };
  }
  if (diff <= -3) return { mood: 'less', text: 'Way less ice' };
  return { mood: 'less', text: tempF < 65 ? 'Chilly! Less ice' : 'Less ice' };
}

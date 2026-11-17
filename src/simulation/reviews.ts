// src/simulation/reviews.ts — In-Character Customer Reviews & Teammate Feedback
import type { CustomerReview, FranchiseStand, GameState } from '../types';
import { computeIdealIce } from './weather';
import { BALANCE, type Balance } from '../balance';

export interface ReviewGenerationParams {
  state: GameState;
  franchiseStands: Record<string, FranchiseStand>;
  tempF: number;
  quality: number;
  pricePerCup: number;
  fairPrice: number;
  drivewayCupsSold: number;
  franchiseCupsSold: number;
  soldOutStands: string[];
  bottleneck?: string;
  rand: () => number;
  balance?: Balance;
}

export function generateDailyReviews(params: ReviewGenerationParams): CustomerReview[] {
  const { state: s, franchiseStands, tempF, quality, pricePerCup, fairPrice, soldOutStands, bottleneck, rand } = params;
  const reviews: CustomerReview[] = [];
  const { lemonsPerPitcher: L, sugarPerPitcher: S, icePerCup: I } = s.recipe;
  const idealI = computeIdealIce(tempF, params.balance ?? BALANCE);
  const priceRatio = pricePerCup / fairPrice;
  // Taste is judged against this game's golden recipe: + means more than golden.
  const dL = L - s.goldenRecipe.lemons;
  const dS = S - s.goldenRecipe.sugar;
  const off = Math.abs(dL) + Math.abs(dS);

  // 1. TASTE / RECIPE REVIEW
  if (dL - dS >= 2) {
    reviews.push({
      stars: 1,
      quote: "My whole face puckered up! Did you forget the sugar?!",
      reviewer: "Elm St. neighbor",
      sentiment: "negative"
    });
  } else if (dS - dL >= 2) {
    reviews.push({
      stars: 2,
      quote: "Liquid sugar shock! Tastes more like melted candy than lemonade.",
      reviewer: "Dentist on Elm St.",
      sentiment: "negative"
    });
  } else if (idealI - I >= 2) {
    reviews.push({
      stars: 2,
      quote: tempF >= 80
        ? `It's ${tempF}°F outside and this was lukewarm... needed ice!`
        : "Barely cool, could definitely use more ice cubes.",
      reviewer: "Pool lifeguard",
      sentiment: "negative"
    });
  } else if (I - idealI >= 3) {
    reviews.push({
      stars: 2,
      quote: "Cup was 90% ice cubes! More ice than actual lemonade.",
      reviewer: "Little League coach",
      sentiment: "negative"
    });
  } else if (dL <= -2 && dS <= -2) {
    reviews.push({
      stars: 1,
      quote: "Tastes mostly like tap water. Where are the lemons?",
      reviewer: "Dog walker",
      sentiment: "negative"
    });
  } else if (off > 0 && off <= 2) {
    // Close but not golden: a friendly nudge in the right direction.
    const hint = Math.abs(dL) >= Math.abs(dS)
      ? (dL < 0 ? "Tasty! A little more lemon would make it perfect." : "Really good, just a tiny bit too lemony.")
      : (dS < 0 ? "Yum! Could be just a little sweeter." : "Nice, though a hair too sweet for me.");
    reviews.push({
      stars: 4,
      quote: hint,
      reviewer: "Lemonade fan next door",
      sentiment: "positive"
    });
  } else if (off === 0 && quality >= 0.88) {
    const praises = [
      { quote: "Absolute perfection! Crisp, ice-cold, and perfectly tangy.", reviewer: "Local foodie" },
      { quote: "Best lemonade on the block! The recipe is dialed in 100%.", reviewer: "Mail carrier" },
      { quote: "Five stars! Whatever you did to this batch, don't change a thing!", reviewer: "Little League parent" },
      { quote: "The golden ratio! Crisp, sweet, and wonderfully refreshing.", reviewer: "Bicycle kid" }
    ];
    const picked = praises[Math.floor(rand() * praises.length)];
    reviews.push({
      stars: 5,
      quote: picked.quote,
      reviewer: picked.reviewer,
      sentiment: "positive"
    });
  } else {
    reviews.push({
      stars: 4,
      quote: "Solid, refreshing cup of lemonade. Hit the spot!",
      reviewer: "Next-door neighbor",
      sentiment: "positive"
    });
  }

  // 2. PRICE / VALUE REVIEW
  if (priceRatio >= 1.40) {
    reviews.push({
      stars: 1,
      quote: `$${pricePerCup.toFixed(2)} for a paper cup?! Highway robbery!`,
      reviewer: "Thrifty neighbor",
      sentiment: "negative"
    });
  } else if (priceRatio >= 1.18) {
    reviews.push({
      stars: 2,
      quote: `$${pricePerCup.toFixed(2)} is a bit steep for kid lemonade, but I was thirsty.`,
      reviewer: "Dog walker",
      sentiment: "mixed"
    });
  } else if (priceRatio <= 0.70) {
    reviews.push({
      stars: 5,
      quote: `Only $${pricePerCup.toFixed(2)}?! Best deal in town, I bought two!`,
      reviewer: "Teen on a scooter",
      sentiment: "positive"
    });
  } else {
    reviews.push({
      stars: 4,
      quote: "Fair price for cold fresh lemonade on a day like this.",
      reviewer: "Neighborhood regular",
      sentiment: "positive"
    });
  }

  // 3. TEAM CHATTER & SIMPLE FRANCHISE MESSAGES (Timmy, Leo, Sarah)
  const hiredStands = Object.values(franchiseStands).filter(st => st.hired);
  if (hiredStands.length > 0) {
    const stand = hiredStands[Math.floor(rand() * hiredStands.length)];
    if (soldOutStands.length > 0) {
      const item = bottleneck || 'supplies';
      let msg = `Hey boss, we had a line of customers today, but ran out of ${item}! Buy extra tomorrow!`;
      if (item.toLowerCase().includes('ice')) {
        msg = `Huge crowd today, but we ran out of ice cubes early! Grab an extra bag of ice tomorrow!`;
      } else if (item.toLowerCase().includes('cup')) {
        msg = `We blew through all our cups! Customers kept asking for refills.`;
      } else if (item.toLowerCase().includes('lemon')) {
        msg = `Pitcher's empty! We ran out of fresh lemons to mix more lemonade.`;
      }
      reviews.push({
        stars: 3,
        quote: msg,
        reviewer: `${stand.workerName} (${stand.name})`,
        sentiment: 'mixed'
      });
    } else {
      const victoryMsgs = [
        `Crushed it today! Served every single customer on our street!`,
        `Great shift, boss! Customers loved the cold lemonade!`,
        `Sold out all our cups today! That was so much fun!`
      ];
      reviews.push({
        stars: 5,
        quote: victoryMsgs[Math.floor(rand() * victoryMsgs.length)],
        reviewer: `${stand.workerName} (${stand.name})`,
        sentiment: 'positive'
      });
    }
  } else if (soldOutStands.length > 0) {
    reviews.push({
      stars: 2,
      quote: `Walked over to the driveway stand, but they were sold out of supplies early!`,
      reviewer: "Thirsty neighbor",
      sentiment: "negative"
    });
  }

  return reviews;
}

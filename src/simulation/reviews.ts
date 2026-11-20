// src/simulation/reviews.ts -- In-Character Customer Reviews & Teammate Feedback
import type { CustomerReview, FranchiseStand, GameState } from '../types';
import { computeIdealIce } from './weather';
import { BALANCE, type Balance } from '../balance';

export interface ReviewGenerationParams {
  state: GameState;
  franchiseStands: Record<string, FranchiseStand>;
  tempF: number;
  pricePerCup: number;
  fairPrice: number;
  totalTraffic: number;
  drivewayCupsSold: number;
  franchiseCupsSold: number;
  soldOutStands: string[];
  bottleneck?: string;
  rand: () => number;
  balance?: Balance;
  recipeJustLocked?: boolean;
}

// What one customer says about the taste. dL / dS = lemons / sugar minus golden (+ = too many);
// streak = golden open days in a row, counting today.
export function tasteReview(dL: number, dS: number, streak: number, justLocked: boolean, rand: () => number): CustomerReview {
  // Face: watery when both are short, sour when it leans lemony (more lemon or less sugar,
  // which also covers "super strong"), sweet otherwise, happy at golden.
  const face: CustomerReview['face'] =
    dL === 0 && dS === 0 ? 'happy'
    : dL < 0 && dS < 0 ? 'watery'
    : dL > 0 || dS < 0 ? 'sour'
    : 'sweet';
  let bubble = 'Just right!';
  if (dL < 0 && dS < 0) bubble = 'Tastes watery!';
  else if (dL > 0 && dS > 0) bubble = 'Super strong!';
  else if (dS > 0) bubble = 'Too sweet!';
  else if (dL > 0) bubble = 'Too lemony!';
  else if (dS < 0) bubble = 'Needs more sugar!';
  else if (dL < 0) bubble = 'Needs more lemon!';
  const taste = (stars: number, quote: string, reviewer: string): CustomerReview => ({
    stars, quote, reviewer, bubble, topic: 'taste', face: justLocked ? 'happy' : face,
    sentiment: stars >= 4 ? 'positive' : stars === 3 ? 'mixed' : 'negative'
  });

  if (justLocked) {
    return taste(5, "Everybody is talking about it: your lemon and sugar are GOLDEN!", "The whole neighborhood");
  }
  if (dL === 0 && dS === 0) {
    if (streak >= 2) {
      return taste(5, "Perfect again! Keep the same lemon and sugar!", "Your regular customers");
    }
    const praises = [
      { quote: "This is the PERFECT amount of lemon and sugar!", reviewer: "Local foodie" },
      { quote: "Best lemonade on the block! Not too sour, not too sweet.", reviewer: "Mail carrier" },
      { quote: "This is exactly how lemonade should taste!", reviewer: "Little League parent" },
      { quote: "Crisp, sweet and tangy. Perfect!", reviewer: "Bicycle kid" }
    ];
    const p = praises[Math.floor(rand() * praises.length)];
    return taste(5, p.quote, p.reviewer);
  }

  // Off golden: say which way to go for each ingredient that is off, "a little" for one
  // step and "way" for two or more.
  const amount = (d: number) => (Math.abs(d) >= 2 ? 'way' : 'a little');
  const parts: string[] = [];
  if (dL !== 0) parts.push(`${amount(dL)} ${dL < 0 ? 'more' : 'less'} lemon`);
  if (dS !== 0) parts.push(`${amount(dS)} ${dS < 0 ? 'more' : 'less'} sugar`);
  const off = Math.abs(dL) + Math.abs(dS);

  let headline: string, reviewer: string;
  if (off === 1) {
    [headline, reviewer] = ['So close!', 'Lemonade fan next door'];
  } else if (dL < 0 && dS < 0) {
    [headline, reviewer] = ['Kind of watery.', 'Dog walker'];
  } else if (dL > 0 && dS > 0) {
    [headline, reviewer] = ['Whoa, super strong!', 'Mail carrier'];
  } else if (dL > 0 || dS < 0) {
    // More lemon than golden, or less sugar: it tastes sour.
    [headline, reviewer] = [dS === 0 ? 'Too lemony!' : dL === 0 ? 'Not sweet enough.' : 'Too sour!', 'Elm St. neighbor'];
  } else {
    // Less lemon or more sugar: it tastes sweet.
    [headline, reviewer] = [dL === 0 ? 'Too sweet!' : dS === 0 ? 'Not lemony enough.' : 'Way too sweet!', 'Dentist on Elm St.'];
  }
  const stars = Math.max(1, 5 - off);
  return taste(stars, `${headline} Try ${parts.join(' and ')}.`, reviewer);
}

export function generateDailyReviews(params: ReviewGenerationParams): CustomerReview[] {
  const { state: s, franchiseStands, tempF, pricePerCup, fairPrice, soldOutStands, bottleneck, rand } = params;
  const reviews: CustomerReview[] = [];
  const { lemonsPerPitcher: L, sugarPerPitcher: S, icePerCup: I } = s.recipe;
  const idealI = computeIdealIce(tempF, params.balance ?? BALANCE);
  const priceRatio = pricePerCup / fairPrice;
  // Taste is judged against this game's golden recipe: + means more than golden.
  const dL = L - s.goldenRecipe.lemons;
  const dS = S - s.goldenRecipe.sugar;

  // 1. TASTE and ICE. Customers are how a kid finds the golden recipe (there is no score on
  // screen), so every recipe that is not golden gets a hint pointing the right way, without
  // numbers. Nobody tastes anything on a day with no sales.
  const sold = params.drivewayCupsSold + params.franchiseCupsSold;
  if (sold > 0) {
    // Once the recipe is locked the kid already knows it is golden: no more taste comments
    // (the lock day itself still gets its announcement).
    if (!s.recipeLocked || params.recipeJustLocked) {
      reviews.push(tasteReview(dL, dS, s.goldenStreak ?? 0, !!params.recipeJustLocked, rand));
    }

    if (idealI - I >= 2) {
      reviews.push({
        stars: 2,
        bubble: "Needs more ice!",
        quote: tempF >= 80
          ? `It's ${tempF} degrees outside and this was lukewarm... needed more ice!`
          : "Barely cool, could definitely use more ice cubes.",
        reviewer: "Pool lifeguard",
        sentiment: "negative",
        topic: 'ice'
      });
    } else if (I - idealI >= 3) {
      reviews.push({
        stars: 2,
        bubble: "Too much ice!",
        quote: "Cup was mostly ice cubes! More ice than actual lemonade.",
        reviewer: "Little League coach",
        sentiment: "negative",
        topic: 'ice'
      });
    }
  }

  // 2. PRICE / VALUE REVIEW
  // On a day nobody bought anything, only "too expensive" makes sense (no one "bought two").
  const priceStart = reviews.length;
  const dayDescription = tempF < 45 ? 'cold' : tempF < 55 ? 'very cool'
    : tempF < 65 ? 'cool' : tempF < 75 ? 'warm' : tempF < 85 ? 'very warm'
    : tempF < 95 ? 'hot' : 'very hot';
  const weatherDay = `a ${dayDescription} day`;
  if (params.totalTraffic === 0 || (sold === 0 && priceRatio < 1.18)) {
    // no price comment
  } else if (priceRatio >= (params.balance ?? BALANCE).reputation.excessivePriceRatio) {
    reviews.push({
      stars: 1,
      bubble: tempF >= 85 ? "Too much, even today!" : tempF < 65 ? "Too much for a cool day!" : "Too pricey for me!",
      quote: tempF >= 85
        ? `$${pricePerCup.toFixed(2)} is a lot, even on ${weatherDay}.`
        : tempF < 45 ? `$${pricePerCup.toFixed(2)}? It's too cold out for that price!`
        : tempF < 65 ? `$${pricePerCup.toFixed(2)}? It's not hot enough out for that!`
        : `$${pricePerCup.toFixed(2)} is too high for ${weatherDay}.`,
      reviewer: "Thrifty neighbor",
      sentiment: "negative"
    });
  } else if (priceRatio >= 1.18) {
    reviews.push({
      stars: 2,
      bubble: tempF >= 85 ? "Pricey, even in this heat!" : "A little pricey!",
      quote: tempF >= 85
        ? `$${pricePerCup.toFixed(2)} is a little steep, even for ${weatherDay}.`
        : tempF >= 65 ? `$${pricePerCup.toFixed(2)} is a little pricey.`
        : `$${pricePerCup.toFixed(2)} is a little steep for ${weatherDay}.`,
      reviewer: "Dog walker",
      sentiment: "mixed"
    });
  } else if (priceRatio <= 0.45) {
    reviews.push({
      stars: 5,
      bubble: "I'd pay more!",
      quote: `$${pricePerCup.toFixed(2)}? I'd pay more!`,
      reviewer: "Teen on a scooter",
      sentiment: "positive"
    });
  } else if (priceRatio <= 0.70) {
    reviews.push({
      stars: 5,
      bubble: "What a deal!",
      quote: `$${pricePerCup.toFixed(2)}? Great deal on ${weatherDay}!`,
      reviewer: "Teen on a scooter",
      sentiment: "positive"
    });
  } else {
    reviews.push({
      stars: 4,
      bubble: "Fair price!",
      quote: `Fair price for ${weatherDay}!`,
      reviewer: "Neighborhood regular",
      sentiment: "positive"
    });
  }

  for (const r of reviews.slice(priceStart)) r.topic = 'price';

  // 3. TEAM CHATTER & SIMPLE FRANCHISE MESSAGES (Timmy, Leo, Sarah)
  // Only friends who worked and actually ran short can report their own shortage.
  const hiredStands = Object.values(franchiseStands).filter(st => st.hired && !st.dayOff);
  const shortFriends = hiredStands.filter(st => soldOutStands.includes(st.name));
  if (shortFriends.length > 0) {
    const stand = shortFriends[Math.floor(rand() * shortFriends.length)];
    const item = bottleneck || 'supplies';
    reviews.push({
      stars: 3,
      quote: `We ran out of ${item.toLowerCase()} today!`,
      reviewer: `${stand.workerName} (${stand.name})`,
      sentiment: 'mixed',
      topic: 'team'
    });
  } else if (soldOutStands.includes('Driveway Stand')) {
    reviews.push({
      stars: 2,
      quote: `The driveway stand ran out of supplies early!`,
      reviewer: "Thirsty neighbor",
      sentiment: "negative",
      topic: 'stock'
    });
  } else if (hiredStands.length > 0) {
    const stand = hiredStands[Math.floor(rand() * hiredStands.length)];
    reviews.push({
      stars: params.franchiseCupsSold > 0 ? 5 : 3,
      quote: params.franchiseCupsSold > 0 ? 'Ready for another day, boss!' : 'No cups sold at our stands today.',
      reviewer: `${stand.workerName} (${stand.name})`,
      sentiment: params.franchiseCupsSold > 0 ? 'positive' : 'mixed',
      topic: 'team'
    });
  }

  return reviews;
}

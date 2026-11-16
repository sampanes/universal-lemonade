// src/data/trophies.ts — 15 Lifestyle Trophies across 4 Career Tiers
import type { LifestyleTrophy } from '../types';

export function createInitialTrophies(): LifestyleTrophy[] {
  return [
    {
      id: 'skateboard',
      name: 'Custom Pro Skateboard & Helmet',
      emoji: '🛹',
      category: 'kid',
      costCash: 85,
      purchased: false,
      desc: 'Custom grip tape and smooth abec-9 bearings. Roll up to the stand in style.',
      perkDesc: 'Speedy Chore Travel: reduces chore cooldown by 25%!',
      phaseRequired: 1
    },
    {
      id: 'mountain_bike',
      name: 'Trek Mountain Bike with Front Basket',
      emoji: '🚲',
      category: 'kid',
      costCash: 280,
      purchased: false,
      desc: '21-speed aluminum frame bike with a heavy-duty front rack for grocery runs.',
      perkDesc: 'Grocery Hauler: +25% bonus supplies on all store pack purchases!',
      phaseRequired: 1
    },
    {
      id: 'nintendo_switch',
      name: 'Nintendo Switch OLED & Mario Kart',
      emoji: '🎮',
      category: 'kid',
      costCash: 350,
      purchased: false,
      desc: 'Game behind the stand on slow cloudy afternoons. Total neighborhood envy.',
      perkDesc: 'Good Vibes: +5% customer happiness & reputation floor!',
      phaseRequired: 1
    },
    {
      id: 'electric_scooter',
      name: 'Segway Ninebot Electric Scooter',
      emoji: '🛴',
      category: 'kid',
      costCash: 650,
      purchased: false,
      desc: 'Zip between Timmy, Leo, and Sarahs stands in seconds to check stock.',
      perkDesc: 'Manager Mobility: +15% capacity boost to all franchise stands!',
      phaseRequired: 2
    },
    {
      id: 'ipad_pro',
      name: 'iPad Pro & Apple Pencil',
      emoji: '📱',
      category: 'teen',
      costCash: 900,
      purchased: false,
      desc: 'Design high-res glossy flyers and track real-time franchise supply spreadsheets.',
      perkDesc: 'Digital Supply Chain: +10% sales throughput across all stands!',
      phaseRequired: 2
    },
    {
      id: 'disney_vip',
      name: 'VIP Disney World Family Vacation',
      emoji: '🏰',
      category: 'teen',
      costCash: 3500,
      purchased: false,
      desc: 'Treated the entire family to 5-star resort suites. Mom and Dad are in awe.',
      perkDesc: 'Family Pride: Permanent +15% Neighborhood Reputation!',
      phaseRequired: 2
    },
    {
      id: 'first_car',
      name: '2012 Honda Civic Hatchback',
      emoji: '🚗',
      category: 'teen',
      costCash: 8500,
      purchased: false,
      desc: 'Your first car! Fold-down rear seats easily hold 25 crates of bottled lemonade.',
      perkDesc: 'Wholesale Delivery Driver: cuts wholesale packaging delivery friction by 30%!',
      phaseRequired: 3
    },
    {
      id: 'garage_arcade',
      name: 'Garage HQ Renovation & Arcade Cabinet',
      emoji: '🕹️',
      category: 'teen',
      costCash: 15000,
      purchased: false,
      desc: 'Epoxy floors, stainless steel juicing tables, and a Street Fighter arcade machine.',
      perkDesc: 'Corporate Headquarters: +15% brand multiplier across all wholesale accounts!',
      phaseRequired: 3
    },
    {
      id: 'college_fund',
      name: 'College Tuition Prepaid in Full',
      emoji: '🎓',
      category: 'teen',
      costCash: 50000,
      purchased: false,
      desc: 'Paid 4 full years of college tuition before high school graduation. Mom cried tears of joy.',
      perkDesc: 'Total Peace of Mind: permanent 1.25x Brand Multiplier on all sales!',
      phaseRequired: 3
    },
    {
      id: 'tesla_model_x',
      name: 'Tesla Model X (LEM0N8 Plates)',
      emoji: '⚡',
      category: 'mogul',
      costCash: 95000,
      purchased: false,
      desc: 'Falcon-wing doors with a custom sunshine-yellow wrap and personalized plates.',
      perkDesc: 'Luxury Tech Flex: +20% patent licensing royalties!',
      phaseRequired: 4
    },
    {
      id: 'pay_mortgage',
      name: 'Paid Off Mom & Dads 30-Year Mortgage',
      emoji: '🏡',
      category: 'mogul',
      costCash: 450000,
      purchased: false,
      desc: 'Handed your parents the mortgage deed marked PAID IN FULL. Legend of the neighborhood.',
      perkDesc: 'Neighborhood Saint: Locks Neighborhood Reputation permanently at 100%!',
      phaseRequired: 4
    },
    {
      id: 'lemon_grove',
      name: '100-Acre California Lemon Grove',
      emoji: '🍋',
      category: 'mogul',
      costCash: 1200000,
      purchased: false,
      desc: 'Your own certified organic citrus orchards in Santa Barbara, California.',
      perkDesc: 'Free Lemons Forever: Grove delivers 500 fresh lemons every morning for $0!',
      phaseRequired: 4
    },
    {
      id: 'private_jet',
      name: 'Gulfstream G650 Private Jet',
      emoji: '✈️',
      category: 'billionaire',
      costCash: 65000000,
      purchased: false,
      desc: 'Yellow-trimmed private jet to negotiate international appliance rights in London and Tokyo.',
      perkDesc: 'Global Dealmaker: Doubles all patent royalties worldwide!',
      phaseRequired: 5
    },
    {
      id: 'arena_naming',
      name: 'Naming Rights: The Lemonade Center Arena',
      emoji: '🏟️',
      category: 'billionaire',
      costCash: 80000000,
      purchased: false,
      desc: 'Your brand name glowing across the 20,000-seat professional sports arena downtown.',
      perkDesc: 'Worldwide Fame: Doubles all supermarket co-packer demand!',
      phaseRequired: 5
    },
    {
      id: 'private_island',
      name: 'Buy Citrus Cay Private Caribbean Island',
      emoji: '🏝️',
      category: 'billionaire',
      costCash: 150000000,
      purchased: false,
      desc: 'A 500-acre tropical private island with citrus orchards, white sand beaches, and an infinity pool filled with iced lemonade.',
      perkDesc: 'THE GRAND VICTORY: You won the game! Retires to paradise and unlocks Golden Seeds (+50% Empire Profit)!',
      phaseRequired: 5
    }
  ];
}

// Who the day scene shows at each stand. The engine counts real people (a handful on Day 1,
// thousands later on), so the scene draws a crowd that grows with the logarithm of each
// count: about one more person every time the real number doubles, up to a cap. Each drawn
// person stands for a share of the real count, and the counters under the scene add those
// shares up to the real totals.
export interface StandVisits {
  id: string;
  traffic: number;   // people who walked by, buyers included
  wanted: number;    // of those, people who wanted a cup
  sold: number;      // cups sold (one per person)
}

export interface StandCrowd {
  stand: string;
  closed: boolean;     // a friend's day off
  buyers: number[];    // cups each drawn buyer stands for (adds up to sold)
  missed: number[];    // people each drawn sold-out customer stands for (adds up to wanted - sold)
  passers: number[];   // people each drawn passer-by stands for (adds up to traffic - wanted)
}

// Drawn people for a real count: perDoubling more each time the count doubles, never more
// than the count itself or the cap.
export function crowdSize(count: number, perDoubling: number, cap: number): number {
  if (count <= 0) return 0;
  return Math.min(count, cap, Math.ceil(Math.log2(count + 1) * perDoubling));
}

// total split into parts whole numbers as even as possible (they add up to total).
export function shares(total: number, parts: number): number[] {
  return Array.from({ length: parts }, (_, i) => Math.floor(total * (i + 1) / parts) - Math.floor(total * i / parts));
}

const CROWD = {
  buyers: { perDoubling: 0.85, cap: 8 },    // 1 cup: 1, 10: 3, 40: 5, 100: 6, 500+: 8
  passers: { perDoubling: 0.7, cap: 6 },    // 1: 1, 10: 3, 30: 4, 100: 5, 300+: 6
  missed: { perDoubling: 0.6, cap: 4 },     // 1 or 2: 1, 3: 2, 10: 3, 100+: 4
};

function standCrowd({ id, traffic, wanted, sold }: StandVisits): StandCrowd {
  const missed = Math.max(0, wanted - sold);
  const passing = Math.max(0, traffic - wanted);
  const group = (count: number, size: { perDoubling: number; cap: number }) =>
    shares(count, crowdSize(count, size.perDoubling, size.cap));
  return {
    stand: id, closed: false,
    buyers: group(sold, CROWD.buyers),
    missed: group(missed, CROWD.missed),
    passers: group(passing, CROWD.passers),
  };
}

// Every stand in route order: the kid's own stand, then each hired friend (one closed stop
// for a friend on a day off).
export function dayCrowds(stands: StandVisits[], friends: { id: string; dayOff: boolean }[] = []): StandCrowd[] {
  const open = stands.map(standCrowd);
  if (!friends.length) return open;
  const closed = (stand: string): StandCrowd => ({ stand, closed: true, buyers: [], missed: [], passers: [] });
  return [
    ...open.filter(crowd => crowd.stand === 'driveway'),
    ...friends.flatMap(friend => friend.dayOff ? [closed(friend.id)] : open.filter(crowd => crowd.stand === friend.id)),
  ];
}

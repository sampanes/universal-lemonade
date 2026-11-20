// A short sample of the day's foot traffic. Each active stand gets a turn.
export interface StandVisits {
  id: string;
  traffic: number;
  wanted: number;
  sold: number;
}

export type Visit = 'walk' | 'sale' | 'short' | 'quiet' | 'closed';
export interface SceneBeat { stand: string; visit: Visit }

export function dayBeats(stands: StandVisits[], friends: {id: string; dayOff: boolean}[] = []): SceneBeat[] {
  const open = stands.flatMap(({ id, traffic, wanted, sold }) => {
    const visits: Visit[] = [];
    if (traffic > wanted) visits.push('walk');
    if (sold > 0) visits.push('sale');
    // The simulation records totals, so use the fraction turned away to suggest
    // how early stock ran out. Never depict more disappointed kids than missed cups.
    const missed = wanted - sold;
    if (missed > 0) {
      const count = Math.min(missed, Math.ceil(4 * missed / wanted));
      for (let i = 0; i < count; i++) visits.push('short');
    }
    if (!visits.length) visits.push('quiet');
    if (visits.length === 1 && sold > 1) visits.push('sale');
    return visits.map(visit => ({ stand: id, visit }));
  });
  if (!friends.length) return open;
  return [
    ...open.filter(beat => beat.stand === 'driveway'),
    ...friends.flatMap((friend): SceneBeat[] => friend.dayOff
      ? [{ stand: friend.id, visit: 'closed' }]
      : open.filter(beat => beat.stand === friend.id))
  ];
}

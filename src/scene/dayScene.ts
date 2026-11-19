// A short sample of the day's foot traffic. Each active stand gets a turn.
export interface StandVisits {
  id: string;
  traffic: number;
  wanted: number;
  sold: number;
}

export type Visit = 'walk' | 'sale' | 'short' | 'quiet';
export interface SceneBeat { stand: string; visit: Visit }

export function dayBeats(stands: StandVisits[]): SceneBeat[] {
  return stands.flatMap(({ id, traffic, wanted, sold }) => {
    const visits: Visit[] = [];
    if (traffic > wanted) visits.push('walk');
    if (sold > 0) visits.push('sale');
    if (sold < wanted) visits.push('short');
    if (!visits.length) visits.push('quiet');
    if (visits.length === 1 && sold > 1) visits.push('sale');
    return visits.map(visit => ({ stand: id, visit }));
  });
}

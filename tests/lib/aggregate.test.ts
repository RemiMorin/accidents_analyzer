import { describe, it, expect } from 'vitest';
import { countBy, stats } from '../../src/lib/aggregate';
import type { Collisions } from '../../src/lib/contract';
import type { FilterState } from '../../src/lib/filters';

const data: Collisions = {
  count: 4,
  year: [2020, 2020, 2021, 2021],
  month: [1, 1, 2, 3],
  timeBand: [0, 1, 2, 3],
  weekday: [0, 0, 1, 1],
  severity: [0, 1, 1, 2],
  userType: [0, 0, 1, 0],
  regionCode: [3, 3, 6, 3],
  lighting: [1, 1, 1, 1], weather: [11, 11, 11, 11], environment: [2, 2, 2, 2], speed: [50, 50, 50, 50],
};
const idx = [0, 1, 2, 3];

describe('countBy', () => {
  it('counts by a field ascending', () => {
    expect(countBy(data, idx, 'severity')).toEqual([
      { key: 0, count: 1 }, { key: 1, count: 2 }, { key: 2, count: 1 },
    ]);
  });
  it('counts by region', () => {
    expect(countBy(data, idx, 'regionCode')).toEqual([
      { key: 3, count: 3 }, { key: 6, count: 1 },
    ]);
  });
});

describe('stats', () => {
  const f: FilterState = { years: [2020, 2021], userType: 'both', severities: [], regions: [] };
  it('computes headline numbers over the selected span', () => {
    const s = stats(data, idx, f);
    expect(s.total).toBe(4);
    expect(s.pedestrian).toBe(3);
    expect(s.cyclist).toBe(1);
    expect(s.fatalSeriousShare).toBeCloseTo(0.25); // 1 of 4 is severity 0
    expect(s.perYear).toBeCloseTo(2); // 4 over 2 years
    expect(s.perDay).toBeCloseTo(4 / 731); // 2020(366)+2021(365)
  });
});

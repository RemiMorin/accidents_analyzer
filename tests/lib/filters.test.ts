import { describe, it, expect } from 'vitest';
import { applyFilters, type FilterState } from '../../src/lib/filters';
import type { Collisions } from '../../src/lib/contract';

const data: Collisions = {
  count: 3,
  year: [2015, 2018, 2021],
  month: [1, 2, 3],
  timeBand: [0, 1, 2],
  weekday: [0, 0, 1],
  severity: [0, 1, 2],
  userType: [0, 1, 0],
  regionCode: [3, 6, 3],
  lighting: [1, 1, 1], weather: [11, 11, 11], environment: [2, 2, 2], speed: [50, 50, 50],
};
const base: FilterState = { years: [2011, 2022], userType: 'both', severities: [], regions: [] };

describe('applyFilters', () => {
  it('returns all indices with an empty filter', () => {
    expect(applyFilters(data, base)).toEqual([0, 1, 2]);
  });
  it('filters by year range inclusive', () => {
    expect(applyFilters(data, { ...base, years: [2016, 2021] })).toEqual([1, 2]);
  });
  it('filters by user type', () => {
    expect(applyFilters(data, { ...base, userType: 'cyclist' })).toEqual([1]);
  });
  it('filters by severities (subset)', () => {
    expect(applyFilters(data, { ...base, severities: [0, 2] })).toEqual([0, 2]);
  });
  it('filters by region codes (subset)', () => {
    expect(applyFilters(data, { ...base, regions: [6] })).toEqual([1]);
  });
  it('combines filters with AND', () => {
    expect(applyFilters(data, { ...base, regions: [3], userType: 'pedestrian' })).toEqual([0, 2]);
  });
});

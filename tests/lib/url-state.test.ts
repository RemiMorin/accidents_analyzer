import { describe, it, expect } from 'vitest';
import { defaultFilter, toQuery, parseQuery } from '../../src/lib/url-state';
import type { Meta } from '../../src/lib/contract';

const meta: Meta = {
  generatedAt: '', total: 0, years: [2015, 2016, 2020, 2021, 2022], regionCodes: [3, 6, 16],
};

describe('url-state', () => {
  it('default filter spans full meta range and is empty query', () => {
    const f = defaultFilter(meta);
    expect(f.years).toEqual([2015, 2022]);
    expect(toQuery(f, meta)).toBe('');
  });
  it('round-trips a non-default filter', () => {
    const f = { years: [2016, 2021] as [number, number], userType: 'cyclist' as const, severities: [0, 1] as (0 | 1)[], regions: [3, 6] };
    const q = toQuery(f, meta);
    expect(q).toBe('y=2016-2021&u=cyclist&s=0,1&r=3,6');
    expect(parseQuery(q, meta)).toEqual(f);
  });
  it('clamps out-of-range years and drops unknown regions', () => {
    const f = parseQuery('y=1990-3000&r=6,99', meta);
    expect(f.years).toEqual([2015, 2022]);
    expect(f.regions).toEqual([6]);
  });
});

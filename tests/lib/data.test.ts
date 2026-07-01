import { describe, it, expect } from 'vitest';
import { assertCollisions } from '../../src/lib/data';

describe('assertCollisions', () => {
  it('accepts a well-formed columnar object', () => {
    const c = { count: 1, year: [2021], month: [1], timeBand: [0], weekday: [0],
      severity: [0], userType: [0], regionCode: [3], lighting: [1], weather: [11],
      environment: [2], speed: [50] };
    expect(() => assertCollisions(c)).not.toThrow();
  });
  it('rejects mismatched column lengths', () => {
    const bad = { count: 2, year: [2021], month: [1], timeBand: [0], weekday: [0],
      severity: [0], userType: [0], regionCode: [3], lighting: [1], weather: [11],
      environment: [2], speed: [50] };
    expect(() => assertCollisions(bad)).toThrow();
  });
});

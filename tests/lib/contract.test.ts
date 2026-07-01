import { describe, it, expect } from 'vitest';
import { SEVERITY_RAW, TIME_BANDS } from '../../src/lib/contract';

describe('contract constants', () => {
  it('has 4 severities in most→least severe order', () => {
    expect(SEVERITY_RAW).toHaveLength(4);
    expect(SEVERITY_RAW[0]).toBe('Mortel ou grave');
    expect(SEVERITY_RAW[3]).toBe('Dommages matériels inférieurs au seuil de rapportage');
  });
  it('has 6 four-hour time bands', () => {
    expect(TIME_BANDS).toHaveLength(6);
    expect(TIME_BANDS[0]).toBe('00:00:00-03:59:00');
  });
});

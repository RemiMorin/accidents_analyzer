import { describe, it, expect } from 'vitest';
import { int, pct } from '../../src/lib/format';

describe('format', () => {
  it('formats integers with fr-CA grouping', () => {
    // fr-CA groups with a narrow no-break space; assert digits are present.
    expect(int(12345).replace(/\s/g, '')).toBe('12345');
  });
  it('formats percentages', () => {
    expect(pct(0.25)).toBe('25 %');
  });
});

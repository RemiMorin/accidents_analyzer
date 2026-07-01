import { describe, it, expect } from 'vitest';
import * as e from '../../pipeline/encode';
import { UNKNOWN } from '../../src/lib/contract';

describe('encode', () => {
  it('parses region code from label', () => {
    expect(e.regionCode('Capitale-Nationale (03)')).toBe(3);
    expect(e.regionCode('Montréal (06)')).toBe(6);
    expect(e.regionCode('Centre-du-Québec (17)')).toBe(17);
    expect(e.regionCode('Non précisé')).toBeNull();
  });
  it('maps severity to id', () => {
    expect(e.severityId('Mortel ou grave')).toBe(0);
    expect(e.severityId('Léger')).toBe(1);
    expect(e.severityId('bogus')).toBeNull();
  });
  it('maps time band and weekday', () => {
    expect(e.timeBandId('16:00:00-19:59:00')).toBe(4);
    expect(e.timeBandId('Non précisé')).toBe(UNKNOWN);
    expect(e.weekdayId('SEM')).toBe(0);
    expect(e.weekdayId('FDS')).toBe(1);
    expect(e.weekdayId('')).toBe(UNKNOWN);
  });
  it('derives user type from indicator flags', () => {
    expect(e.userType('O', 'N')).toBe(0);
    expect(e.userType('N', 'O')).toBe(1);
    expect(e.userType('N', 'N')).toBeNull();
    expect(e.userType('O', 'O')).toBe(0); // pedestrian wins if both
  });
  it('codes numeric fields with UNKNOWN sentinel', () => {
    expect(e.codeNum('4')).toBe(4);
    expect(e.codeNum('')).toBe(UNKNOWN);
    expect(e.codeNum('Non précisé')).toBe(UNKNOWN);
    expect(e.speedCode('<50')).toBe(0);
    expect(e.speedCode('90')).toBe(90);
    expect(e.speedCode('Non précisé')).toBe(UNKNOWN);
  });
});

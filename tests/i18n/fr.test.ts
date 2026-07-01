import { describe, it, expect } from 'vitest';
import { REGION_LABELS, SEVERITY_LABELS, regionLabel } from '../../src/i18n/fr';

describe('fr labels', () => {
  it('covers all 17 region codes', () => {
    for (let c = 1; c <= 17; c++) expect(REGION_LABELS[c]).toBeTruthy();
  });
  it('labels Capitale-Nationale and Montréal', () => {
    expect(regionLabel(3)).toBe('Capitale-Nationale');
    expect(regionLabel(6)).toBe('Montréal');
  });
  it('has 4 severity labels', () => {
    expect(SEVERITY_LABELS).toHaveLength(4);
    expect(SEVERITY_LABELS[0]).toBe('Mortel ou grave');
  });
});

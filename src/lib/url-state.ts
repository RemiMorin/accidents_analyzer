import type { FilterState } from './filters';
import type { Meta, SeverityId } from './contract';

const ALL_SEVERITIES: SeverityId[] = [0, 1, 2, 3];

export function defaultFilter(meta: Meta): FilterState {
  const min = meta.years[0];
  const max = meta.years[meta.years.length - 1];
  return { years: [min, max], userType: 'both', severities: [], regions: [] };
}

export function toQuery(f: FilterState, meta: Meta): string {
  const d = defaultFilter(meta);
  const parts: string[] = [];
  if (f.years[0] !== d.years[0] || f.years[1] !== d.years[1]) {
    parts.push(`y=${f.years[0]}-${f.years[1]}`);
  }
  if (f.userType !== 'both') parts.push(`u=${f.userType}`);
  if (f.severities.length) parts.push(`s=${[...f.severities].sort((a, b) => a - b).join(',')}`);
  if (f.regions.length) parts.push(`r=${[...f.regions].sort((a, b) => a - b).join(',')}`);
  return parts.join('&');
}

export function parseQuery(search: string, meta: Meta): FilterState {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const f = defaultFilter(meta);
  const [min, max] = f.years;

  const y = p.get('y')?.match(/^(\d{4})-(\d{4})$/);
  if (y) {
    const lo = Math.max(min, Math.min(Number(y[1]), Number(y[2])));
    const hi = Math.min(max, Math.max(Number(y[1]), Number(y[2])));
    f.years = [lo, hi];
  }
  const u = p.get('u');
  if (u === 'pedestrian' || u === 'cyclist') f.userType = u;

  const s = p.get('s');
  if (s) {
    f.severities = s.split(',').map(Number)
      .filter((n): n is SeverityId => ALL_SEVERITIES.includes(n as SeverityId));
  }
  const r = p.get('r');
  if (r) {
    const present = new Set(meta.regionCodes);
    f.regions = r.split(',').map(Number).filter((n) => present.has(n));
  }
  return f;
}

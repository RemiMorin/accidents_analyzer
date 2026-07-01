import type { Collisions, SeverityId } from './contract';

export interface FilterState {
  years: [number, number]; // inclusive [min, max]
  userType: 'both' | 'pedestrian' | 'cyclist';
  severities: SeverityId[]; // empty = all
  regions: number[]; // region codes; empty = all
}

export function applyFilters(data: Collisions, f: FilterState): number[] {
  const [minY, maxY] = f.years;
  const wantUser = f.userType === 'both' ? -1 : f.userType === 'pedestrian' ? 0 : 1;
  const sev = f.severities.length ? new Set<number>(f.severities) : null;
  const reg = f.regions.length ? new Set<number>(f.regions) : null;

  const out: number[] = [];
  for (let i = 0; i < data.count; i++) {
    if (data.year[i] < minY || data.year[i] > maxY) continue;
    if (wantUser !== -1 && data.userType[i] !== wantUser) continue;
    if (sev && !sev.has(data.severity[i])) continue;
    if (reg && !reg.has(data.regionCode[i])) continue;
    out.push(i);
  }
  return out;
}

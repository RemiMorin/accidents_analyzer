import type { Collisions } from './contract';
import type { FilterState } from './filters';

export type NumericField =
  | 'year' | 'month' | 'timeBand' | 'weekday' | 'severity'
  | 'userType' | 'regionCode' | 'lighting' | 'weather' | 'environment' | 'speed';

export interface Bin { key: number; count: number; }

export function countBy(data: Collisions, idx: number[], field: NumericField): Bin[] {
  const col = data[field];
  const m = new Map<number, number>();
  for (const i of idx) m.set(col[i], (m.get(col[i]) ?? 0) + 1);
  return [...m.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.key - b.key);
}

export interface Headline {
  total: number;
  perYear: number;
  perDay: number;
  fatalSeriousShare: number;
  pedestrian: number;
  cyclist: number;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInYear = (y: number) => (isLeap(y) ? 366 : 365);

export function stats(data: Collisions, idx: number[], f: FilterState): Headline {
  const total = idx.length;
  let pedestrian = 0, fatalSerious = 0;
  for (const i of idx) {
    if (data.userType[i] === 0) pedestrian++;
    if (data.severity[i] === 0) fatalSerious++;
  }
  const [minY, maxY] = f.years;
  const years = maxY - minY + 1;
  let days = 0;
  for (let y = minY; y <= maxY; y++) days += daysInYear(y);
  return {
    total,
    perYear: years > 0 ? total / years : 0,
    perDay: days > 0 ? total / days : 0,
    fatalSeriousShare: total > 0 ? fatalSerious / total : 0,
    pedestrian,
    cyclist: total - pedestrian,
  };
}

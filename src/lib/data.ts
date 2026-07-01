import type { Collisions, Meta } from './contract';

const COLS: (keyof Collisions)[] = [
  'year', 'month', 'timeBand', 'weekday', 'severity', 'userType',
  'regionCode', 'lighting', 'weather', 'environment', 'speed',
];

export function assertCollisions(c: Collisions): void {
  for (const k of COLS) {
    if (!Array.isArray(c[k])) throw new Error(`collisions.${k} is not an array`);
    if ((c[k] as number[]).length !== c.count) {
      throw new Error(`collisions.${k} length ${(c[k] as number[]).length} != count ${c.count}`);
    }
  }
}

export async function loadData(): Promise<{ collisions: Collisions; meta: Meta }> {
  const [collisions, meta] = await Promise.all([
    import('../data/collisions.json').then((m) => m.default as unknown as Collisions),
    import('../data/meta.json').then((m) => m.default as unknown as Meta),
  ]);
  assertCollisions(collisions);
  return { collisions, meta };
}

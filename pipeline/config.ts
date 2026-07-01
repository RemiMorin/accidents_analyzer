import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Widen the dataset by editing `years`. Region scope is a frontend filter,
// so the pipeline intentionally keeps ALL regions.
export const config = {
  years: Array.from({ length: 2022 - 2011 + 1 }, (_, i) => 2011 + i),
  rawDir: resolve(here, '../raw'),
  outDir: resolve(here, '../src/data'),
  csvUrl: (y: number) =>
    `https://dq-prd-bucket1.s3.ca-central-1.amazonaws.com/saaq/Rapport_Accident_${y}.csv`,
};
export type Config = typeof config;

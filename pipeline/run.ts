import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config';
import { downloadAll } from './download';
import { transform } from './transform';
import type { Collisions, Meta } from '../src/lib/contract';

export function buildArtifacts(texts: string[], now: string): { collisions: Collisions; meta: Meta } {
  const { collisions, meta } = transform(texts);
  meta.generatedAt = now;
  return { collisions, meta };
}

async function main() {
  await downloadAll(config);
  const files = (await readdir(config.rawDir)).filter((f) => f.endsWith('.csv')).sort();
  if (files.length === 0) throw new Error(`no CSVs in ${config.rawDir}`);
  const texts = await Promise.all(
    files.map((f) => readFile(join(config.rawDir, f), 'utf-8')),
  );
  const { collisions, meta } = buildArtifacts(texts, new Date().toISOString());
  await mkdir(config.outDir, { recursive: true });
  await writeFile(join(config.outDir, 'collisions.json'), JSON.stringify(collisions));
  await writeFile(join(config.outDir, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log(`wrote ${collisions.count} collisions across ${meta.years.length} years`);
}

// Run only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

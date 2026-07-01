import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from './config';

export async function downloadAll(cfg: Config): Promise<void> {
  await mkdir(cfg.rawDir, { recursive: true });
  for (const year of cfg.years) {
    const dest = join(cfg.rawDir, `Rapport_Accident_${year}.csv`);
    if (await exists(dest)) {
      console.log(`skip ${year} (already downloaded)`);
      continue;
    }
    console.log(`downloading ${year}...`);
    const res = await fetch(cfg.csvUrl(year));
    if (!res.ok) throw new Error(`fetch ${year} failed: ${res.status}`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  }
}

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

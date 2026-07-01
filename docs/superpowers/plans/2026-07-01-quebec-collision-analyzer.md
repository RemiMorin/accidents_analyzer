# Québec Pedestrian/Cyclist Collision Analyzer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 100%-static website that visualizes SAAQ pedestrian/cyclist collisions across all of Québec, with charts and filters (region, year, user type, severity) driven from committed pre-processed data artifacts.

**Architecture:** Two decoupled layers sharing only an on-disk artifact contract. A Node/TypeScript build-time pipeline downloads yearly SAAQ CSVs, filters to pedestrian/cyclist collisions, normalizes codes, and emits a compact columnar `collisions.json` + `meta.json`. An Astro static site with a single Preact island loads those artifacts and does all filtering/aggregation client-side (≈45k rows), rendering headline stats and Observable Plot charts, with filter state mirrored to the URL query string.

**Tech Stack:** Node 20+, TypeScript, `tsx`, Astro 5, `@astrojs/preact` + Preact, `@observablehq/plot`, `csv-parse`, Vitest, `@testing-library/preact` + jsdom. Deploy via Forgejo Actions + `wrangler pages deploy`.

## Global Constraints

- **Language rule:** all code, comments, commit messages, docs in **English**; all user-facing UI text in **French**, centralized in `src/i18n/fr.ts`.
- **Static only:** no backend, no runtime DB. `npm run build` must produce a self-contained `dist/`.
- **No raw data in git:** yearly SAAQ CSVs live in `raw/` (gitignored). Artifacts `src/data/collisions.json` and `src/data/meta.json` ARE committed.
- **Artifact contract is the only pipeline↔frontend coupling.** Shared TypeScript types live in `src/lib/contract.ts`, imported by both layers.
- **Data source:** SAAQ "Rapports d'accident", Données Québec, **CC-BY 4.0**. Attribution string: `Société de l'assurance automobile du Québec (SAAQ) — Données Québec`.
- **Region key is the numeric code** parsed from `REG_ADM` (e.g. `Capitale-Nationale (03)` → `3`); display labels come only from `fr.ts` (raw names are mojibake-prone).
- **Severity order (id = index, most→least severe):** `0 Mortel ou grave`, `1 Léger`, `2 Dommages matériels seulement`, `3 Dommages matériels inférieurs au seuil de rapportage`.
- **user_type:** `IND_PIETON='O'` → pedestrian (id 0); else `IND_VELO='O'` → cyclist (id 1). Mutually exclusive in the data.
- **Dataset years:** 2011–2022 (configurable in `pipeline/config.ts`).

---

## File Structure

```
pipeline/
  config.ts        years, S3 URL template, output paths, dataset constants
  encode.ts        pure raw-field → contract-code mappers (region, severity, time, etc.)
  transform.ts     CSV text → filtered normalized records → columnar Collisions + Meta
  download.ts      fetch yearly CSVs → raw/ (network; thin, untested)
  run.ts           orchestrator: read raw/ → transform → write src/data/*.json
src/
  lib/
    contract.ts    SHARED artifact types + structural constants (ids, field lists)
    data.ts        load + validate collisions.json / meta.json in the browser
    filters.ts     FilterState + applyFilters(data, filter) → indices
    aggregate.ts   countBy(...) + stats(...) → chart bins + headline numbers
    url-state.ts   parseUrl / toQuery  (FilterState ⇄ query string)
    format.ts      number formatting helpers (fr-CA)
  i18n/
    fr.ts          ALL French strings + code→label maps (regions, severity, months…)
  components/
    StatsHeader.tsx   headline numbers
    Filters.tsx       region multi-select, year range, user type, severity
    Charts.tsx        Observable Plot wrappers (year, month, severity, userType, region)
    Dashboard.tsx     island: owns FilterState ⇄ URL, wires children
  pages/
    index.astro       static shell, mounts <Dashboard client:load/>
  styles/global.css
tests/            mirrors src/lib + pipeline, plus fixtures/sample.csv
.forgejo/workflows/deploy.yml
wrangler.toml
README.md
```

---

## Phase 1 — Project scaffold

### Task 1: Scaffold Astro + Preact + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `astro.config.mjs`, `vitest.config.ts`, `src/pages/index.astro`, `src/env.d.ts`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview`, `test`, `pipeline`; a working Astro+Preact+Vitest toolchain.

- [ ] **Step 1: Initialize package and install dependencies**

```bash
npm init -y
npm pkg set type=module
npm pkg set scripts.dev="astro dev"
npm pkg set scripts.build="astro build"
npm pkg set scripts.preview="astro preview"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.pipeline="tsx pipeline/run.ts"
npm i astro @astrojs/preact preact @observablehq/plot
npm i -D typescript tsx vitest @testing-library/preact jsdom csv-parse
```

- [ ] **Step 2: Write config files**

`astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  output: 'static',
  integrations: [preact()],
});
```

`tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "types": ["vitest/globals"]
  },
  "include": ["src", "pipeline", "tests"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, environment: 'jsdom' },
});
```

`src/env.d.ts`:
```ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
```

`src/pages/index.astro`:
```astro
---
---
<html lang="fr">
  <head><meta charset="utf-8" /><title>Collisions SAAQ</title></head>
  <body><main><h1>Collisions SAAQ</h1></main></body>
</html>
```

- [ ] **Step 3: Write smoke test**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Verify test runs and build succeeds**

Run: `npm test`
Expected: PASS (1 test).

Run: `npm run build`
Expected: Astro builds `dist/index.html` with no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Astro + Preact + Vitest toolchain"
```

---

## Phase 2 — Data pipeline

### Task 2: Shared contract types + structural constants

**Files:**
- Create: `src/lib/contract.ts`
- Test: `tests/lib/contract.test.ts`

**Interfaces:**
- Produces:
  - `type SeverityId = 0|1|2|3`, `type UserTypeId = 0|1`
  - `const SEVERITY_RAW: readonly string[]` (length 4, index = SeverityId)
  - `const TIME_BANDS: readonly string[]` (length 6, index = timeBand id)
  - `interface Collisions` (columnar; every field a `number[]` of length `count`)
  - `interface Meta { generatedAt:string; total:number; years:number[]; regionCodes:number[] }`

- [ ] **Step 1: Write the failing test**

`tests/lib/contract.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SEVERITY_RAW, TIME_BANDS } from '../../src/lib/contract';

describe('contract constants', () => {
  it('has 4 severities in most→least severe order', () => {
    expect(SEVERITY_RAW).toHaveLength(4);
    expect(SEVERITY_RAW[0]).toBe('Mortel ou grave');
    expect(SEVERITY_RAW[3]).toBe('Dommages matériels inférieurs au seuil de rapportage');
  });
  it('has 6 four-hour time bands', () => {
    expect(TIME_BANDS).toHaveLength(6);
    expect(TIME_BANDS[0]).toBe('00:00:00-03:59:00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/contract.test.ts`
Expected: FAIL (cannot find module `contract`).

- [ ] **Step 3: Write the implementation**

`src/lib/contract.ts`:
```ts
// Shared artifact contract between the pipeline (producer) and frontend (consumer).
// Structural + language-neutral only; display labels live in src/i18n/fr.ts.

export type SeverityId = 0 | 1 | 2 | 3;
export type UserTypeId = 0 | 1; // 0 = pedestrian, 1 = cyclist

// Index === SeverityId, ordered most → least severe. Raw strings match the
// SAAQ GRAVITE column verbatim (used only during ingest matching).
export const SEVERITY_RAW = [
  'Mortel ou grave',
  'Léger',
  'Dommages matériels seulement',
  'Dommages matériels inférieurs au seuil de rapportage',
] as const;

// Index === timeBand id. Raw strings match the SAAQ HR_ACCDN column.
export const TIME_BANDS = [
  '00:00:00-03:59:00',
  '04:00:00-07:59:00',
  '08:00:00-11:59:00',
  '12:00:00-15:59:00',
  '16:00:00-19:59:00',
  '20:00:00-23:59:00',
] as const;

// Sentinel for "unknown / Non précisé" in any coded numeric column.
export const UNKNOWN = -1;

// Columnar table: every array has length `count`, aligned by index.
export interface Collisions {
  count: number;
  year: number[]; // e.g. 2011..2022
  month: number[]; // 1..12
  timeBand: number[]; // 0..5, or UNKNOWN
  weekday: number[]; // 0 = SEM (weekday), 1 = FDS (weekend), or UNKNOWN
  severity: SeverityId[]; // 0..3
  userType: UserTypeId[]; // 0..1
  regionCode: number[]; // 1..17
  lighting: number[]; // CD_ECLRM 1..4, or UNKNOWN
  weather: number[]; // CD_COND_METEO 11..19/99, or UNKNOWN
  environment: number[]; // CD_ENVRN_ACCDN 1..6/9, or UNKNOWN
  speed: number[]; // 0 = "<50", 50..100, or UNKNOWN
}

export interface Meta {
  generatedAt: string; // ISO timestamp
  total: number;
  years: number[]; // sorted, present in the data
  regionCodes: number[]; // sorted, present in the data
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contract.ts tests/lib/contract.test.ts
git commit -m "feat: add shared artifact contract types and constants"
```

---

### Task 3: Pure field encoders

**Files:**
- Create: `pipeline/encode.ts`
- Test: `tests/pipeline/encode.test.ts`

**Interfaces:**
- Consumes: `SEVERITY_RAW`, `TIME_BANDS`, `UNKNOWN`, `SeverityId`, `UserTypeId` from `src/lib/contract`.
- Produces:
  - `regionCode(raw: string): number | null` — parses trailing `(NN)`; null if absent.
  - `severityId(raw: string): SeverityId | null`
  - `timeBandId(raw: string): number` (0..5 or UNKNOWN)
  - `weekdayId(raw: string): number` (0/1 or UNKNOWN)
  - `userType(pieton: string, velo: string): UserTypeId | null`
  - `codeNum(raw: string): number` (integer or UNKNOWN for empty/"Non précisé")
  - `speedCode(raw: string): number` ("<50"→0, "50".."100"→int, else UNKNOWN)

- [ ] **Step 1: Write the failing test**

`tests/pipeline/encode.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipeline/encode.test.ts`
Expected: FAIL (cannot find module `encode`).

- [ ] **Step 3: Write the implementation**

`pipeline/encode.ts`:
```ts
import { SEVERITY_RAW, TIME_BANDS, UNKNOWN, type SeverityId, type UserTypeId }
  from '../src/lib/contract';

const clean = (s: string) => (s ?? '').trim();

export function regionCode(raw: string): number | null {
  const m = clean(raw).match(/\((\d{2})\)\s*$/);
  return m ? Number(m[1]) : null;
}

export function severityId(raw: string): SeverityId | null {
  const i = SEVERITY_RAW.indexOf(clean(raw) as (typeof SEVERITY_RAW)[number]);
  return i === -1 ? null : (i as SeverityId);
}

export function timeBandId(raw: string): number {
  const i = TIME_BANDS.indexOf(clean(raw) as (typeof TIME_BANDS)[number]);
  return i === -1 ? UNKNOWN : i;
}

export function weekdayId(raw: string): number {
  const v = clean(raw);
  if (v === 'SEM') return 0;
  if (v === 'FDS') return 1;
  return UNKNOWN;
}

export function userType(pieton: string, velo: string): UserTypeId | null {
  if (clean(pieton) === 'O') return 0;
  if (clean(velo) === 'O') return 1;
  return null;
}

export function codeNum(raw: string): number {
  const v = clean(raw);
  if (v === '' || v === 'Non précisé') return UNKNOWN;
  const n = Number(v);
  return Number.isFinite(n) ? n : UNKNOWN;
}

export function speedCode(raw: string): number {
  const v = clean(raw);
  if (v === '<50') return 0;
  return codeNum(v);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pipeline/encode.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/encode.ts tests/pipeline/encode.test.ts
git commit -m "feat: add pure SAAQ field encoders"
```

---

### Task 4: Transform — CSV text → columnar Collisions + Meta

**Files:**
- Create: `pipeline/transform.ts`, `tests/fixtures/sample.csv`
- Test: `tests/pipeline/transform.test.ts`

**Interfaces:**
- Consumes: encoders from `pipeline/encode`; `Collisions`, `Meta` from `src/lib/contract`.
- Produces:
  - `parseCsv(text: string): Record<string, string>[]` — strips tabs + BOM, uses `csv-parse` sync.
  - `transform(texts: string[]): { collisions: Collisions; meta: Meta }` — concatenates yearly CSV texts, keeps only pedestrian/cyclist rows, emits columnar data. `meta.generatedAt` is `''` here (stamped by `run.ts`).

- [ ] **Step 1: Write the fixture**

`tests/fixtures/sample.csv` (note the literal tab characters after `NB_VEH_IMPLIQUES_ACCDN` values, mirroring the real files; include a UTF-8 BOM at the very start):
```
"AN","NO_SEQ_COLL","MS_ACCDN","HR_ACCDN","JR_SEMN_ACCDN","GRAVITE","NB_VICTIMES_TOTAL","NB_VEH_IMPLIQUES_ACCDN",			"REG_ADM","VITESSE_AUTOR","CD_GENRE_ACCDN","CD_ETAT_SURFC","CD_ECLRM","CD_ENVRN_ACCDN","CD_CATEG_ROUTE","CD_ASPCT_ROUTE",			"CD_LOCLN_ACCDN","CD_CONFG_ROUTE","CD_ZON_TRAVX_ROUTR","CD_COND_METEO","IND_AUTO_CAMION_LEGER","IND_VEH_LOURD","IND_MOTO_CYCLO",			"IND_VELO","IND_PIETON"
2021,"2021 _ 1","06","16:00:00-19:59:00","SEM","Léger",1,2,"Capitale-Nationale (03)","50","piéton","11","1","2","1","Droit","12","23",,"11","O","N","N","N","O"
2021,"2021 _ 2","07","08:00:00-11:59:00","FDS","Mortel ou grave",1,2,"Montréal (06)","<50","cycliste","11","1","2","1","Droit","12","23",,"11","O","N","N","O","N"
2021,"2021 _ 3","01","16:00:00-19:59:00","SEM","Dommages matériels seulement",0,2,"Capitale-Nationale (03)","50","véhicule","11","3","4","1","Droit","99","23",,"11","O","N","N","N","N"
```

The BOM must be a real `﻿` byte at file start. Create it precisely with:
```bash
mkdir -p tests/fixtures
printf '\xEF\xBB\xBF' > tests/fixtures/sample.csv
# then append the 4 lines above (editor or heredoc) WITHOUT re-adding a BOM
```
(If your editor cannot preserve the tabs/BOM, the test in Step 3 constructs the same text in code as a fallback — keep both in sync.)

- [ ] **Step 2: Write the failing test**

`tests/pipeline/transform.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseCsv, transform } from '../../pipeline/transform';

// Build the sample in-code so the test is robust to editor tab/BOM handling.
const HEADER =
  '"AN","NO_SEQ_COLL","MS_ACCDN","HR_ACCDN","JR_SEMN_ACCDN","GRAVITE","NB_VICTIMES_TOTAL","NB_VEH_IMPLIQUES_ACCDN",\t\t\t"REG_ADM","VITESSE_AUTOR","CD_GENRE_ACCDN","CD_ETAT_SURFC","CD_ECLRM","CD_ENVRN_ACCDN","CD_CATEG_ROUTE","CD_ASPCT_ROUTE",\t\t\t"CD_LOCLN_ACCDN","CD_CONFG_ROUTE","CD_ZON_TRAVX_ROUTR","CD_COND_METEO","IND_AUTO_CAMION_LEGER","IND_VEH_LOURD","IND_MOTO_CYCLO",\t\t\t"IND_VELO","IND_PIETON"';
const PED = '2021,"2021 _ 1","06","16:00:00-19:59:00","SEM","Léger",1,2,"Capitale-Nationale (03)","50","piéton","11","1","2","1","Droit","12","23",,"11","O","N","N","N","O"';
const CYC = '2021,"2021 _ 2","07","08:00:00-11:59:00","FDS","Mortel ou grave",1,2,"Montréal (06)","<50","cycliste","11","1","2","1","Droit","12","23",,"11","O","N","N","O","N"';
const VEH = '2021,"2021 _ 3","01","16:00:00-19:59:00","SEM","Dommages matériels seulement",0,2,"Capitale-Nationale (03)","50","véhicule","11","3","4","1","Droit","99","23",,"11","O","N","N","N","N"';
const CSV = '﻿' + [HEADER, PED, CYC, VEH].join('\n') + '\n';

describe('parseCsv', () => {
  it('strips BOM and tabs and yields clean columns', () => {
    const rows = parseCsv(CSV);
    expect(rows).toHaveLength(3);
    expect(Object.keys(rows[0])).toContain('REG_ADM');
    expect(rows[0].REG_ADM).toBe('Capitale-Nationale (03)');
    expect(rows[0].IND_PIETON).toBe('O');
  });
});

describe('transform', () => {
  it('keeps only pedestrian/cyclist rows and encodes them', () => {
    const { collisions, meta } = transform([CSV]);
    expect(collisions.count).toBe(2); // VEH row dropped
    expect(collisions.userType).toEqual([0, 1]); // pedestrian, cyclist
    expect(collisions.regionCode).toEqual([3, 6]);
    expect(collisions.severity).toEqual([1, 0]);
    expect(collisions.month).toEqual([6, 7]);
    expect(collisions.timeBand).toEqual([4, 2]);
    expect(collisions.weekday).toEqual([0, 1]);
    expect(collisions.speed).toEqual([50, 0]); // "50", "<50"
    expect(meta.total).toBe(2);
    expect(meta.years).toEqual([2021]);
    expect(meta.regionCodes).toEqual([3, 6]);
    expect(meta.generatedAt).toBe('');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/pipeline/transform.test.ts`
Expected: FAIL (cannot find module `transform`).

- [ ] **Step 4: Write the implementation**

`pipeline/transform.ts`:
```ts
import { parse } from 'csv-parse/sync';
import * as e from './encode';
import { type Collisions, type Meta, type SeverityId, type UserTypeId }
  from '../src/lib/contract';

// The raw SAAQ CSVs contain stray tab characters between some columns and a
// UTF-8 BOM. Strip both, then parse. `csv-parse` handles the BOM via bom:true,
// but we also strip tabs which it does not.
export function parseCsv(text: string): Record<string, string>[] {
  const cleaned = text.replace(/\t/g, '');
  return parse(cleaned, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  }) as Record<string, string>[];
}

export function transform(texts: string[]): { collisions: Collisions; meta: Meta } {
  const c: Collisions = {
    count: 0, year: [], month: [], timeBand: [], weekday: [], severity: [],
    userType: [], regionCode: [], lighting: [], weather: [], environment: [], speed: [],
  };

  for (const text of texts) {
    for (const row of parseCsv(text)) {
      const ut = e.userType(row.IND_PIETON, row.IND_VELO);
      if (ut === null) continue; // not a pedestrian/cyclist collision

      const sev = e.severityId(row.GRAVITE);
      const reg = e.regionCode(row.REG_ADM);
      if (sev === null || reg === null) continue; // unusable row

      c.year.push(Number(row.AN));
      c.month.push(e.codeNum(row.MS_ACCDN));
      c.timeBand.push(e.timeBandId(row.HR_ACCDN));
      c.weekday.push(e.weekdayId(row.JR_SEMN_ACCDN));
      c.severity.push(sev as SeverityId);
      c.userType.push(ut as UserTypeId);
      c.regionCode.push(reg);
      c.lighting.push(e.codeNum(row.CD_ECLRM));
      c.weather.push(e.codeNum(row.CD_COND_METEO));
      c.environment.push(e.codeNum(row.CD_ENVRN_ACCDN));
      c.speed.push(e.speedCode(row.VITESSE_AUTOR));
    }
  }

  c.count = c.year.length;

  const meta: Meta = {
    generatedAt: '',
    total: c.count,
    years: [...new Set(c.year)].sort((a, b) => a - b),
    regionCodes: [...new Set(c.regionCode)].sort((a, b) => a - b),
  };
  return { collisions: c, meta };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/pipeline/transform.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add pipeline/transform.ts tests/pipeline/transform.test.ts tests/fixtures/sample.csv
git commit -m "feat: add SAAQ CSV transform to columnar artifacts"
```

---

### Task 5: Config, download, and orchestrator

**Files:**
- Create: `pipeline/config.ts`, `pipeline/download.ts`, `pipeline/run.ts`
- Test: `tests/pipeline/run.test.ts`

**Interfaces:**
- Consumes: `transform` from `pipeline/transform`.
- Produces:
  - `config` object: `{ years:number[]; rawDir:string; outDir:string; csvUrl:(y:number)=>string }`
  - `downloadAll(cfg): Promise<void>` — fetches each year's CSV to `rawDir` (skips if present).
  - `buildArtifacts(texts, now): { collisions; meta }` — wraps `transform` and stamps `meta.generatedAt = now`.
  - `run.ts` reads `rawDir`, calls `buildArtifacts`, writes `outDir/collisions.json` + `outDir/meta.json`.

- [ ] **Step 1: Write the failing test**

`tests/pipeline/run.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildArtifacts } from '../../pipeline/run';

const HEADER =
  '"AN","NO_SEQ_COLL","MS_ACCDN","HR_ACCDN","JR_SEMN_ACCDN","GRAVITE","NB_VICTIMES_TOTAL","NB_VEH_IMPLIQUES_ACCDN",\t\t\t"REG_ADM","VITESSE_AUTOR","CD_GENRE_ACCDN","CD_ETAT_SURFC","CD_ECLRM","CD_ENVRN_ACCDN","CD_CATEG_ROUTE","CD_ASPCT_ROUTE",\t\t\t"CD_LOCLN_ACCDN","CD_CONFG_ROUTE","CD_ZON_TRAVX_ROUTR","CD_COND_METEO","IND_AUTO_CAMION_LEGER","IND_VEH_LOURD","IND_MOTO_CYCLO",\t\t\t"IND_VELO","IND_PIETON"';
const PED = '2021,"2021 _ 1","06","16:00:00-19:59:00","SEM","Léger",1,2,"Capitale-Nationale (03)","50","piéton","11","1","2","1","Droit","12","23",,"11","O","N","N","N","O"';
const CSV = '﻿' + [HEADER, PED].join('\n') + '\n';

describe('buildArtifacts', () => {
  it('stamps generatedAt', () => {
    const { collisions, meta } = buildArtifacts([CSV], '2026-07-01T00:00:00.000Z');
    expect(collisions.count).toBe(1);
    expect(meta.generatedAt).toBe('2026-07-01T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipeline/run.test.ts`
Expected: FAIL (cannot find module `run`).

- [ ] **Step 3: Write config**

`pipeline/config.ts`:
```ts
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
```

- [ ] **Step 4: Write download (network; thin)**

`pipeline/download.ts`:
```ts
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
```

- [ ] **Step 5: Write orchestrator**

`pipeline/run.ts`:
```ts
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
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/pipeline/run.test.ts`
Expected: PASS.

- [ ] **Step 7: Generate real artifacts and sanity-check**

Run: `npm run pipeline`
Expected: downloads 2011–2022 into `raw/`, writes `src/data/collisions.json` + `src/data/meta.json`, prints a count near ~45k. Verify `raw/` is gitignored (`git status` shows only `src/data/*.json`).

- [ ] **Step 8: Commit**

```bash
git add pipeline/config.ts pipeline/download.ts pipeline/run.ts tests/pipeline/run.test.ts src/data/collisions.json src/data/meta.json
git commit -m "feat: add pipeline orchestrator and generate data artifacts"
```

---

## Phase 3 — Frontend logic (pure, framework-agnostic)

### Task 6: Filter state + applyFilters

**Files:**
- Create: `src/lib/filters.ts`
- Test: `tests/lib/filters.test.ts`

**Interfaces:**
- Consumes: `Collisions`, `SeverityId` from `src/lib/contract`.
- Produces:
  - `interface FilterState { years:[number,number]; userType:'both'|'pedestrian'|'cyclist'; severities:SeverityId[]; regions:number[] }` (empty `severities`/`regions` array = "all").
  - `applyFilters(data: Collisions, f: FilterState): number[]` — returns matching row indices.

- [ ] **Step 1: Write the failing test**

`tests/lib/filters.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { applyFilters, type FilterState } from '../../src/lib/filters';
import type { Collisions } from '../../src/lib/contract';

const data: Collisions = {
  count: 3,
  year: [2015, 2018, 2021],
  month: [1, 2, 3],
  timeBand: [0, 1, 2],
  weekday: [0, 0, 1],
  severity: [0, 1, 2],
  userType: [0, 1, 0],
  regionCode: [3, 6, 3],
  lighting: [1, 1, 1], weather: [11, 11, 11], environment: [2, 2, 2], speed: [50, 50, 50],
};
const base: FilterState = { years: [2011, 2022], userType: 'both', severities: [], regions: [] };

describe('applyFilters', () => {
  it('returns all indices with an empty filter', () => {
    expect(applyFilters(data, base)).toEqual([0, 1, 2]);
  });
  it('filters by year range inclusive', () => {
    expect(applyFilters(data, { ...base, years: [2016, 2021] })).toEqual([1, 2]);
  });
  it('filters by user type', () => {
    expect(applyFilters(data, { ...base, userType: 'cyclist' })).toEqual([1]);
  });
  it('filters by severities (subset)', () => {
    expect(applyFilters(data, { ...base, severities: [0, 2] })).toEqual([0, 2]);
  });
  it('filters by region codes (subset)', () => {
    expect(applyFilters(data, { ...base, regions: [6] })).toEqual([1]);
  });
  it('combines filters with AND', () => {
    expect(applyFilters(data, { ...base, regions: [3], userType: 'pedestrian' })).toEqual([0, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/filters.test.ts`
Expected: FAIL (cannot find module `filters`).

- [ ] **Step 3: Write the implementation**

`src/lib/filters.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/filters.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/filters.ts tests/lib/filters.test.ts
git commit -m "feat: add filter state and applyFilters"
```

---

### Task 7: Aggregation + headline stats

**Files:**
- Create: `src/lib/aggregate.ts`
- Test: `tests/lib/aggregate.test.ts`

**Interfaces:**
- Consumes: `Collisions` from `src/lib/contract`; `FilterState` from `src/lib/filters`.
- Produces:
  - `type NumericField = 'year'|'month'|'timeBand'|'weekday'|'severity'|'userType'|'regionCode'|'lighting'|'weather'|'environment'|'speed'`
  - `countBy(data, idx, field): { key:number; count:number }[]` (ascending by key).
  - `interface Headline { total:number; perYear:number; perDay:number; fatalSeriousShare:number; pedestrian:number; cyclist:number }`
  - `stats(data, idx, f): Headline` — `perYear`/`perDay` use the selected year span.

- [ ] **Step 1: Write the failing test**

`tests/lib/aggregate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { countBy, stats } from '../../src/lib/aggregate';
import type { Collisions } from '../../src/lib/contract';
import type { FilterState } from '../../src/lib/filters';

const data: Collisions = {
  count: 4,
  year: [2020, 2020, 2021, 2021],
  month: [1, 1, 2, 3],
  timeBand: [0, 1, 2, 3],
  weekday: [0, 0, 1, 1],
  severity: [0, 1, 1, 2],
  userType: [0, 0, 1, 0],
  regionCode: [3, 3, 6, 3],
  lighting: [1, 1, 1, 1], weather: [11, 11, 11, 11], environment: [2, 2, 2, 2], speed: [50, 50, 50, 50],
};
const idx = [0, 1, 2, 3];

describe('countBy', () => {
  it('counts by a field ascending', () => {
    expect(countBy(data, idx, 'severity')).toEqual([
      { key: 0, count: 1 }, { key: 1, count: 2 }, { key: 2, count: 1 },
    ]);
  });
  it('counts by region', () => {
    expect(countBy(data, idx, 'regionCode')).toEqual([
      { key: 3, count: 3 }, { key: 6, count: 1 },
    ]);
  });
});

describe('stats', () => {
  const f: FilterState = { years: [2020, 2021], userType: 'both', severities: [], regions: [] };
  it('computes headline numbers over the selected span', () => {
    const s = stats(data, idx, f);
    expect(s.total).toBe(4);
    expect(s.pedestrian).toBe(3);
    expect(s.cyclist).toBe(1);
    expect(s.fatalSeriousShare).toBeCloseTo(0.25); // 1 of 4 is severity 0
    expect(s.perYear).toBeCloseTo(2); // 4 over 2 years
    expect(s.perDay).toBeCloseTo(4 / 731); // 2020(366)+2021(365)
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/aggregate.test.ts`
Expected: FAIL (cannot find module `aggregate`).

- [ ] **Step 3: Write the implementation**

`src/lib/aggregate.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/aggregate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/aggregate.ts tests/lib/aggregate.test.ts
git commit -m "feat: add aggregation and headline stats"
```

---

### Task 8: URL state (FilterState ⇄ query string)

**Files:**
- Create: `src/lib/url-state.ts`
- Test: `tests/lib/url-state.test.ts`

**Interfaces:**
- Consumes: `FilterState` from `src/lib/filters`; `Meta`, `SeverityId` from `src/lib/contract`.
- Produces:
  - `defaultFilter(meta: Meta): FilterState` — all years/regions/severities, `userType:'both'`.
  - `toQuery(f: FilterState, meta: Meta): string` — omits params equal to the default; format `y=2015-2022&u=cyclist&s=0,1&r=3,6`.
  - `parseQuery(search: string, meta: Meta): FilterState` — inverse; ignores unknown/out-of-range values, clamps years to meta bounds.

- [ ] **Step 1: Write the failing test**

`tests/lib/url-state.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defaultFilter, toQuery, parseQuery } from '../../src/lib/url-state';
import type { Meta } from '../../src/lib/contract';

const meta: Meta = {
  generatedAt: '', total: 0, years: [2015, 2016, 2020, 2021, 2022], regionCodes: [3, 6, 16],
};

describe('url-state', () => {
  it('default filter spans full meta range and is empty query', () => {
    const f = defaultFilter(meta);
    expect(f.years).toEqual([2015, 2022]);
    expect(toQuery(f, meta)).toBe('');
  });
  it('round-trips a non-default filter', () => {
    const f = { years: [2016, 2021] as [number, number], userType: 'cyclist' as const, severities: [0, 1] as (0 | 1)[], regions: [3, 6] };
    const q = toQuery(f, meta);
    expect(q).toBe('y=2016-2021&u=cyclist&s=0,1&r=3,6');
    expect(parseQuery(q, meta)).toEqual(f);
  });
  it('clamps out-of-range years and drops unknown regions', () => {
    const f = parseQuery('y=1990-3000&r=6,99', meta);
    expect(f.years).toEqual([2015, 2022]);
    expect(f.regions).toEqual([6]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/url-state.test.ts`
Expected: FAIL (cannot find module `url-state`).

- [ ] **Step 3: Write the implementation**

`src/lib/url-state.ts`:
```ts
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
  const p = new URLSearchParams();
  if (f.years[0] !== d.years[0] || f.years[1] !== d.years[1]) {
    p.set('y', `${f.years[0]}-${f.years[1]}`);
  }
  if (f.userType !== 'both') p.set('u', f.userType);
  if (f.severities.length) p.set('s', [...f.severities].sort((a, b) => a - b).join(','));
  if (f.regions.length) p.set('r', [...f.regions].sort((a, b) => a - b).join(','));
  return p.toString();
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/url-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/url-state.ts tests/lib/url-state.test.ts
git commit -m "feat: add URL query state serialization"
```

---

### Task 9: French i18n labels + format helpers

**Files:**
- Create: `src/i18n/fr.ts`, `src/lib/format.ts`
- Test: `tests/i18n/fr.test.ts`, `tests/lib/format.test.ts`

**Interfaces:**
- Produces (`fr.ts`):
  - `ui` object: all chrome strings (title, filter labels, stat labels, chart titles, attribution).
  - `REGION_LABELS: Record<number,string>` (codes 1–17 → clean French names).
  - `SEVERITY_LABELS: string[]` (index = SeverityId).
  - `USER_TYPE_LABELS: Record<'pedestrian'|'cyclist',string>`.
  - `MONTH_LABELS: string[]` (index 0 = Janvier).
  - `regionLabel(code:number):string`.
- Produces (`format.ts`): `int(n:number):string`, `pct(x:number):string`, `dec(n:number,d?:number):string` (fr-CA).

- [ ] **Step 1: Write the failing tests**

`tests/i18n/fr.test.ts`:
```ts
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
```

`tests/lib/format.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/i18n/fr.test.ts tests/lib/format.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write the implementations**

`src/i18n/fr.ts`:
```ts
// All user-facing text is French and lives here (see Global Constraints).

export const REGION_LABELS: Record<number, string> = {
  1: 'Bas-Saint-Laurent',
  2: 'Saguenay–Lac-Saint-Jean',
  3: 'Capitale-Nationale',
  4: 'Mauricie',
  5: 'Estrie',
  6: 'Montréal',
  7: 'Outaouais',
  8: 'Abitibi-Témiscamingue',
  9: 'Côte-Nord',
  10: 'Nord-du-Québec',
  11: 'Gaspésie–Îles-de-la-Madeleine',
  12: 'Chaudière-Appalaches',
  13: 'Laval',
  14: 'Lanaudière',
  15: 'Laurentides',
  16: 'Montérégie',
  17: 'Centre-du-Québec',
};
export const regionLabel = (code: number): string => REGION_LABELS[code] ?? `Région ${code}`;

export const SEVERITY_LABELS = [
  'Mortel ou grave',
  'Léger',
  'Dommages matériels seulement',
  'Dommages matériels inférieurs au seuil de rapportage',
];

export const USER_TYPE_LABELS: Record<'pedestrian' | 'cyclist', string> = {
  pedestrian: 'Piéton',
  cyclist: 'Cycliste',
};

export const MONTH_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const ui = {
  title: 'Collisions impliquant piétons et cyclistes au Québec',
  subtitle: 'Données des rapports d’accident de la SAAQ',
  filters: {
    heading: 'Filtres',
    years: 'Période',
    userType: 'Usager',
    userAll: 'Piétons et cyclistes',
    severity: 'Gravité',
    region: 'Régions administratives',
    reset: 'Réinitialiser',
  },
  stats: {
    total: 'Collisions',
    perYear: 'Moyenne par année',
    perDay: 'Moyenne par jour',
    fatalSerious: 'Part mortel ou grave',
    split: 'Piétons / cyclistes',
  },
  charts: {
    byYear: 'Collisions par année',
    byMonth: 'Saisonnalité (par mois)',
    bySeverity: 'Répartition par gravité',
    byUserType: 'Piétons et cyclistes',
    byRegion: 'Collisions par région',
  },
  attribution:
    'Source : Société de l’assurance automobile du Québec (SAAQ) — Données Québec, CC-BY 4.0',
} as const;
```

`src/lib/format.ts`:
```ts
const nf = new Intl.NumberFormat('fr-CA');
const pf = new Intl.NumberFormat('fr-CA', { style: 'percent', maximumFractionDigits: 0 });

export const int = (n: number): string => nf.format(Math.round(n));
export const dec = (n: number, d = 1): string =>
  new Intl.NumberFormat('fr-CA', { maximumFractionDigits: d }).format(n);
export const pct = (x: number): string => pf.format(x);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/i18n/fr.test.ts tests/lib/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/fr.ts src/lib/format.ts tests/i18n/fr.test.ts tests/lib/format.test.ts
git commit -m "feat: add French labels and number formatting"
```

---

### Task 10: Browser data loader

**Files:**
- Create: `src/lib/data.ts`
- Test: `tests/lib/data.test.ts`

**Interfaces:**
- Consumes: `Collisions`, `Meta` from `src/lib/contract`.
- Produces: `loadData(): Promise<{ collisions: Collisions; meta: Meta }>` — imports the two committed JSON artifacts. (Vite/Astro resolves JSON imports.)

- [ ] **Step 1: Write the failing test**

`tests/lib/data.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { assertCollisions } from '../../src/lib/data';

describe('assertCollisions', () => {
  it('accepts a well-formed columnar object', () => {
    const c = { count: 1, year: [2021], month: [1], timeBand: [0], weekday: [0],
      severity: [0], userType: [0], regionCode: [3], lighting: [1], weather: [11],
      environment: [2], speed: [50] };
    expect(() => assertCollisions(c)).not.toThrow();
  });
  it('rejects mismatched column lengths', () => {
    const bad = { count: 2, year: [2021], month: [1], timeBand: [0], weekday: [0],
      severity: [0], userType: [0], regionCode: [3], lighting: [1], weather: [11],
      environment: [2], speed: [50] };
    expect(() => assertCollisions(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/data.test.ts`
Expected: FAIL (cannot find module `data`).

- [ ] **Step 3: Write the implementation**

`src/lib/data.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/data.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data.ts tests/lib/data.test.ts
git commit -m "feat: add browser data loader with shape validation"
```

---

## Phase 4 — Frontend UI (Preact island + Observable Plot)

### Task 11: StatsHeader component

**Files:**
- Create: `src/components/StatsHeader.tsx`
- Test: `tests/components/StatsHeader.test.tsx`

**Interfaces:**
- Consumes: `Headline` from `src/lib/aggregate`; `ui`, `format` helpers.
- Produces: `StatsHeader({ headline }: { headline: Headline })` — renders labelled stat cards.

- [ ] **Step 1: Write the failing test**

`tests/components/StatsHeader.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { StatsHeader } from '../../src/components/StatsHeader';

describe('StatsHeader', () => {
  it('renders the total and split', () => {
    const { getByText, container } = render(
      <StatsHeader headline={{ total: 1234, perYear: 100, perDay: 0.5, fatalSeriousShare: 0.25, pedestrian: 800, cyclist: 434 }} />,
    );
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('234'); // grouped 1 234
    expect(getByText(/800/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/StatsHeader.test.tsx`
Expected: FAIL (cannot find module `StatsHeader`).

- [ ] **Step 3: Write the implementation**

`src/components/StatsHeader.tsx`:
```tsx
import type { Headline } from '../lib/aggregate';
import { int, dec, pct } from '../lib/format';
import { ui } from '../i18n/fr';

export function StatsHeader({ headline: h }: { headline: Headline }) {
  const cards = [
    { label: ui.stats.total, value: int(h.total) },
    { label: ui.stats.perYear, value: dec(h.perYear, 0) },
    { label: ui.stats.perDay, value: dec(h.perDay, 2) },
    { label: ui.stats.fatalSerious, value: pct(h.fatalSeriousShare) },
    { label: ui.stats.split, value: `${int(h.pedestrian)} / ${int(h.cyclist)}` },
  ];
  return (
    <div class="stats">
      {cards.map((c) => (
        <div class="stat" key={c.label}>
          <div class="stat-value">{c.value}</div>
          <div class="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/StatsHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatsHeader.tsx tests/components/StatsHeader.test.tsx
git commit -m "feat: add StatsHeader component"
```

---

### Task 12: Filters component

**Files:**
- Create: `src/components/Filters.tsx`
- Test: `tests/components/Filters.test.tsx`

**Interfaces:**
- Consumes: `FilterState` from `src/lib/filters`; `Meta` from contract; `ui`, `regionLabel`, `SEVERITY_LABELS`, `USER_TYPE_LABELS`.
- Produces: `Filters({ meta, value, onChange }: { meta: Meta; value: FilterState; onChange: (f: FilterState) => void })`. Region multi-select (checkbox list), year range (two selects), user type (radio), severity (checkbox list), reset button.

- [ ] **Step 1: Write the failing test**

`tests/components/Filters.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Filters } from '../../src/components/Filters';
import { defaultFilter } from '../../src/lib/url-state';
import type { Meta } from '../../src/lib/contract';

const meta: Meta = { generatedAt: '', total: 0, years: [2019, 2020, 2021], regionCodes: [3, 6] };

describe('Filters', () => {
  it('emits a new state when a region is toggled', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <Filters meta={meta} value={defaultFilter(meta)} onChange={onChange} />,
    );
    fireEvent.click(getByLabelText('Montréal'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].regions).toEqual([6]);
  });

  it('emits user type change', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <Filters meta={meta} value={defaultFilter(meta)} onChange={onChange} />,
    );
    fireEvent.click(getByLabelText('Cycliste'));
    expect(onChange.mock.calls[0][0].userType).toBe('cyclist');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/Filters.test.tsx`
Expected: FAIL (cannot find module `Filters`).

- [ ] **Step 3: Write the implementation**

`src/components/Filters.tsx`:
```tsx
import type { FilterState } from '../lib/filters';
import type { Meta, SeverityId } from '../lib/contract';
import { defaultFilter } from '../lib/url-state';
import { ui, regionLabel, SEVERITY_LABELS, USER_TYPE_LABELS } from '../i18n/fr';

type Props = { meta: Meta; value: FilterState; onChange: (f: FilterState) => void };

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function Filters({ meta, value, onChange }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });

  return (
    <section class="filters" aria-label={ui.filters.heading}>
      <h2>{ui.filters.heading}</h2>

      <fieldset>
        <legend>{ui.filters.years}</legend>
        <select
          value={value.years[0]}
          onChange={(e) => set({ years: [Number((e.target as HTMLSelectElement).value), value.years[1]] })}
        >
          {meta.years.map((y) => <option value={y} key={y}>{y}</option>)}
        </select>
        <span> – </span>
        <select
          value={value.years[1]}
          onChange={(e) => set({ years: [value.years[0], Number((e.target as HTMLSelectElement).value)] })}
        >
          {meta.years.map((y) => <option value={y} key={y}>{y}</option>)}
        </select>
      </fieldset>

      <fieldset>
        <legend>{ui.filters.userType}</legend>
        {(['both', 'pedestrian', 'cyclist'] as const).map((u) => (
          <label key={u}>
            <input type="radio" name="userType" checked={value.userType === u}
              onChange={() => set({ userType: u })} />
            {u === 'both' ? ui.filters.userAll : USER_TYPE_LABELS[u]}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{ui.filters.severity}</legend>
        {SEVERITY_LABELS.map((label, id) => (
          <label key={id}>
            <input type="checkbox"
              checked={value.severities.length === 0 || value.severities.includes(id as SeverityId)}
              onChange={() => set({ severities: toggle(value.severities, id as SeverityId) })} />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{ui.filters.region}</legend>
        {meta.regionCodes.map((code) => (
          <label key={code}>
            <input type="checkbox"
              checked={value.regions.length === 0 || value.regions.includes(code)}
              onChange={() => set({ regions: toggle(value.regions, code) })} />
            {regionLabel(code)}
          </label>
        ))}
      </fieldset>

      <button type="button" onClick={() => onChange(defaultFilter(meta))}>
        {ui.filters.reset}
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/Filters.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Filters.tsx tests/components/Filters.test.tsx
git commit -m "feat: add Filters component"
```

---

### Task 13: Chart components (Observable Plot)

**Files:**
- Create: `src/components/Charts.tsx`
- Test: `tests/components/Charts.test.tsx`

**Interfaces:**
- Consumes: `Collisions` from contract; `countBy` from aggregate; `ui`, `regionLabel`, `SEVERITY_LABELS`, `MONTH_LABELS`, `USER_TYPE_LABELS`.
- Produces: `Charts({ data, idx }: { data: Collisions; idx: number[] })` — renders a titled grid of Plot figures (year, month, severity, user type, region). Uses a `PlotFigure` helper that renders a Plot spec into a container via `useEffect`.

- [ ] **Step 1: Write the failing test**

`tests/components/Charts.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { Charts } from '../../src/components/Charts';
import type { Collisions } from '../../src/lib/contract';

const data: Collisions = {
  count: 3, year: [2020, 2021, 2021], month: [1, 6, 6], timeBand: [0, 1, 2],
  weekday: [0, 1, 1], severity: [0, 1, 1], userType: [0, 1, 0], regionCode: [3, 6, 3],
  lighting: [1, 1, 1], weather: [11, 11, 11], environment: [2, 2, 2], speed: [50, 50, 50],
};

describe('Charts', () => {
  it('renders one figure per chart with an SVG', async () => {
    const { container, findAllByRole } = render(<Charts data={data} idx={[0, 1, 2]} />);
    // chart titles present
    expect(container.textContent).toContain('Collisions par année');
    expect(container.textContent).toContain('Collisions par région');
    // Observable Plot renders <svg> (or <figure><svg>); wait for effects
    const svgs = await findAllByRole('img', {}, { timeout: 1000 }).catch(() => []);
    // Fallback: query svgs directly
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/Charts.test.tsx`
Expected: FAIL (cannot find module `Charts`).

- [ ] **Step 3: Write the implementation**

`src/components/Charts.tsx`:
```tsx
import { useEffect, useRef } from 'preact/hooks';
import * as Plot from '@observablehq/plot';
import type { Collisions } from '../lib/contract';
import { countBy, type NumericField } from '../lib/aggregate';
import { ui, regionLabel, SEVERITY_LABELS, MONTH_LABELS, USER_TYPE_LABELS } from '../i18n/fr';

// Renders an Observable Plot spec (a DOM node factory) into a div.
function PlotFigure({ options }: { options: Plot.PlotOptions }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const node = Plot.plot(options);
    el.append(node);
    return () => node.remove();
  }, [options]);
  return <div ref={ref} class="figure" />;
}

function barData(data: Collisions, idx: number[], field: NumericField, label: (k: number) => string) {
  return countBy(data, idx, field).map((b) => ({ name: label(b.key), count: b.count }));
}

export function Charts({ data, idx }: { data: Collisions; idx: number[] }) {
  const bar = (rows: { name: string; count: number }[], sortByCount = false) => ({
    marginLeft: 140,
    x: { label: null, grid: true },
    y: { label: null },
    marks: [
      Plot.barX(rows, {
        x: 'count', y: 'name', fill: '#2b6cb0',
        sort: sortByCount ? { y: 'x', reverse: true } : undefined,
      }),
      Plot.ruleX([0]),
    ],
  });

  const byYear = {
    x: { label: null, tickFormat: '' }, y: { label: null, grid: true },
    marks: [Plot.barY(countBy(data, idx, 'year').map((b) => ({ year: String(b.key), count: b.count })),
      { x: 'year', y: 'count', fill: '#2b6cb0' }), Plot.ruleY([0])],
  };

  const figures = [
    { title: ui.charts.byYear, options: byYear },
    { title: ui.charts.byMonth, options: bar(barData(data, idx, 'month', (k) => MONTH_LABELS[k - 1] ?? String(k))) },
    { title: ui.charts.bySeverity, options: bar(barData(data, idx, 'severity', (k) => SEVERITY_LABELS[k] ?? String(k))) },
    { title: ui.charts.byUserType, options: bar(barData(data, idx, 'userType', (k) => k === 0 ? USER_TYPE_LABELS.pedestrian : USER_TYPE_LABELS.cyclist)) },
    { title: ui.charts.byRegion, options: bar(barData(data, idx, 'regionCode', regionLabel), true) },
  ];

  return (
    <div class="charts">
      {figures.map((f) => (
        <figure class="chart" key={f.title}>
          <figcaption>{f.title}</figcaption>
          <PlotFigure options={f.options as Plot.PlotOptions} />
        </figure>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/Charts.test.tsx`
Expected: PASS (svg count > 0). If jsdom lacks a needed API, the fallback `querySelectorAll('svg')` assertion still validates rendering.

- [ ] **Step 5: Commit**

```bash
git add src/components/Charts.tsx tests/components/Charts.test.tsx
git commit -m "feat: add Observable Plot chart components"
```

---

### Task 14: Dashboard island + page wiring

**Files:**
- Create: `src/components/Dashboard.tsx`, `src/styles/global.css`
- Modify: `src/pages/index.astro`
- Test: `tests/components/Dashboard.test.tsx`

**Interfaces:**
- Consumes: everything above — `loadData`, `applyFilters`, `stats`, `parseQuery`/`toQuery`/`defaultFilter`, `Filters`, `StatsHeader`, `Charts`.
- Produces: `Dashboard({ collisions, meta }: { collisions: Collisions; meta: Meta })` — owns `FilterState`, initializes from `location.search`, updates URL via `history.replaceState` on change, recomputes indices/stats with `useMemo`.

- [ ] **Step 1: Write the failing test**

`tests/components/Dashboard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Dashboard } from '../../src/components/Dashboard';
import type { Collisions, Meta } from '../../src/lib/contract';

const collisions: Collisions = {
  count: 3, year: [2020, 2021, 2021], month: [1, 6, 6], timeBand: [0, 1, 2],
  weekday: [0, 1, 1], severity: [0, 1, 1], userType: [0, 1, 0], regionCode: [3, 6, 3],
  lighting: [1, 1, 1], weather: [11, 11, 11], environment: [2, 2, 2], speed: [50, 50, 50],
};
const meta: Meta = { generatedAt: '', total: 3, years: [2020, 2021], regionCodes: [3, 6] };

describe('Dashboard', () => {
  it('shows the total and updates it when filtering to one region', () => {
    const { container, getByLabelText } = render(<Dashboard collisions={collisions} meta={meta} />);
    expect(container.querySelector('.stat-value')?.textContent).toContain('3');
    fireEvent.click(getByLabelText('Montréal')); // regions -> [6]
    expect(container.querySelector('.stat-value')?.textContent).toContain('1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/Dashboard.test.tsx`
Expected: FAIL (cannot find module `Dashboard`).

- [ ] **Step 3: Write the implementation**

`src/components/Dashboard.tsx`:
```tsx
import { useMemo, useState, useEffect } from 'preact/hooks';
import type { Collisions, Meta } from '../lib/contract';
import { applyFilters, type FilterState } from '../lib/filters';
import { stats } from '../lib/aggregate';
import { parseQuery, toQuery, defaultFilter } from '../lib/url-state';
import { Filters } from './Filters';
import { StatsHeader } from './StatsHeader';
import { Charts } from './Charts';
import { ui } from '../i18n/fr';

export function Dashboard({ collisions, meta }: { collisions: Collisions; meta: Meta }) {
  const initial = typeof location !== 'undefined'
    ? parseQuery(location.search, meta)
    : defaultFilter(meta);
  const [filter, setFilter] = useState<FilterState>(initial);

  useEffect(() => {
    if (typeof history === 'undefined') return;
    const q = toQuery(filter, meta);
    history.replaceState(null, '', q ? `?${q}` : location.pathname);
  }, [filter, meta]);

  const idx = useMemo(() => applyFilters(collisions, filter), [collisions, filter]);
  const headline = useMemo(() => stats(collisions, idx, filter), [collisions, idx, filter]);

  return (
    <div class="dashboard">
      <StatsHeader headline={headline} />
      <div class="body">
        <Filters meta={meta} value={filter} onChange={setFilter} />
        <Charts data={collisions} idx={idx} />
      </div>
      <footer class="attribution">{ui.attribution}</footer>
    </div>
  );
}
```

`src/styles/global.css`:
```css
:root { --fg:#1a202c; --bg:#fff; --accent:#2b6cb0; --muted:#718096; }
* { box-sizing: border-box; }
body { margin:0; font-family: system-ui, sans-serif; color:var(--fg); background:var(--bg); }
main { max-width: 1200px; margin: 0 auto; padding: 1rem; }
.stats { display:grid; grid-template-columns: repeat(auto-fit,minmax(150px,1fr)); gap:1rem; }
.stat { padding:1rem; background:#f7fafc; border-radius:8px; text-align:center; }
.stat-value { font-size:1.8rem; font-weight:700; color:var(--accent); }
.stat-label { font-size:.85rem; color:var(--muted); }
.body { display:grid; grid-template-columns: 260px 1fr; gap:1.5rem; margin-top:1.5rem; }
.filters fieldset { border:1px solid #e2e8f0; border-radius:6px; margin-bottom:.75rem; }
.filters label { display:block; font-size:.9rem; }
.charts { display:grid; grid-template-columns: repeat(auto-fit,minmax(320px,1fr)); gap:1.5rem; }
.chart figcaption { font-weight:600; margin-bottom:.4rem; }
.attribution { margin-top:2rem; font-size:.8rem; color:var(--muted); }
@media (max-width: 800px) { .body { grid-template-columns: 1fr; } }
```

`src/pages/index.astro`:
```astro
---
import '../styles/global.css';
import { Dashboard } from '../components/Dashboard';
import { loadData } from '../lib/data';
import { ui } from '../i18n/fr';

const { collisions, meta } = await loadData();
---
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{ui.title}</title>
  </head>
  <body>
    <main>
      <h1>{ui.title}</h1>
      <p class="subtitle">{ui.subtitle}</p>
      <Dashboard client:load collisions={collisions} meta={meta} />
    </main>
  </body>
</html>
```

- [ ] **Step 4: Run test + build to verify**

Run: `npx vitest run tests/components/Dashboard.test.tsx`
Expected: PASS.

Run: `npm run build`
Expected: static build succeeds; `dist/index.html` contains the title and stat markup.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, open the site. Verify: stats + 5 charts render; toggling region/user type/severity/year updates everything; URL query updates; reloading the URL restores the same view.

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.tsx src/styles/global.css src/pages/index.astro tests/components/Dashboard.test.tsx
git commit -m "feat: wire Dashboard island, styles, and page"
```

---

## Phase 5 — Deployment & docs

### Task 15: Cloudflare Pages deploy via Forgejo Actions

**Files:**
- Create: `.forgejo/workflows/deploy.yml`, `wrangler.toml`

**Interfaces:**
- Consumes: committed artifacts + `npm run build` output in `dist/`.
- Produces: CI that builds and runs `wrangler pages deploy dist`.

- [ ] **Step 1: Write wrangler config**

`wrangler.toml`:
```toml
name = "accidents-analyzer"
pages_build_output_dir = "dist"
compatibility_date = "2024-11-01"
```

- [ ] **Step 2: Write the Forgejo Actions workflow**

`.forgejo/workflows/deploy.yml`:
```yaml
name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - name: Deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: npx wrangler pages deploy dist --project-name=accidents-analyzer
```

- [ ] **Step 3: Verify build works locally (CI parity)**

Run: `npm ci && npm run build`
Expected: `dist/` produced with no errors. (The deploy step runs in CI with secrets; not executed locally.)

- [ ] **Step 4: Commit**

```bash
git add .forgejo/workflows/deploy.yml wrangler.toml
git commit -m "ci: add Cloudflare Pages deploy via Forgejo Actions"
```

---

### Task 16: README

**Files:**
- Create: `README.md`

**Interfaces:**
- Documents: project summary, data source + CC-BY 4.0 attribution, the artifact contract, pipeline usage, dev/build, deployment (Cloudflare + Netlify fallback), and required secrets.

- [ ] **Step 1: Write the README**

`README.md`:
```markdown
# Analyseur de collisions — piétons et cyclistes au Québec

Static website visualizing SAAQ road collisions involving pedestrians or
cyclists across all of Québec: headline stats + charts with filters for
region, year, user type, and severity. No backend, no runtime database.

## Data source & attribution

- **Rapports d'accident**, Société de l'assurance automobile du Québec (SAAQ),
  via [Données Québec](https://www.donneesquebec.ca/recherche/fr/dataset/rapports-d-accident).
- License: **Creative Commons Attribution 4.0 (CC-BY 4.0)**.
- Attribution (shown in-app): *Société de l'assurance automobile du Québec
  (SAAQ) — Données Québec*.

**Note on geography:** since the December 2023 Law 25 revision, this dataset
has no coordinates — the finest geography is the administrative region
(`REG_ADM`). This site therefore analyzes collisions by region rather than on a
map.

## Architecture

Two decoupled layers sharing only the on-disk artifact contract:

- **Pipeline** (`pipeline/`, Node + TypeScript) — downloads yearly CSVs, filters
  to pedestrian/cyclist collisions, normalizes codes, emits artifacts.
- **Frontend** (`src/`, Astro + Preact + Observable Plot) — loads the artifacts,
  filters/aggregates in the browser, renders stats + charts.

### Artifact contract (`src/data/`)

- `collisions.json` — columnar table; each field is an array of length `count`,
  aligned by index: `year, month, timeBand, weekday, severity, userType,
  regionCode, lighting, weather, environment, speed`. Codes are documented in
  `src/lib/contract.ts`; French labels in `src/i18n/fr.ts`.
- `meta.json` — `{ generatedAt, total, years[], regionCodes[] }`.

Types are defined once in `src/lib/contract.ts` and imported by both layers.

## Run the pipeline (regenerate data)

Downloads raw CSVs into `raw/` (gitignored) and writes `src/data/*.json`:

```bash
npm install
npm run pipeline
```

Re-run when the SAAQ updates the dataset, then commit the regenerated
`src/data/collisions.json` and `src/data/meta.json`.

## Develop / build

```bash
npm run dev      # local dev server with HMR
npm run build    # static output in dist/
npm run preview  # serve the built dist/
npm test         # unit tests (Vitest)
```

## Deploy

### Cloudflare Pages (primary) — via Forgejo Actions

`.forgejo/workflows/deploy.yml` builds and runs `wrangler pages deploy dist` on
push to `main`. Committed artifacts are used as-is (CI does not run the
pipeline).

Create these **Forgejo Actions repository secrets**:

- `CLOUDFLARE_API_TOKEN` — token with the *Cloudflare Pages: Edit* permission.
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID.

Create a Pages project named `accidents-analyzer` once (matching `wrangler.toml`
and the `--project-name` flag).

### Netlify (fallback) — CLI

```bash
npm run build
npx netlify deploy --dir=dist --prod
```

## License

Code under this repository's license; data © SAAQ under CC-BY 4.0.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with data source, contract, and deploy guide"
```

---

## Phase 6 — Full verification

### Task 17: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 2: Fresh build**

Run: `rm -rf dist && npm run build`
Expected: `dist/index.html` produced; no errors.

- [ ] **Step 3: Confirm no raw data or secrets committed**

Run: `git status --porcelain && git ls-files raw/ | head`
Expected: clean tree; `raw/` returns nothing (gitignored). `src/data/collisions.json` and `src/data/meta.json` ARE tracked.

- [ ] **Step 4: Manual acceptance against Definition of Done**

Verify in `npm run preview`: filters (region/year/user type/severity) drive stats + all charts; URL reflects state and is shareable; layout is usable on a narrow viewport.

---

## Self-Review Notes

- **Spec coverage:** pipeline (Tasks 2–5), row-table-only artifact contract (Tasks 2, 5, 10), region-as-filter + province-wide scope (Tasks 6, 12), charts (Task 13), filters+URL state (Tasks 6, 8, 12, 14), headline stats (Tasks 7, 11), Astro static + islands (Tasks 1, 14), French i18n centralization (Task 9), Cloudflare/Forgejo deploy + Netlify fallback (Tasks 15–16), attribution/license (Tasks 9, 16). No map (by design).
- **Type consistency:** `Collisions`/`Meta`/`SeverityId`/`FilterState`/`Headline`/`NumericField` used identically across tasks; `applyFilters`→indices→`countBy`/`stats` chain is consistent.
- **Optional context charts** (lighting/weather/environment/speed) are carried in the artifact but not charted; they are a future add-on, deliberately out of scope for this plan.

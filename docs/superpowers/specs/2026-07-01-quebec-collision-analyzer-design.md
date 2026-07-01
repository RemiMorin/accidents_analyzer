# Québec Pedestrian/Cyclist Collision Analysis Tool — Design

Date: 2026-07-01
Status: Approved design (pre-implementation)

## 1. Summary

A 100%-static website that visualizes road collisions **involving pedestrians
or cyclists across all of Québec**, using the SAAQ "Rapports d'accident" open
dataset. No backend, no runtime database: the site ships pre-processed static
data artifacts and reads them directly in the browser.

The product is a **province-wide analysis dashboard**. Administrative region is
a first-class, multi-select **filter** (not a hardcoded geographic scope). Every
filter drives the headline stats and all charts simultaneously; filter state is
serialized to the URL so views are shareable.

## 2. Key finding that shaped this design

The specified primary source — SAAQ "Rapports d'accident" on Données Québec —
**contains no coordinates.** The dataset was revised in December 2023 to comply
with Québec's Law 25 (privacy); precise location was removed. The full schema
(25 variables, confirmed identical across 2011–2022) exposes geography only at
the **administrative-region** level (`REG_ADM`, 17 regions).

No open dataset provides point-level geolocation for the greater Québec City
area (the geolocated collision datasets on Données Québec cover only Montréal
and Laval, compiled by those cities' police services).

**Consequence:** the originally-envisioned interactive point/heatmap map cannot
be built from this source. Decision (owner-approved): **drop the map**; make
**region a selectable filter** and widen scope to all of Québec, turning the
limitation into a province-wide analysis tool.

## 3. Data source & schema

- Dataset: **Rapports d'accident**, Société de l'assurance automobile du Québec
  (SAAQ), via Données Québec.
- License: **Creative Commons Attribution 4.0 (CC-BY 4.0)**. Attribution:
  "Société de l'assurance automobile du Québec (SAAQ) — Données Québec".
- Resources: one CSV per year, **2011–2022** (S3-hosted), plus a variable
  documentation PDF ("Documentation sur les variables", rev. 2023-12-19).

### Relevant columns (from the SAAQ data dictionary)

| Column | Meaning | Used for |
| --- | --- | --- |
| `AN` | Year (YYYY) | time axis, year-range filter |
| `MS_ACCDN` | Month (`01`–`12`) | seasonality chart |
| `HR_ACCDN` | 4-hour time band | time-of-day chart (optional) |
| `JR_SEMN_ACCDN` | `SEM` (Mon–Fri) / `FDS` (Sat–Sun) | weekday/weekend (optional) |
| `GRAVITE` | Severity, 4 levels | severity chart, filter, headline |
| `REG_ADM` | Administrative region, e.g. `Capitale-Nationale (03)` | region filter/chart |
| `IND_PIETON` | `O`/`N` — ≥1 pedestrian victim | user_type = pedestrian |
| `IND_VELO` | `O`/`N` — ≥1 bicycle involved | user_type = cyclist |
| `CD_ECLRM` | Lighting | context chart (optional) |
| `CD_COND_METEO` | Weather | context chart (optional) |
| `CD_ENVRN_ACCDN` | Environment (school/residential/…) | context chart (optional) |
| `VITESSE_AUTOR` | Posted speed limit | context chart (optional) |

`GRAVITE` values, in severity order:
`Mortel ou grave` > `Léger` > `Dommages matériels seulement` >
`Dommages matériels inférieurs au seuil de rapportage`.

### Data quirks (handled in the pipeline)

- **Stray tab characters** appear between some columns in the raw CSV. Strip
  `\t` before CSV parsing.
- Files carry a **UTF-8 BOM**; read as `utf-8-sig`.
- Region display names are lightly mangled in the raw data (the `―` character
  renders as `/-`). Therefore **key regions by their numeric code** (`01`–`17`,
  parsed from the `(NN)` suffix) and map to clean French labels in the frontend.
- `IND_PIETON` and `IND_VELO` are effectively **mutually exclusive** in the data
  (0 rows had both in 2021); `user_type` is a clean single value per row.

### Volume (measured, 2021)

- 100,603 total collisions → **3,767 pedestrian/cyclist** (2,007 pedestrian,
  1,760 cyclist). Across 2011–2022, **≈45,000 rows total** — small enough to
  ship the entire filtered row table and aggregate client-side.

## 4. Architecture

Two decoupled layers sharing only the on-disk **artifact contract** (§5).

```
pipeline/ (Node)            build-time, run manually on SAAQ updates
  ├─ config.js   ← single source of truth (years, region map, fields, paths)
  ├─ download.js ← fetch yearly CSVs → raw/ (gitignored)
  ├─ transform.js← parse+clean, filter ped|cyclist, normalize, emit artifacts
  └─ run.js      ← orchestrator (npm run pipeline)

src/ (Astro, static + islands)
  ├─ data/          committed artifacts: collisions.json, meta.json
  ├─ lib/           pure, unit-tested logic
  │   ├─ filters.*  apply a filter state to the row table
  │   ├─ aggregate.*compute chart series from filtered rows
  │   ├─ url-state.*parse/serialize filter state ⇄ query string
  │   └─ format.*   number/label formatting
  ├─ i18n/fr.ts     ALL French UI strings + code→label maps
  ├─ components/    Dashboard (island) + Filters, StatsHeader, charts
  └─ pages/index.astro
```

### Pipeline decisions
- **Language: Node** — single toolchain with the Astro frontend; no coordinate
  reprojection is needed, removing Python's only real advantage here.
- Raw CSVs are **never committed** (`.gitignore`d); the fetch command is
  documented.
- Geographic scope is **not** a filter gate in the pipeline: the pipeline keeps
  **all regions** (filtered only to pedestrian/cyclist). Region selection is a
  frontend concern.

### Frontend decisions
- **Astro**, static output, islands architecture. A single hydrated island
  (`Dashboard`) owns filter state; everything else is static HTML/CSS.
- Charts: **Observable Plot** (compact, declarative, ideal for these
  breakdowns).
- **All aggregation is client-side.** ~45k rows aggregate in <10ms on any
  filter change, so no pre-computed aggregate cube is shipped.
- **i18n:** code and comments in English; **all** user-facing text in French,
  centralized in `src/i18n/fr.ts` (including region and severity labels).

## 5. Artifact contract (the layer boundary)

The pipeline emits exactly two files into `src/data/`. This is the *only*
coupling between pipeline and frontend; it is documented in the README.

### `collisions.json` — columnar per-collision table
Columnar (arrays per field) for compactness and fast typed access. One entry
per pedestrian/cyclist collision. Fields:

- `year` (int), `month` (1–12), `timeBand` (small int/enum),
  `weekday` (`SEM`/`FDS`), `severity` (enum id, 0–3 by severity order),
  `userType` (`pedestrian`/`cyclist`), `regionCode` (`"01"`–`"17"`),
  and a small set of context ids: `lighting`, `weather`, `environment`,
  `speedLimit`.

### `meta.json` — bootstrap metadata
- `years`: available years; `regions`: code→French label; `severities`: ordered
  ids→labels; `total`: row count; `generatedAt`. Lets the UI render controls
  without scanning the row table.

Both artifacts are **committed to git** (small, regenerated on SAAQ updates).

## 6. Features

- **Filters (drive stats + all charts, mirrored to URL query string):**
  year range, user type (pedestrian / cyclist / both), severity (multi),
  **region (multi-select)**. Default selection: all regions, all years.
- **Headline stats** for the current selection: total collisions, average per
  year, average per day, share fatal-or-serious, pedestrian vs cyclist split.
  Presented plainly, no editorializing.
- **Charts (Observable Plot):** collisions by year; by month (seasonality); by
  severity; pedestrian vs cyclist; **by region**. Optional context charts
  (time-of-day band, lighting, weather) as a secondary section.
- **Responsive**, usable on mobile.

## 7. Deployment

- **Target: Cloudflare Pages** (free tier, no backend). Deployed from
  self-hosted Forgejo via **Forgejo Actions**:
  1. Checkout (artifacts already committed — CI does **not** re-run the pipeline
     or download CSVs).
  2. `npm ci && npm run build`.
  3. `wrangler pages deploy dist` using secrets **`CLOUDFLARE_API_TOKEN`** and
     **`CLOUDFLARE_ACCOUNT_ID`** (Forgejo Actions repository secrets).
- **Fallback:** deploy the same `dist/` to **Netlify** via `netlify deploy`
  (documented in README).

## 8. Definition of done

- `npm run pipeline` regenerates `collisions.json` + `meta.json` reproducibly
  from the raw SAAQ CSVs.
- `npm run dev` serves the site with working charts + filters (region, year,
  user type, severity), state reflected in the URL.
- `npm run build` produces a static `dist/`.
- Forgejo Actions workflow builds and deploys to Cloudflare Pages.
- README documents: data source, CC-BY 4.0 attribution, artifact contract,
  pipeline usage, dev/build, and deployment (Cloudflare + Netlify fallback).
- No backend, no runtime DB, no raw CSVs committed to git.

## 9. Deviations from the original brief (noted)

1. **No map.** Source has no coordinates for Québec City; map dropped, region
   becomes a filter, scope widened to all of Québec (owner-approved).
2. **Single row-table artifact** (`collisions.json` + `meta.json`) instead of
   `collisions.geojson` + `aggregates.json`: no geometry to carry, and
   client-side aggregation over ~45k rows makes a pre-computed cube redundant
   while supporting arbitrary filter combinations (owner-approved).
3. **Pipeline in Node** rather than Python (owner-approved).

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

`.forgejo/workflows/deploy.yml` builds and runs
`wrangler pages deploy dist --project-name=accidents-analyzer` on push to
`main`. Committed artifacts are used as-is (CI does not run the pipeline).

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

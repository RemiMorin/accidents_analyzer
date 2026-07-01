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

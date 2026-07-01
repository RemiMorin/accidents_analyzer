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

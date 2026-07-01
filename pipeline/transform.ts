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

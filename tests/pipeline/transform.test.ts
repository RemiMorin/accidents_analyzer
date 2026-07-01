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

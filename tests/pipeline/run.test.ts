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

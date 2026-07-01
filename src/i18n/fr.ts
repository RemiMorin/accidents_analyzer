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
  subtitle: "Données des rapports d'accident de la SAAQ",
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
    'Source : Société de l\'assurance automobile du Québec (SAAQ) — Données Québec, CC-BY 4.0',
} as const;

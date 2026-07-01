const nf = new Intl.NumberFormat('fr-CA');
const pf = new Intl.NumberFormat('fr-CA', { style: 'percent', maximumFractionDigits: 0 });

export const int = (n: number): string => nf.format(Math.round(n));
export const dec = (n: number, d = 1): string =>
  new Intl.NumberFormat('fr-CA', { maximumFractionDigits: d }).format(n);
export const pct = (x: number): string => pf.format(x).replace(/ /g, ' ');

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
    y: { label: null, domain: sortByCount ? undefined : rows.map((r) => r.name) },
    marks: [
      Plot.barX(rows, {
        x: 'count', y: 'name', fill: '#2b6cb0',
        sort: sortByCount ? { y: 'x', reverse: true } : undefined,
      }),
      Plot.ruleX([0]),
    ],
  });

  const byYear = {
    x: { type: 'band', label: null, tickFormat: '' }, y: { label: null, grid: true },
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

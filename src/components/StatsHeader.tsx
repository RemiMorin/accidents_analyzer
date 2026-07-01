import type { Headline } from '../lib/aggregate';
import { int, dec, pct } from '../lib/format';
import { ui } from '../i18n/fr';

export function StatsHeader({ headline: h }: { headline: Headline }) {
  const cards = [
    { label: ui.stats.total, value: int(h.total) },
    { label: ui.stats.perYear, value: dec(h.perYear, 0) },
    { label: ui.stats.perDay, value: dec(h.perDay, 2) },
    { label: ui.stats.fatalSerious, value: pct(h.fatalSeriousShare) },
    { label: ui.stats.split, value: `${int(h.pedestrian)} / ${int(h.cyclist)}` },
  ];
  return (
    <div class="stats">
      {cards.map((c) => (
        <div class="stat" key={c.label}>
          <div class="stat-value">{c.value}</div>
          <div class="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

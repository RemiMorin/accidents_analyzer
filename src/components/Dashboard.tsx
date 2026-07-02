import { useMemo, useState, useEffect } from 'preact/hooks';
import type { Collisions, Meta } from '../lib/contract';
import { applyFilters, type FilterState } from '../lib/filters';
import { stats } from '../lib/aggregate';
import { parseQuery, toQuery, defaultFilter } from '../lib/url-state';
import { Filters } from './Filters';
import { StatsHeader } from './StatsHeader';
import { Charts } from './Charts';
import { ui } from '../i18n/fr';

export function Dashboard({ collisions, meta }: { collisions: Collisions; meta: Meta }) {
  const initial = typeof location !== 'undefined'
    ? parseQuery(location.search, meta)
    : defaultFilter(meta);
  const [filter, setFilter] = useState<FilterState>(initial);

  useEffect(() => {
    if (typeof history === 'undefined') return;
    const q = toQuery(filter, meta);
    history.replaceState(null, '', q ? `?${q}` : location.pathname);
  }, [filter, meta]);

  const idx = useMemo(() => applyFilters(collisions, filter), [collisions, filter]);
  const headline = useMemo(() => stats(collisions, idx, filter), [collisions, idx, filter]);

  return (
    <div class="dashboard">
      <StatsHeader headline={headline} />
      <div class="body">
        <Filters meta={meta} value={filter} onChange={setFilter} />
        <Charts data={collisions} idx={idx} />
      </div>
      <footer class="attribution">{ui.attribution}</footer>
    </div>
  );
}

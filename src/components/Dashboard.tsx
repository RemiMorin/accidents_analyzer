import { useMemo, useState, useEffect, useRef } from 'preact/hooks';
import type { Collisions, Meta } from '../lib/contract';
import { applyFilters, type FilterState } from '../lib/filters';
import { stats } from '../lib/aggregate';
import { parseQuery, toQuery, defaultFilter } from '../lib/url-state';
import { Filters } from './Filters';
import { StatsHeader } from './StatsHeader';
import { Charts } from './Charts';
import { ui } from '../i18n/fr';

export function Dashboard({ collisions, meta }: { collisions: Collisions; meta: Meta }) {
  const [filter, setFilter] = useState<FilterState>(() => defaultFilter(meta));

  // After hydration, adopt filter state from the URL (avoids SSR/client hydration
  // mismatch that leaves control inputs showing the default).
  useEffect(() => {
    if (typeof location !== 'undefined') setFilter(parseQuery(location.search, meta));
  }, [meta]);

  // Mirror filter state to the URL, but skip the first run so a shared URL is not
  // cleared before the adopt-effect above restores it.
  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) { firstSync.current = false; return; }
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

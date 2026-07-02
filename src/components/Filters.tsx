import type { FilterState } from '../lib/filters';
import type { Meta, SeverityId } from '../lib/contract';
import { defaultFilter } from '../lib/url-state';
import { ui, regionLabel, SEVERITY_LABELS, USER_TYPE_LABELS } from '../i18n/fr';

type Props = { meta: Meta; value: FilterState; onChange: (f: FilterState) => void };

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function Filters({ meta, value, onChange }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });

  return (
    <section class="filters" aria-label={ui.filters.heading}>
      <h2>{ui.filters.heading}</h2>

      <fieldset>
        <legend>{ui.filters.years}</legend>
        <select
          value={value.years[0]}
          onChange={(e) => set({ years: [Number((e.target as HTMLSelectElement).value), value.years[1]] })}
        >
          {meta.years.map((y) => <option value={y} key={y}>{y}</option>)}
        </select>
        <span> – </span>
        <select
          value={value.years[1]}
          onChange={(e) => set({ years: [value.years[0], Number((e.target as HTMLSelectElement).value)] })}
        >
          {meta.years.map((y) => <option value={y} key={y}>{y}</option>)}
        </select>
      </fieldset>

      <fieldset>
        <legend>{ui.filters.userType}</legend>
        {(['both', 'pedestrian', 'cyclist'] as const).map((u) => (
          <label key={u}>
            <input type="radio" name="userType" checked={value.userType === u}
              onChange={() => set({ userType: u })} />
            {u === 'both' ? ui.filters.userAll : USER_TYPE_LABELS[u]}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{ui.filters.severity}</legend>
        <p class="filter-hint">{ui.filters.allHint}</p>
        {SEVERITY_LABELS.map((label, id) => (
          <label key={id}>
            <input type="checkbox"
              checked={value.severities.includes(id as SeverityId)}
              onChange={() => set({ severities: toggle(value.severities, id as SeverityId) })} />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{ui.filters.region}</legend>
        <p class="filter-hint">{ui.filters.allHint}</p>
        {meta.regionCodes.map((code) => (
          <label key={code}>
            <input type="checkbox"
              checked={value.regions.includes(code)}
              onChange={() => set({ regions: toggle(value.regions, code) })} />
            {regionLabel(code)}
          </label>
        ))}
      </fieldset>

      <button type="button" onClick={() => onChange(defaultFilter(meta))}>
        {ui.filters.reset}
      </button>
    </section>
  );
}

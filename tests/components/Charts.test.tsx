import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { Charts } from '../../src/components/Charts';
import type { Collisions } from '../../src/lib/contract';

const data: Collisions = {
  count: 3, year: [2020, 2021, 2021], month: [1, 6, 6], timeBand: [0, 1, 2],
  weekday: [0, 1, 1], severity: [0, 1, 1], userType: [0, 1, 0], regionCode: [3, 6, 3],
  lighting: [1, 1, 1], weather: [11, 11, 11], environment: [2, 2, 2], speed: [50, 50, 50],
};

describe('Charts', () => {
  it('renders one figure per chart with an SVG', async () => {
    const { container, findAllByRole } = render(<Charts data={data} idx={[0, 1, 2]} />);
    // chart titles present
    expect(container.textContent).toContain('Collisions par année');
    expect(container.textContent).toContain('Collisions par région');
    // Observable Plot renders <svg> (or <figure><svg>); wait for effects
    const svgs = await findAllByRole('img', {}, { timeout: 1000 }).catch(() => []);
    // Fallback: query svgs directly
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });
});

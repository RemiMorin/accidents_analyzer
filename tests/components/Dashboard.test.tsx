import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Dashboard } from '../../src/components/Dashboard';
import type { Collisions, Meta } from '../../src/lib/contract';

const collisions: Collisions = {
  count: 3, year: [2020, 2021, 2021], month: [1, 6, 6], timeBand: [0, 1, 2],
  weekday: [0, 1, 1], severity: [0, 1, 1], userType: [0, 1, 0], regionCode: [3, 6, 3],
  lighting: [1, 1, 1], weather: [11, 11, 11], environment: [2, 2, 2], speed: [50, 50, 50],
};
const meta: Meta = { generatedAt: '', total: 3, years: [2020, 2021], regionCodes: [3, 6] };

describe('Dashboard', () => {
  it('shows the total and updates it when filtering to one region', () => {
    const { container, getByLabelText } = render(<Dashboard collisions={collisions} meta={meta} />);
    expect(container.querySelector('.stat-value')?.textContent).toContain('3');
    fireEvent.click(getByLabelText('Montréal')); // regions -> [6]
    expect(container.querySelector('.stat-value')?.textContent).toContain('1');
  });
});

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { StatsHeader } from '../../src/components/StatsHeader';

describe('StatsHeader', () => {
  it('renders the total and split', () => {
    const { getByText, container } = render(
      <StatsHeader headline={{ total: 1234, perYear: 100, perDay: 0.5, fatalSeriousShare: 0.25, pedestrian: 800, cyclist: 434 }} />,
    );
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('234'); // grouped 1 234
    expect(getByText(/800/)).toBeTruthy();
  });
});

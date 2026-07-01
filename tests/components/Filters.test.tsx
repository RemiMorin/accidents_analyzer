import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Filters } from '../../src/components/Filters';
import { defaultFilter } from '../../src/lib/url-state';
import type { Meta } from '../../src/lib/contract';

const meta: Meta = { generatedAt: '', total: 0, years: [2019, 2020, 2021], regionCodes: [3, 6] };

describe('Filters', () => {
  it('emits a new state when a region is toggled', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <Filters meta={meta} value={defaultFilter(meta)} onChange={onChange} />,
    );
    fireEvent.click(getByLabelText('Montréal'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].regions).toEqual([6]);
  });

  it('emits user type change', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <Filters meta={meta} value={defaultFilter(meta)} onChange={onChange} />,
    );
    fireEvent.click(getByLabelText('Cycliste'));
    expect(onChange.mock.calls[0][0].userType).toBe('cyclist');
  });
});

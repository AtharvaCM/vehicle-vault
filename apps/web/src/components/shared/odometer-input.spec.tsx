import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OdometerInput } from './odometer-input';

describe('OdometerInput', () => {
  it('groups the reading as it is read, with its unit beside it', () => {
    render(<OdometerInput aria-label="Odometer" onChange={vi.fn()} value={32000} />);

    expect(screen.getByLabelText('Odometer')).toHaveValue('32,000');
    expect(screen.getByText('km')).toBeInTheDocument();
  });

  it('keeps only the digits of what is typed or pasted', () => {
    const onChange = vi.fn();
    render(<OdometerInput aria-label="Odometer" onChange={onChange} value={undefined} />);

    fireEvent.change(screen.getByLabelText('Odometer'), { target: { value: '1,23,456 km' } });

    expect(onChange).toHaveBeenCalledWith(123456);
  });

  it('reports an emptied field as NaN, for the schema to name', () => {
    const onChange = vi.fn();
    render(<OdometerInput aria-label="Odometer" onChange={onChange} value={500} />);

    fireEvent.change(screen.getByLabelText('Odometer'), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith(Number.NaN);
  });
});

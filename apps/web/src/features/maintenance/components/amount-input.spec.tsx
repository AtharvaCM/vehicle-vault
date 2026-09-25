import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { AmountInput, groupAmount, parseAmount } from './amount-input';
import { matchWorkshops } from './workshop-suggestions';

describe('groupAmount and parseAmount', () => {
  it('group rupees the Indian way, keeping a point and two digits of paise', () => {
    expect(groupAmount('131624')).toBe('1,31,624');
    expect(groupAmount('₹ 1,31,6245')).toBe('13,16,245');
    expect(groupAmount('1520.')).toBe('1,520.');
    expect(groupAmount('1520.456')).toBe('1,520.45');
    expect(groupAmount('007')).toBe('7');
    expect(groupAmount('.5')).toBe('0.5');
    expect(groupAmount('')).toBe('');

    expect(parseAmount('1,31,624.5')).toBe(131_624.5);
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount('')).toBe(undefined);
    expect(parseAmount('.')).toBe(undefined);
  });
});

function Harness({ initial }: { initial?: number }) {
  const [value, setValue] = useState<number | undefined>(initial);

  return (
    <>
      <AmountInput aria-label="Total" onValueChange={setValue} value={value} />
      <output>{String(value)}</output>
      <button onClick={() => setValue(2_400)} type="button">
        Set
      </button>
    </>
  );
}

describe('AmountInput', () => {
  it('holds a number, shows it grouped, and takes a value set from outside', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Total');

    expect(input).toHaveAttribute('inputmode', 'decimal');
    fireEvent.change(input, { target: { value: '250000' } });
    expect(input).toHaveValue('2,50,000');
    expect(screen.getByRole('status')).toHaveTextContent('250000');

    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('status')).toHaveTextContent('undefined');

    fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    expect(input).toHaveValue('2,400');
  });
});

describe('matchWorkshops', () => {
  const names = ['Sai Motors', 'Torque Garage', 'Speedy Auto', 'Sai Service', 'Bosch Car Care'];

  it('offers the most recent few, then those whose words start with what is typed', () => {
    expect(matchWorkshops(names, '')).toEqual(names.slice(0, 4));
    expect(matchWorkshops(names, 'tor')).toEqual(['Torque Garage']);
    expect(matchWorkshops(names, 'sai')).toEqual(['Sai Motors', 'Sai Service']);
    expect(matchWorkshops(names, 'torque ga')).toEqual(['Torque Garage']);
    expect(matchWorkshops(names, 'torque garage')).toEqual([]);
  });
});

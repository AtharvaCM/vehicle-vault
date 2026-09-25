import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PlateInput } from './plate-input';

function ControlledPlateInput({ onBlur }: { onBlur?: () => void }) {
  const [value, setValue] = useState('');

  return <PlateInput id="plate" onBlur={onBlur} onChange={setValue} value={value} />;
}

describe('PlateInput', () => {
  it('upper-cases and groups a standard plate as it is typed', async () => {
    const user = userEvent.setup();
    render(<ControlledPlateInput />);

    await user.type(screen.getByRole('textbox'), 'mh12dm0002');

    expect(screen.getByRole('textbox')).toHaveValue('MH 12 DM 0002');
  });

  it('groups a Bharat series plate as year · BH · number · series', async () => {
    const user = userEvent.setup();
    render(<ControlledPlateInput />);

    await user.type(screen.getByRole('textbox'), '22bh1234aa');

    expect(screen.getByRole('textbox')).toHaveValue('22 BH 1234 AA');
  });

  it('groups a temporary registration as T · month+year · state · number · series', async () => {
    const user = userEvent.setup();
    render(<ControlledPlateInput />);

    await user.type(screen.getByRole('textbox'), 't0724hr6123a');

    expect(screen.getByRole('textbox')).toHaveValue('T 0724 HR 6123 A');
  });

  it('leaves input that never forms a plate upper-cased and ungrouped', async () => {
    const user = userEvent.setup();
    render(<ControlledPlateInput />);

    await user.type(screen.getByRole('textbox'), 'temp reg');

    expect(screen.getByRole('textbox')).toHaveValue('TEMPREG');
  });

  it('shows the IND strip once there is a recognised plate, not before', async () => {
    const user = userEvent.setup();
    render(<ControlledPlateInput />);

    expect(screen.queryByText('IND')).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox'), 'mh12dm0002');

    expect(screen.getByText('IND')).toBeInTheDocument();
  });

  it('calls onBlur when the field loses focus', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    render(<ControlledPlateInput onBlur={onBlur} />);

    await user.click(screen.getByRole('textbox'));
    await user.tab();

    expect(onBlur).toHaveBeenCalled();
  });

  it('marks the plate invalid and forwards aria-describedby for the field message', () => {
    render(
      <PlateInput
        aria-describedby="plate-message"
        aria-invalid
        id="plate"
        onChange={() => {}}
        value="ABC"
      />,
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'plate-message');
  });
});

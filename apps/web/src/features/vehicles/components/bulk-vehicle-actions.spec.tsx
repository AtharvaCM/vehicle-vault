import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BulkVehicleActions } from './bulk-vehicle-actions';

const selectedVehicles = [
  {
    id: 'vehicle-1',
    make: 'Honda',
    model: 'City',
    nickname: 'Daily driver',
    registrationNumber: 'MH12AB1234',
  },
  {
    id: 'vehicle-2',
    make: 'Bajaj',
    model: 'Pulsar NS 200',
    nickname: undefined,
    registrationNumber: 'MH14CD5678',
  },
];

describe('BulkVehicleActions', () => {
  it('shows nothing to delete when no vehicle is selected', () => {
    render(
      <BulkVehicleActions
        onClearSelection={vi.fn()}
        onDeleteSelected={vi.fn()}
        onSelectAllVisible={vi.fn()}
        selectedVehicles={[]}
        visibleCount={3}
      />,
    );

    expect(screen.getByText('Select vehicles to take action')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete selected/i })).not.toBeInTheDocument();
  });

  it('lists each selected vehicle by name and registration in the delete confirmation', async () => {
    const user = userEvent.setup();

    render(
      <BulkVehicleActions
        onClearSelection={vi.fn()}
        onDeleteSelected={vi.fn()}
        onSelectAllVisible={vi.fn()}
        selectedVehicles={selectedVehicles}
        visibleCount={3}
      />,
    );

    expect(screen.getByText('2 vehicles selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete selected (2)' }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Daily driver');
    expect(dialog).toHaveTextContent('MH12AB1234');
    // Falls back to make + model when there is no nickname.
    expect(dialog).toHaveTextContent('Bajaj Pulsar NS 200');
    expect(dialog).toHaveTextContent('MH14CD5678');
  });
});

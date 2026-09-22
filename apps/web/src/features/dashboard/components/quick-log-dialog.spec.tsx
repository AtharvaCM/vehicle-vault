import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appToast } from '@/lib/toast';

const mutateAsync = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { params?: unknown; to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('../hooks/use-quick-log', () => ({
  useQuickLog: () => ({ mutateAsync, isPending: false }),
}));
vi.mock('@/lib/toast', () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { QuickLogDialog, type QuickLogVehicle } from './quick-log-dialog';

const swift: QuickLogVehicle = {
  id: 'vehicle-1',
  displayName: 'Swift',
  registrationNumber: 'MH12AB1234',
  odometer: 42000,
};

function open(vehicles: QuickLogVehicle[] = [swift]) {
  const onOpenChange = vi.fn();
  render(<QuickLogDialog onOpenChange={onOpenChange} open vehicles={vehicles} />);
  return { onOpenChange };
}

describe('QuickLogDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({
      record: { id: 'record-1' },
      odometerFailed: false,
      photoFailed: false,
    });
  });

  it('asks for date, odometer, cost and a photo, and nothing else', () => {
    open();

    expect(screen.getByLabelText('Date')).toHaveValue(new Date().toISOString().slice(0, 10));
    expect(screen.getByLabelText('Odometer (km)')).toHaveValue(42000);
    expect(screen.getByLabelText('Cost')).toHaveValue(null);
    expect(screen.getByLabelText('Photo')).toHaveAttribute('capture', 'environment');
    // One vehicle: nothing to choose.
    expect(screen.queryByLabelText('Vehicle')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Use the full form' })).toHaveAttribute(
      'href',
      '/vehicles/$vehicleId/maintenance/new',
    );
  });

  it('will not save without a cost, or with a negative one', async () => {
    open();

    fireEvent.click(screen.getByRole('button', { name: 'Log service' }));
    expect(await screen.findByText('Enter what it cost')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log service' }));
    expect(await screen.findByText('Cost cannot be negative')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('saves what was entered against the vehicle, with the photo', async () => {
    const { onOpenChange } = open();
    const photo = new File(['job card'], 'job-card.jpg', { type: 'image/jpeg' });

    fireEvent.change(screen.getByLabelText('Odometer (km)'), { target: { value: '42510' } });
    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: '3200' } });
    fireEvent.change(screen.getByLabelText('Photo'), { target: { files: [photo] } });
    fireEvent.click(screen.getByRole('button', { name: 'Log service' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      vehicle: swift,
      serviceDate: new Date().toISOString().slice(0, 10),
      odometer: 42510,
      totalCost: 3200,
      photo,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(appToast.success).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Service logged' }),
    );
  });

  it('says what did not happen when the record saved but the photo did not', async () => {
    mutateAsync.mockResolvedValue({
      record: { id: 'record-1' },
      odometerFailed: false,
      photoFailed: true,
    });
    open();

    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log service' }));

    await waitFor(() =>
      expect(appToast.info).toHaveBeenCalledWith({
        title: 'Service logged',
        description: "But the photo didn't upload; add it from the record.",
      }),
    );
  });

  it('asks which vehicle when there is more than one to log against', () => {
    open([swift, { ...swift, id: 'vehicle-2', displayName: 'Activa', odometer: 8000 }]);

    expect(screen.getByLabelText('Vehicle')).toBeInTheDocument();
  });
});

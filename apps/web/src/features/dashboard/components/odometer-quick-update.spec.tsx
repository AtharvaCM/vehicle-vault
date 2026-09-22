import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

const updateOdometer = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: Record<string, string>;
    to?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/vehicles/hooks/use-update-vehicle-odometer', () => ({
  useUpdateVehicleOdometer: () => ({ mutateAsync: updateOdometer, isPending: false }),
}));
vi.mock('@/lib/toast', () => ({
  appToast: { success: toastSuccess, error: vi.fn(), info: vi.fn() },
}));

import { OdometerQuickUpdate } from './odometer-quick-update';

async function openWithReading(reading: string) {
  const user = userEvent.setup();
  render(<OdometerQuickUpdate displayName="Daily driver" odometer={12000} vehicleId="vehicle-1" />);

  await user.click(screen.getByRole('button', { name: 'Update odometer for Daily driver' }));
  const input = screen.getByLabelText('New reading (km)');
  await user.clear(input);
  if (reading) await user.type(input, reading);
  await user.click(screen.getByRole('button', { name: 'Save' }));

  return { user, input };
}

describe('OdometerQuickUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateOdometer.mockResolvedValue(undefined);
  });

  it('starts from the stored reading', async () => {
    const user = userEvent.setup();
    render(
      <OdometerQuickUpdate displayName="Daily driver" odometer={12000} vehicleId="vehicle-1" />,
    );

    await user.click(screen.getByRole('button', { name: 'Update odometer for Daily driver' }));

    expect(screen.getByLabelText('New reading (km)')).toHaveValue(12000);
  });

  it('saves a higher reading in one number, without leaving the dashboard', async () => {
    await openWithReading('12850');

    await waitFor(() => expect(updateOdometer).toHaveBeenCalledWith(12850));
    await waitFor(() =>
      expect(screen.queryByLabelText('New reading (km)')).not.toBeInTheDocument(),
    );
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Daily driver now reads 12,850 km.' }),
    );
  });

  it('refuses a lower reading, and points at the edit form for a typo', async () => {
    await openWithReading('11900');

    expect(updateOdometer).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "The odometer already reads 12,000 km, so a lower reading can't be saved here.",
    );
    expect(screen.getByRole('link', { name: 'Edit the vehicle' })).toHaveAttribute(
      'href',
      '/vehicles/$vehicleId/edit',
    );
    // The popover stays open with the attempt in it.
    expect(screen.getByLabelText('New reading (km)')).toHaveValue(11900);
  });

  it('asks for a whole number when the field is empty', async () => {
    await openWithReading('');

    expect(updateOdometer).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the reading in whole kilometres.');
    expect(screen.queryByRole('link', { name: 'Edit the vehicle' })).not.toBeInTheDocument();
  });

  it("shows the API's own refusal, such as a reading that raced in from a fuel log", async () => {
    const refusal = "The odometer already reads 13,000 km, so a lower reading can't be saved here.";
    // Shaped as the API client builds it: the message lives in the envelope.
    updateOdometer.mockRejectedValue(
      new ApiError(refusal, 400, {
        success: false,
        error: { code: 'BAD_REQUEST', message: refusal },
        meta: { path: '/api/vehicles/vehicle-1/odometer', timestamp: '2026-09-22T00:00:00.000Z' },
      }),
    );

    await openWithReading('12500');

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('already reads 13,000 km'),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

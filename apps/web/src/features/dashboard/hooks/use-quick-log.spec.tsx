import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  createMaintenanceRecord: vi.fn(),
  updateVehicleOdometer: vi.fn(),
  uploadAttachments: vi.fn(),
}));

vi.mock('@/features/maintenance/api/create-maintenance-record', () => ({
  createMaintenanceRecord: api.createMaintenanceRecord,
}));
vi.mock('@/features/vehicles/api/update-vehicle-odometer', () => ({
  updateVehicleOdometer: api.updateVehicleOdometer,
}));
vi.mock('@/features/attachments/api/upload-attachments', () => ({
  uploadAttachments: api.uploadAttachments,
}));

import { useQuickLog, type QuickLogInput } from './use-quick-log';

function renderQuickLog() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return renderHook(() => useQuickLog(), { wrapper }).result;
}

const log = (overrides: Partial<QuickLogInput> = {}): QuickLogInput => ({
  vehicle: { id: 'vehicle-1', odometer: 42000 },
  serviceDate: '2026-09-20',
  odometer: 42500,
  totalCost: 3200,
  photo: null,
  ...overrides,
});

describe('useQuickLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.createMaintenanceRecord.mockResolvedValue({ id: 'record-1' });
    api.updateVehicleOdometer.mockResolvedValue({ id: 'vehicle-1' });
    api.uploadAttachments.mockResolvedValue([]);
  });

  it('saves a confirmed record in category other, as decided on #116', async () => {
    const result = renderQuickLog();

    await act(() => result.current.mutateAsync(log()));

    expect(api.createMaintenanceRecord).toHaveBeenCalledWith('vehicle-1', {
      category: 'other',
      status: 'confirmed',
      serviceDate: '2026-09-20T00:00:00.000Z',
      odometer: 42500,
      totalCost: 3200,
    });
  });

  it('raises the vehicle’s odometer when the reading is higher', async () => {
    const result = renderQuickLog();

    await act(() => result.current.mutateAsync(log({ odometer: 42500 })));

    expect(api.updateVehicleOdometer).toHaveBeenCalledWith('vehicle-1', 42500);
  });

  it('never winds the odometer back for a back-dated log', async () => {
    const result = renderQuickLog();

    await act(() => result.current.mutateAsync(log({ odometer: 39000 })));
    await act(() => result.current.mutateAsync(log({ odometer: 42000 })));

    expect(api.createMaintenanceRecord).toHaveBeenCalledTimes(2);
    expect(api.updateVehicleOdometer).not.toHaveBeenCalled();
  });

  it('attaches the photo to the record, and extracts nothing from it', async () => {
    const result = renderQuickLog();
    const photo = new File(['job card'], 'job-card.jpg', { type: 'image/jpeg' });

    await act(() => result.current.mutateAsync(log({ photo })));

    expect(api.uploadAttachments).toHaveBeenCalledWith('record-1', [photo]);
  });

  it('keeps the record when the odometer or the photo fails, and says so', async () => {
    api.updateVehicleOdometer.mockRejectedValue(new Error('network'));
    api.uploadAttachments.mockRejectedValue(new Error('too large'));
    const result = renderQuickLog();
    const photo = new File(['job card'], 'job-card.jpg', { type: 'image/jpeg' });

    const outcome = await act(() => result.current.mutateAsync(log({ photo })));

    expect(outcome).toEqual({
      record: { id: 'record-1' },
      odometerFailed: true,
      photoFailed: true,
    });
  });

  it('fails as a whole when the record itself is refused', async () => {
    api.createMaintenanceRecord.mockRejectedValue(new Error('refused'));
    const result = renderQuickLog();

    await expect(act(() => result.current.mutateAsync(log()))).rejects.toThrow('refused');
    expect(api.updateVehicleOdometer).not.toHaveBeenCalled();
    expect(api.uploadAttachments).not.toHaveBeenCalled();
  });
});

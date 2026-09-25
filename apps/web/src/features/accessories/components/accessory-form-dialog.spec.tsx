import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Accessory } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmHost } from '@/components/shared/confirm';

const hooks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('../hooks/use-accessories', () => ({
  useCreateAccessory: () => ({ mutateAsync: hooks.create, isPending: false }),
  useUpdateAccessory: () => ({ mutateAsync: hooks.update, isPending: false }),
  useDeleteAccessory: () => ({ mutateAsync: hooks.remove, isPending: false }),
  useUploadAccessoryReceipt: () => ({ mutateAsync: hooks.upload, isPending: false }),
}));
vi.mock('@/lib/toast', () => ({ appToast: { success: vi.fn(), error: vi.fn() } }));

import { appToast } from '@/lib/toast';
import { AccessoryFormDialog } from './accessory-form-dialog';

const dashcam = {
  id: 'acc-1',
  vehicleId: 'vehicle-1',
  name: 'Dashcam',
  brand: 'Croma',
  category: null,
  purchaseDate: '2026-03-12T00:00:00.000Z',
  cost: 6499,
  currencyCode: 'INR',
  fittedDate: null,
  fittedOdometer: null,
  removedDate: null,
  removedOdometer: null,
  warrantyExpiresAt: null,
  notes: null,
  createdAt: '2026-03-12T00:00:00.000Z',
  updatedAt: '2026-03-12T00:00:00.000Z',
} as unknown as Accessory;

beforeEach(() => {
  vi.clearAllMocks();
  hooks.create.mockResolvedValue(dashcam);
  hooks.update.mockResolvedValue(dashcam);
  hooks.upload.mockResolvedValue([]);
  hooks.remove.mockResolvedValue({ id: 'acc-1' });
});

describe('AccessoryFormDialog', () => {
  it('attaches the receipt to the accessory once it is saved', async () => {
    const onClose = vi.fn();
    render(<AccessoryFormDialog isOpen onClose={onClose} vehicleId="vehicle-1" />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dashcam' } });
    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: '6499' } });
    const receipt = new File(['%PDF'], 'receipt.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Receipt'), { target: { files: [receipt] } });
    fireEvent.click(screen.getByRole('button', { name: 'Add accessory' }));

    await waitFor(() =>
      expect(hooks.upload).toHaveBeenCalledWith({ accessoryId: 'acc-1', file: receipt }),
    );
    expect(hooks.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Dashcam', cost: 6499 }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the accessory and says so when only the receipt fails', async () => {
    hooks.upload.mockRejectedValueOnce(new Error('storage down'));
    render(<AccessoryFormDialog isOpen onClose={vi.fn()} vehicleId="vehicle-1" />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dashcam' } });
    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: '6499' } });
    fireEvent.change(screen.getByLabelText('Receipt'), {
      target: { files: [new File(['%PDF'], 'r.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add accessory' }));

    await waitFor(() =>
      expect(appToast.error).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Dashcam saved, but the receipt didn't upload" }),
      ),
    );
  });

  it('deletes while editing, once confirmed, and only where allowed', async () => {
    const { rerender } = render(
      <>
        <AccessoryFormDialog
          editingAccessory={dashcam}
          isOpen
          onClose={vi.fn()}
          vehicleId="vehicle-1"
        />
        <ConfirmHost />
      </>,
    );
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    rerender(
      <>
        <AccessoryFormDialog
          canDelete
          editingAccessory={dashcam}
          isOpen
          onClose={vi.fn()}
          vehicleId="vehicle-1"
        />
        <ConfirmHost />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete', hidden: false }));

    await waitFor(() => expect(hooks.remove).toHaveBeenCalledWith('acc-1'));
  });
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  AttachmentExtractionStatus,
  AttachmentKind,
  MaintenanceCategory,
  MaintenanceLineItemKind,
  MaintenanceRecordStatus,
  type Attachment,
  type MaintenanceFillPlan,
  type MaintenanceRecord,
} from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appToast } from '@/lib/toast';

const reading = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const planQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const useFillPlan = vi.hoisted(() => vi.fn());
const fillMutateAsync = vi.hoisted(() => vi.fn());
const readMutate = vi.hoisted(() => vi.fn());

vi.mock('../hooks/use-extract-attachment', () => ({
  useExtractAttachment: () => ({ mutate: readMutate, ...reading.current }),
}));
vi.mock('../hooks/use-fill-plan', () => ({ useFillPlan }));
vi.mock('../hooks/use-fill-from-attachment', () => ({
  useFillFromAttachment: () => ({ mutateAsync: fillMutateAsync, isPending: false }),
}));
vi.mock('@/lib/toast', () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { FillFromPhotoDialog } from './fill-from-photo-dialog';

const quickLog: MaintenanceRecord = {
  id: 'record-1',
  vehicleId: 'vehicle-1',
  category: MaintenanceCategory.Other,
  serviceDate: '2026-09-20T00:00:00.000Z',
  odometer: 15_200,
  currencyCode: 'INR',
  status: MaintenanceRecordStatus.Confirmed,
  totalCost: 1_500,
  createdAt: '2026-09-20T10:00:00.000Z',
  updatedAt: '2026-09-20T10:00:00.000Z',
};

const jobCardPhoto: Attachment = {
  id: 'attachment-1',
  maintenanceRecordId: 'record-1',
  fileName: 'record-1/job-card.jpg',
  originalFileName: 'job-card.jpg',
  url: '/api/attachments/attachment-1/file',
  mimeType: 'image/jpeg',
  size: 4_096,
  kind: AttachmentKind.Image,
  uploadedAt: '2026-09-20T10:00:00.000Z',
};

const alreadyRead: Attachment = {
  ...jobCardPhoto,
  extraction: {
    id: 'extraction-1',
    attachmentId: 'attachment-1',
    status: AttachmentExtractionStatus.Completed,
    createdAt: '2026-09-20T10:05:00.000Z',
    updatedAt: '2026-09-20T10:05:00.000Z',
  },
};

const plan: MaintenanceFillPlan = {
  fields: ['category', 'workshopName', 'lineItems', 'nextDueOdometer'],
  changes: {
    category: MaintenanceCategory.EngineOil,
    workshopName: 'Torque Garage',
    lineItems: [
      { kind: MaintenanceLineItemKind.Fluid, name: 'Engine oil', lineTotal: 1_100, position: 0 },
      { kind: MaintenanceLineItemKind.Labor, name: 'Labour', lineTotal: 400, position: 1 },
    ],
    nextDueOdometer: 18_200,
  },
};

function open(attachment: Attachment = alreadyRead) {
  const onClose = vi.fn();
  render(<FillFromPhotoDialog attachment={attachment} onClose={onClose} record={quickLog} />);
  return { onClose, dialog: screen.getByRole('dialog', { name: 'Fill in from the photo' }) };
}

describe('FillFromPhotoDialog', () => {
  beforeEach(() => {
    reading.current = { isPending: false, isError: false, isSuccess: false };
    planQuery.current = { data: plan, isPending: false, isError: false };
    useFillPlan.mockImplementation(() => planQuery.current);
    fillMutateAsync.mockResolvedValue({
      record: { ...quickLog, category: MaintenanceCategory.EngineOil },
      filledFields: plan.fields,
    });
  });

  it('reads a photo nobody has read yet, because opening this asked it to', () => {
    reading.current = { isPending: true, isError: false, isSuccess: false };
    const { dialog } = open(jobCardPhoto);

    expect(readMutate).toHaveBeenCalledTimes(1);
    expect(readMutate).toHaveBeenCalledWith('attachment-1');
    expect(within(dialog).getByText('Reading the photo…')).toBeInTheDocument();
    // Nothing to fill in from until the read is done.
    expect(useFillPlan).toHaveBeenLastCalledWith('attachment-1', { enabled: false });
    expect(within(dialog).getByRole('button', { name: 'Fill in' })).toBeDisabled();
  });

  it('does not read a photo again unasked, but will when asked', () => {
    const { dialog } = open();

    expect(readMutate).not.toHaveBeenCalled();
    expect(useFillPlan).toHaveBeenLastCalledWith('attachment-1', { enabled: true });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Read the photo again' }));
    expect(readMutate).toHaveBeenCalledWith('attachment-1');
  });

  it('lists only what the record is missing, and says the date, odometer and cost stay', () => {
    const { dialog } = open();

    expect(
      within(dialog).getByText(
        'Only what this record is missing. The date, odometer and cost stay as you logged them.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Engine oil')).toBeInTheDocument();
    expect(within(dialog).getByText('Torque Garage')).toBeInTheDocument();
    expect(within(dialog).getByText(/2 items, adding up to ₹1,500/)).toBeInTheDocument();
    expect(within(dialog).getByText('Engine oil, Labour')).toBeInTheDocument();
    expect(within(dialog).getByText('18,200 km')).toBeInTheDocument();
    expect(within(dialog).queryByText('Service date')).not.toBeInTheDocument();
  });

  it('fills in once agreed, and says what it added', async () => {
    const { dialog, onClose } = open();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Fill in' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fillMutateAsync).toHaveBeenCalledWith('attachment-1');
    expect(appToast.success).toHaveBeenCalledWith({
      title: 'Filled in from the photo',
      description: 'Added the category, the workshop, line items and the next due odometer.',
    });
  });

  it('keeps the dialog open and says why when the fill is refused', async () => {
    fillMutateAsync.mockRejectedValue(new Error('This action requires the editor role.'));
    const { dialog, onClose } = open();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Fill in' }));

    await waitFor(() =>
      expect(appToast.error).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't fill in the record" }),
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('explains the line items it leaves out', () => {
    planQuery.current = {
      data: {
        fields: ['workshopName'],
        changes: { workshopName: 'Torque Garage' },
        lineItemsLeftOut: { count: 5, total: 1_480 },
      },
      isPending: false,
      isError: false,
    };
    const { dialog } = open();

    expect(
      within(dialog).getByText(/they come to ₹1,480, and this record's\s+cost is ₹1,500/),
    ).toBeInTheDocument();
  });

  it('has nothing to fill in when the record already has it all', () => {
    planQuery.current = { data: { fields: [], changes: {} }, isPending: false, isError: false };
    const { dialog } = open();

    expect(
      within(dialog).getByText(
        'Nothing to add. This record already has everything the photo shows.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Fill in' })).toBeDisabled();
  });

  it('offers to try again when the photo could not be read', () => {
    reading.current = {
      isPending: false,
      isError: true,
      isSuccess: false,
      error: new Error('DocumentExtraction provider is not configured.'),
    };
    const { dialog } = open(jobCardPhoto);
    readMutate.mockClear();

    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'DocumentExtraction provider is not configured.',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(readMutate).toHaveBeenCalledWith('attachment-1');
  });

  it('names a PDF for what it is', () => {
    render(
      <FillFromPhotoDialog
        attachment={{ ...alreadyRead, mimeType: 'application/pdf', originalFileName: 'bill.pdf' }}
        onClose={vi.fn()}
        record={quickLog}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Fill in from the PDF' })).toBeInTheDocument();
  });
});

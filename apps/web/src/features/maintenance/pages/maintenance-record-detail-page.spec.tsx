import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  AttachmentKind,
  MaintenanceCategory,
  MaintenanceRecordStatus,
  VehicleRole,
  type Attachment,
  type MaintenanceRecord,
} from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

const vehicleQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const attachmentsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const extractionStatusQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const record = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const mutation = vi.hoisted(() => () => ({ mutateAsync: vi.fn(), isPending: false }));
const readFile = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { params?: Record<string, string>; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock('../hooks/use-maintenance-record', () => ({ useMaintenanceRecord: () => record.current }));
vi.mock('../hooks/use-delete-maintenance-record', () => ({ useDeleteMaintenanceRecord: mutation }));
vi.mock('@/features/vehicles/hooks/use-vehicle', () => ({
  useVehicle: () => vehicleQuery.current,
}));
// Read-only, and it carries no controls of its own.
vi.mock('../components/maintenance-summary-card', () => ({ MaintenanceSummaryCard: () => null }));
// AttachmentsSection stays real: it reads the role from the page's provider.
vi.mock('@/features/attachments/hooks/use-attachments', () => ({
  useAttachments: () => attachmentsQuery.current,
}));
vi.mock('@/features/attachments/hooks/use-upload-attachments', () => ({
  useUploadAttachments: mutation,
}));
vi.mock('@/features/attachments/hooks/use-delete-attachment', () => ({
  useDeleteAttachment: mutation,
}));
vi.mock('@/features/attachments/hooks/use-attachment-extraction-status', () => ({
  useAttachmentExtractionStatus: () => extractionStatusQuery.current,
}));
vi.mock('@/features/attachments/hooks/use-extract-attachment', () => ({
  useExtractAttachment: () => ({ mutate: readFile.mutate, isPending: true }),
}));
vi.mock('@/features/attachments/hooks/use-fill-plan', () => ({
  useFillPlan: () => ({ isPending: true }),
}));
vi.mock('@/features/attachments/hooks/use-fill-from-attachment', () => ({
  useFillFromAttachment: mutation,
}));

import { MaintenanceRecordDetailPage } from './maintenance-record-detail-page';

const maintenanceRecord: MaintenanceRecord = {
  id: 'record-1',
  vehicleId: 'vehicle-1',
  serviceDate: '2026-03-21T00:00:00.000Z',
  odometer: 12_000,
  category: MaintenanceCategory.EngineOil,
  workshopName: 'Torque Garage',
  totalCost: 3_200,
  createdAt: '2026-03-21T00:00:00.000Z',
  updatedAt: '2026-03-21T00:00:00.000Z',
};

const attachment: Attachment = {
  id: 'attachment-1',
  maintenanceRecordId: 'record-1',
  fileName: 'record-1/invoice.pdf',
  originalFileName: 'invoice.pdf',
  url: 'https://files.test/invoice.pdf',
  mimeType: 'application/pdf',
  size: 2_048,
  kind: AttachmentKind.Receipt,
  uploadedAt: '2026-03-21T00:00:00.000Z',
};

/** The job card photographed at the counter, as the dashboard's quick log attaches it. */
const jobCardPhoto: Attachment = {
  id: 'attachment-2',
  maintenanceRecordId: 'record-1',
  fileName: 'record-1/job-card.jpg',
  originalFileName: 'job-card.jpg',
  url: 'https://files.test/job-card.jpg',
  mimeType: 'image/jpeg',
  size: 4_096,
  kind: AttachmentKind.Image,
  uploadedAt: '2026-03-22T00:00:00.000Z',
};

function renderAs(
  role: VehicleRole,
  {
    attachments = [attachment],
    extractionAvailable = false,
    status = MaintenanceRecordStatus.Confirmed,
  }: {
    attachments?: Attachment[];
    extractionAvailable?: boolean;
    status?: MaintenanceRecordStatus;
  } = {},
) {
  record.current = { data: { ...maintenanceRecord, status }, isPending: false, isError: false };
  vehicleQuery.current = { data: { id: 'vehicle-1', currentUserRole: role } };
  attachmentsQuery.current = { data: attachments, isPending: false, isError: false };
  extractionStatusQuery.current = { data: { available: extractionAvailable } };

  return render(<MaintenanceRecordDetailPage recordId="record-1" />);
}

describe('MaintenanceRecordDetailPage roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])(
    'lets an %s edit and delete the record',
    (role) => {
      renderAs(role);

      expect(screen.getByRole('link', { name: 'Edit Record' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Record' })).toBeInTheDocument();
    },
  );

  it.each([VehicleRole.Owner, VehicleRole.Editor])(
    'lets an %s upload and delete a receipt',
    (role) => {
      renderAs(role);

      expect(screen.getByRole('button', { name: 'Upload Files' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    },
  );

  it('shows a viewer the record without any way to change it', () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.queryByRole('link', { name: 'Edit Record' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Record' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Maintenance History' })).toBeInTheDocument();
  });

  it('leaves a viewer the receipts to open but not to change', () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View file' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Upload Files' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});

describe('MaintenanceRecordDetailPage drafts', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])(
    'tells an %s a draft counts nowhere yet and sends them to confirm it',
    (role) => {
      renderAs(role, { status: MaintenanceRecordStatus.Draft });

      const notice = screen.getByRole('region', { name: 'Nobody has confirmed this record yet' });
      expect(within(notice).getByText('Draft')).toBeInTheDocument();
      expect(
        within(notice).getByText(
          'It is not counted in costs, reports or reminders until it is. Check what was read, then confirm it.',
        ),
      ).toBeInTheDocument();
      expect(within(notice).getByRole('link', { name: 'Review and confirm' })).toHaveAttribute(
        'href',
        '/maintenance-records/$recordId/edit',
      );
    },
  );

  it('tells a viewer who can confirm it, without offering to', () => {
    renderAs(VehicleRole.Viewer, { status: MaintenanceRecordStatus.Draft });

    const notice = screen.getByRole('region', { name: 'Nobody has confirmed this record yet' });
    expect(
      within(notice).getByText(
        'It is not counted in costs, reports or reminders until an owner or editor of this vehicle confirms it.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review and confirm' })).not.toBeInTheDocument();
  });

  it('says nothing of the kind on a confirmed record', () => {
    renderAs(VehicleRole.Owner);

    expect(
      screen.queryByRole('region', { name: 'Nobody has confirmed this record yet' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review and confirm' })).not.toBeInTheDocument();
  });
});

describe('MaintenanceRecordDetailPage filling in from a photo', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])(
    'offers an %s to fill a confirmed record in from its job card photo',
    (role) => {
      renderAs(role, { attachments: [jobCardPhoto], extractionAvailable: true });

      expect(screen.getByRole('button', { name: 'Fill in from photo' })).toBeInTheDocument();
    },
  );

  it('offers it for a PDF bill as well, named for what it is', () => {
    renderAs(VehicleRole.Owner, { attachments: [attachment], extractionAvailable: true });

    expect(screen.getByRole('button', { name: 'Fill in from PDF' })).toBeInTheDocument();
  });

  it('reads the photo only once asked to', () => {
    renderAs(VehicleRole.Owner, { attachments: [jobCardPhoto], extractionAvailable: true });
    expect(readFile.mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Fill in from photo' }));

    expect(screen.getByRole('dialog', { name: 'Fill in from the photo' })).toBeInTheDocument();
    expect(readFile.mutate).toHaveBeenCalledWith('attachment-2');
  });

  it('does not offer it to a viewer', () => {
    renderAs(VehicleRole.Viewer, { attachments: [jobCardPhoto], extractionAvailable: true });

    expect(screen.getByText('job-card.jpg')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fill in from photo' })).not.toBeInTheDocument();
  });

  it('does not offer it while extraction is not configured on the API', () => {
    renderAs(VehicleRole.Owner, { attachments: [jobCardPhoto], extractionAvailable: false });

    expect(screen.getByText('job-card.jpg')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fill in from photo' })).not.toBeInTheDocument();
  });

  it('does not offer it on a draft, which takes the whole extraction on its edit page', () => {
    renderAs(VehicleRole.Owner, {
      attachments: [jobCardPhoto],
      extractionAvailable: true,
      status: MaintenanceRecordStatus.Draft,
    });

    expect(screen.queryByRole('button', { name: 'Fill in from photo' })).not.toBeInTheDocument();
  });
});

function renderErrored(error: unknown) {
  const refetch = vi.fn();
  record.current = { isPending: false, isError: true, error, refetch };
  vehicleQuery.current = {};

  render(<MaintenanceRecordDetailPage recordId="record-1" />);

  return { refetch };
}

describe('MaintenanceRecordDetailPage errors', () => {
  it('tells a malformed or unknown record id apart from a real failure', () => {
    renderErrored(new ApiError('Maintenance record not found', 404));

    expect(screen.getByText("This record isn't in your garage.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Your vehicles' })).toHaveAttribute(
      'href',
      '/vehicles',
    );
  });

  it('tells a viewer whose access was removed why, not just that it failed', () => {
    renderErrored(new ApiError('Forbidden', 403));

    expect(
      screen.getByText('You no longer have access — the owner may have removed you.'),
    ).toBeInTheDocument();
  });

  it('offers a working Try again that refetches on a network/5xx failure', () => {
    const { refetch } = renderErrored(new ApiError('Internal error', 500));

    expect(screen.getByText("We couldn't load this record.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

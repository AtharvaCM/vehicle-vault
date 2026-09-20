import { render, screen } from '@testing-library/react';
import {
  AttachmentKind,
  MaintenanceCategory,
  VehicleRole,
  type Attachment,
  type MaintenanceRecord,
} from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

const vehicleQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const attachmentsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const record = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const mutation = vi.hoisted(() => () => ({ mutateAsync: vi.fn(), isPending: false }));

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

function renderAs(role: VehicleRole) {
  record.current = { data: maintenanceRecord, isPending: false, isError: false };
  vehicleQuery.current = { data: { id: 'vehicle-1', currentUserRole: role } };
  attachmentsQuery.current = { data: [attachment], isPending: false, isError: false };

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

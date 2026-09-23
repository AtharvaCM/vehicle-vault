import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MaintenanceCategory,
  MaintenanceRecordStatus,
  MaintenanceSource,
  VehicleRole,
  type MaintenanceRecord,
} from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appToast } from '@/lib/toast';

const vehicleQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const recordQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const updateRecord = vi.hoisted(() => vi.fn());
const attachmentsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

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

vi.mock('../hooks/use-maintenance-record', () => ({
  useMaintenanceRecord: () => recordQuery.current,
}));
vi.mock('../hooks/use-update-maintenance-record', () => ({
  useUpdateMaintenanceRecord: () => ({ mutateAsync: updateRecord, isPending: false, error: null }),
}));
vi.mock('@/features/vehicles/hooks/use-vehicle', () => ({
  useVehicle: () => vehicleQuery.current,
}));
// Pulls in the router module, which the router mock above does not build.
vi.mock('@/hooks/use-unsaved-changes-guard', () => ({
  useUnsavedChangesGuard: () => ({ allowNextNavigation: () => () => undefined }),
}));
vi.mock('@/lib/toast', () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/features/attachments/hooks/use-attachments', () => ({
  useAttachments: () => attachmentsQuery.current,
}));
vi.mock('@/features/attachments/hooks/use-attachment-extraction-status', () => ({
  useAttachmentExtractionStatus: () => ({ data: { available: true } }),
}));
// Stands in for the real form: its button carries whatever label the page chose,
// pressing it submits the body the form would have built, and it lists the
// fields the page marked as read from the bill.
vi.mock('../components/maintenance-form', () => ({
  MaintenanceForm: ({
    fieldsFromBill,
    onSubmit,
    submitLabel,
  }: {
    fieldsFromBill?: ReadonlySet<string>;
    onSubmit: (values: Record<string, unknown>) => void;
    submitLabel: string;
  }) => (
    <>
      <button onClick={() => onSubmit({ ...formBody })} type="button">
        {submitLabel}
      </button>
      <p>from bill: {[...(fieldsFromBill ?? [])].sort().join(', ') || 'none'}</p>
    </>
  ),
}));
vi.mock('../components/draft-bill-summary', () => ({
  DraftBillSummary: ({ fieldsFromBillCount }: { fieldsFromBillCount: number }) => (
    <p>bill summary: {fieldsFromBillCount}</p>
  ),
}));
// Cards that fetch their own data; a viewer never reaches them here.
vi.mock('../components/maintenance-draft-review-card', () => ({
  MaintenanceDraftReviewCard: () => null,
}));
vi.mock('@/features/claims/components/maintenance-claim-link-card', () => ({
  MaintenanceClaimLinkCard: () => null,
}));
vi.mock('@/features/attachments/components/attachments-section', () => ({
  AttachmentsSection: () => null,
}));

import { MaintenanceRecordEditPage } from './maintenance-record-edit-page';

const formBody = {
  serviceDate: '2026-03-21T00:00:00.000Z',
  odometer: 12_000,
  category: MaintenanceCategory.EngineOil,
  currencyCode: 'INR',
  totalCost: 3_200,
  nextDueOdometer: 22_000,
};

const record: MaintenanceRecord = {
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

const draft: MaintenanceRecord = {
  ...record,
  source: MaintenanceSource.Ocr,
  status: MaintenanceRecordStatus.Draft,
};

function renderAs(
  role: VehicleRole,
  data: MaintenanceRecord = record,
  attachments: unknown[] = [],
) {
  recordQuery.current = { data, isPending: false, isError: false };
  attachmentsQuery.current = { data: attachments };
  vehicleQuery.current = { data: { id: 'vehicle-1', currentUserRole: role } };

  return render(<MaintenanceRecordEditPage recordId="record-1" />);
}

beforeEach(() => {
  vi.clearAllMocks();
  updateRecord.mockResolvedValue(record);
});

describe('MaintenanceRecordEditPage roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])('gives an %s the form', (role) => {
    renderAs(role);

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.queryByText('You have view-only access')).not.toBeInTheDocument();
  });

  it('replaces the form with an explanation for a viewer', () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.getByText('You have view-only access')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to record' })).toBeInTheDocument();
  });

  it('offers a viewer no way to confirm a draft either', () => {
    renderAs(VehicleRole.Viewer, draft);

    expect(screen.queryByRole('button', { name: 'Confirm record' })).not.toBeInTheDocument();
    expect(screen.getByText('You have view-only access')).toBeInTheDocument();
  });
});

describe('MaintenanceRecordEditPage draft confirmation', () => {
  it('asks an editor to confirm a draft rather than save it', () => {
    renderAs(VehicleRole.Editor, draft);

    expect(screen.getByRole('button', { name: 'Confirm record' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'This draft does not count anywhere yet. Check the details, then confirm it.',
      ),
    ).toBeInTheDocument();
  });

  it('confirms the draft with the edited details in one save', async () => {
    renderAs(VehicleRole.Editor, draft);

    await userEvent.click(screen.getByRole('button', { name: 'Confirm record' }));

    expect(updateRecord).toHaveBeenCalledWith({
      ...formBody,
      status: MaintenanceRecordStatus.Confirmed,
    });
    expect(appToast.success).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Service record confirmed' }),
    );
  });

  it('leaves the status of an already confirmed record alone', async () => {
    renderAs(VehicleRole.Editor);

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateRecord).toHaveBeenCalledWith(formBody);
    expect(appToast.success).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Service record updated' }),
    );
  });
});

describe('MaintenanceRecordEditPage filled from the bill', () => {
  const extraction = {
    id: 'extraction-1',
    attachmentId: 'attachment-1',
    status: 'completed',
    workshopName: 'Torque Garage',
    odometer: 12_000,
    totalCost: 9_999,
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  };
  const bill = {
    id: 'attachment-1',
    maintenanceRecordId: 'record-1',
    kind: 'receipt',
    fileName: 'bill.png',
    originalFileName: 'bill.png',
    mimeType: 'image/png',
    size: 10,
    url: '/bill.png',
    uploadedAt: '2026-03-21T00:00:00.000Z',
    extraction,
  };

  it('marks the draft fields that still hold what the bill says', () => {
    // The total was changed and saved since, so it is no longer "from bill".
    renderAs(VehicleRole.Editor, draft, [bill]);

    expect(screen.getByText('from bill: odometer, workshopName')).toBeInTheDocument();
    expect(screen.getByText('bill summary: 2')).toBeInTheDocument();
  });

  it('marks nothing on a confirmed record, and shows no bill summary', () => {
    renderAs(VehicleRole.Editor, record, [bill]);

    expect(screen.getByText('from bill: none')).toBeInTheDocument();
    expect(screen.queryByText(/bill summary/)).not.toBeInTheDocument();
  });
});

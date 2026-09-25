import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReminderStatus, ReminderType, VehicleRole } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/query-keys';
import { appToast } from '@/lib/toast';

const vehicleQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const createRecord = vi.hoisted(() => vi.fn());
const mutation = vi.hoisted(() => () => ({
  mutateAsync: createRecord,
  isPending: false,
  error: null,
}));
const navigate = vi.hoisted(() => vi.fn());
const createDraft = vi.hoisted(() => vi.fn());
const attachmentsApi = vi.hoisted(() => ({
  upload: vi.fn(),
  extract: vi.fn(),
  extractBatch: vi.fn(),
  apply: vi.fn(),
}));

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
  useNavigate: () => navigate,
}));

vi.mock('@/features/vehicles/hooks/use-vehicle', () => ({
  useVehicle: () => vehicleQuery.current,
}));
vi.mock('../hooks/use-create-maintenance-record', () => ({ useCreateMaintenanceRecord: mutation }));
vi.mock('../hooks/use-create-maintenance-draft', () => ({
  useCreateMaintenanceDraft: () => ({ mutateAsync: createDraft, isPending: false, error: null }),
}));
vi.mock('@/features/attachments/api/upload-attachments', () => ({
  uploadAttachments: attachmentsApi.upload,
}));
vi.mock('@/features/attachments/api/extract-attachment', () => ({
  extractAttachment: attachmentsApi.extract,
}));
vi.mock('@/features/attachments/api/extract-attachments', () => ({
  extractAttachments: attachmentsApi.extractBatch,
}));
vi.mock('@/features/attachments/api/apply-attachment-extraction', () => ({
  applyAttachmentExtraction: attachmentsApi.apply,
}));
vi.mock('@/lib/toast', () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/features/attachments/hooks/use-attachment-extraction-status', () => ({
  useAttachmentExtractionStatus: () => ({ data: { available: true } }),
}));
// Pulls in the router module, which the router mock above does not build.
vi.mock('@/hooks/use-unsaved-changes-guard', () => ({
  useUnsavedChangesGuard: () => ({ allowNextNavigation: () => () => undefined }),
}));
vi.mock('../components/maintenance-form', () => ({
  MaintenanceForm: ({
    leading,
    onSubmit,
    suggestedCategory,
    scheduleNextDue,
  }: {
    leading?: ReactNode;
    onSubmit: (values: Record<string, unknown>) => Promise<void>;
    suggestedCategory?: { category: string; reason: string } | null;
    scheduleNextDue?: boolean;
  }) => (
    <div>
      {leading}
      <div>maintenance form</div>
      <p>
        starts on: {suggestedCategory ? suggestedCategory.category : 'default'}
        {suggestedCategory?.reason ? ` (${suggestedCategory.reason})` : ''}
      </p>
      {scheduleNextDue ? <p>next due from the schedule</p> : null}
      <button
        onClick={() => void onSubmit({ category: 'chain_service' }).catch(() => undefined)}
        type="button"
      >
        save
      </button>
    </div>
  ),
}));

import { VehicleMaintenanceCreatePage } from './vehicle-maintenance-create-page';

const reminderId = '6f1c2b8e-3d4a-4b5c-9d6e-7f8091a2b3c4';
const today = new Date().toISOString();

const oilDueToday = {
  id: 'reminder-due',
  vehicleId: 'vehicle-1',
  title: 'Engine oil due',
  type: ReminderType.Service,
  status: ReminderStatus.DueToday,
  dueDate: today,
  createdAt: today,
  updatedAt: today,
};

type RenderOptions = { category?: 'engine_oil' | 'battery'; reminderId?: string };

function renderAs(role: VehicleRole, options: RenderOptions = {}) {
  vehicleQuery.current = {
    data: {
      id: 'vehicle-1',
      make: 'Bajaj',
      model: 'Pulsar NS 200',
      registrationNumber: 'MH12DM0002',
      currentUserRole: role,
    },
    isError: false,
  };

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(queryKeys.reminders.byVehicle('vehicle-1'), [oilDueToday]);
  client.setQueryData(queryKeys.reminders.detail(reminderId), {
    ...oilDueToday,
    id: reminderId,
    title: 'Chain clean & lube',
    catalogSlug: 'chain_lube',
    status: ReminderStatus.Upcoming,
  });

  return render(
    <QueryClientProvider client={client}>
      <VehicleMaintenanceCreatePage
        category={options.category as never}
        reminderId={options.reminderId}
        vehicleId="vehicle-1"
      />
    </QueryClientProvider>,
  );
}

describe('VehicleMaintenanceCreatePage roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])('gives an %s the form', (role) => {
    renderAs(role);

    expect(screen.getByRole('heading', { level: 1, name: 'Log service' })).toBeInTheDocument();
    expect(screen.getByText('maintenance form')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Snap the bill' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeInTheDocument();
    expect(screen.queryByText('You have view-only access')).not.toBeInTheDocument();
  });

  it('replaces the form with an explanation for a viewer', () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.queryByText('maintenance form')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Snap the bill' })).not.toBeInTheDocument();
    expect(screen.getByText('You have view-only access')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to History' })).toBeInTheDocument();
  });
});

describe('VehicleMaintenanceCreatePage starting category', () => {
  it('starts on the service that is due, saying why, and works the next due out', () => {
    renderAs(VehicleRole.Owner);

    expect(
      screen.getByText('starts on: engine_oil (Picked because the oil change is due today.)'),
    ).toBeInTheDocument();
    expect(screen.getByText('next due from the schedule')).toBeInTheDocument();
  });

  it('takes ?category= over what is due', () => {
    renderAs(VehicleRole.Owner, { category: 'battery' });

    expect(screen.getByText('starts on: battery')).toBeInTheDocument();
  });

  it('names the reminder from ?reminderId=, on its own work', () => {
    renderAs(VehicleRole.Owner, { reminderId });

    expect(
      screen.getByText('starts on: chain_service (For your reminder “Chain clean & lube”.)'),
    ).toBeInTheDocument();
  });

  it('lets ?category= choose the work for a reminder', () => {
    renderAs(VehicleRole.Owner, { reminderId, category: 'engine_oil' });

    expect(
      screen.getByText('starts on: engine_oil (For your reminder “Chain clean & lube”.)'),
    ).toBeInTheDocument();
  });
});

describe('VehicleMaintenanceCreatePage saving', () => {
  beforeEach(() => {
    createRecord.mockReset().mockResolvedValue({ id: 'record-1' });
  });

  it('sends the reminder it was logged for, so the API completes it', async () => {
    renderAs(VehicleRole.Owner, { reminderId });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(createRecord).toHaveBeenCalledWith({ category: 'chain_service', reminderId }),
    );
  });

  it('sends no reminder for a service logged on its own', async () => {
    renderAs(VehicleRole.Owner);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(createRecord).toHaveBeenCalledWith({ category: 'chain_service' }));
  });
});

describe('VehicleMaintenanceCreatePage upload-first', () => {
  const photo = new File(['bill'], 'bill.png', { type: 'image/png' });

  function uploadBill(files: File[] = [photo], input = 'bill-file-input') {
    renderAs(VehicleRole.Owner);
    fireEvent.change(screen.getByTestId(input), { target: { files } });
  }

  it('takes a photo from the camera or a file, image or PDF', () => {
    renderAs(VehicleRole.Owner);

    expect(screen.getByTestId('bill-camera-input')).toHaveAttribute('capture', 'environment');
    expect(screen.getByTestId('bill-file-input')).toHaveAttribute(
      'accept',
      expect.stringContaining('application/pdf'),
    );
  });

  it('opens a bill snapped from a reminder on a draft that completes it', async () => {
    attachmentsApi.extract.mockResolvedValue({ status: 'completed', odometer: 32_150 });
    renderAs(VehicleRole.Owner, { reminderId });
    fireEvent.change(screen.getByTestId('bill-file-input'), { target: { files: [photo] } });

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/maintenance-records/$recordId/edit',
        params: { recordId: 'draft-1' },
        search: { reminderId },
      }),
    );
  });

  it('starts the same draft from the camera', async () => {
    attachmentsApi.extract.mockResolvedValue({ status: 'completed', odometer: 32_150 });

    uploadBill([photo], 'bill-camera-input');
    await opensDraft();

    expect(attachmentsApi.upload).toHaveBeenCalledWith('draft-1', [photo]);
  });

  const opensDraft = () =>
    waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/maintenance-records/$recordId/edit',
        params: { recordId: 'draft-1' },
      }),
    );

  beforeEach(() => {
    createDraft.mockResolvedValue({ id: 'draft-1' });
    attachmentsApi.upload.mockResolvedValue([{ id: 'attachment-1' }]);
    attachmentsApi.apply.mockResolvedValue({ id: 'draft-1' });
  });

  it('fills the new draft from what the bill says before opening it', async () => {
    attachmentsApi.extract.mockResolvedValue({ status: 'completed', odometer: 32_150 });

    uploadBill();
    await opensDraft();

    expect(attachmentsApi.extract).toHaveBeenCalledWith('attachment-1');
    // Applied to the attachment on the draft just made, and only to it.
    expect(attachmentsApi.apply).toHaveBeenCalledTimes(1);
    expect(attachmentsApi.apply).toHaveBeenCalledWith('attachment-1');
    expect(attachmentsApi.apply.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0]!,
    );
  });

  it('reads several pages together and applies the merged result once', async () => {
    attachmentsApi.upload.mockResolvedValue([{ id: 'page-1' }, { id: 'page-2' }]);
    attachmentsApi.extractBatch.mockResolvedValue({ status: 'completed', totalCost: 1_520 });

    uploadBill([photo, new File(['page 2'], 'page-2.png', { type: 'image/png' })]);
    await opensDraft();

    expect(attachmentsApi.extractBatch).toHaveBeenCalledWith('draft-1', ['page-1', 'page-2']);
    expect(attachmentsApi.apply).toHaveBeenCalledWith('page-1');
  });

  it('opens the draft without applying when nothing could be read', async () => {
    attachmentsApi.extract.mockResolvedValue({ status: 'completed' });

    uploadBill();
    await opensDraft();

    expect(attachmentsApi.apply).not.toHaveBeenCalled();
  });

  it('opens the draft, and says so, when the bill could not be read', async () => {
    attachmentsApi.extract.mockRejectedValue(new Error('provider down'));

    uploadBill();
    await opensDraft();

    expect(attachmentsApi.apply).not.toHaveBeenCalled();
    expect(appToast.error).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Draft created, but the bill could not be read' }),
    );
  });
});

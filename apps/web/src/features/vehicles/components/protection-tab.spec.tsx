import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AttachmentKind,
  FuelType,
  VehicleRole,
  type Claim,
  type ClaimAttachment,
  type VehicleDocument,
} from '@vehicle-vault/shared';
import { addDays, addYears } from 'date-fns';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VehicleAccessProvider } from '../context/vehicle-access';
import { ProtectionTab } from './protection-tab';

const documentsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const claimsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

const mutation = vi.hoisted(() => () => ({ mutateAsync: vi.fn(), isPending: false }));
const createDocument = vi.hoisted(() => vi.fn());
const updateDocument = vi.hoisted(() => vi.fn());

// A document card links to its full-screen view.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    search: _search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: unknown;
    search?: unknown;
    to?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('../../vehicle-documents/hooks/use-documents', () => ({
  useVehicleDocuments: () => documentsQuery.current,
  useCreateVehicleDocument: () => ({ mutateAsync: createDocument, isPending: false }),
  useUpdateVehicleDocument: () => ({ mutateAsync: updateDocument, isPending: false }),
  useDeleteVehicleDocument: mutation,
}));
vi.mock('../../claims/hooks/use-claims', () => ({
  useVehicleClaims: () => claimsQuery.current,
  useCreateClaim: mutation,
  useUpdateClaim: mutation,
  useDeleteClaim: mutation,
}));
vi.mock('../../claims/hooks/use-claim-attachments', () => ({
  useClaimAttachments: () => ({ data: [receipt], isPending: false, isError: false }),
  useClaimExtractionStatus: () => ({ data: { available: true } }),
  useUploadClaimAttachments: mutation,
  useDeleteClaimAttachment: mutation,
  useExtractClaimAttachment: mutation,
}));
// A document's files have their own spec, viewer case included.
vi.mock('../../vehicle-documents/hooks/use-document-attachments', () => ({
  useDocumentAttachments: () => ({ data: [], isPending: false, isError: false }),
  useUploadDocumentAttachments: mutation,
  useDeleteDocumentAttachment: mutation,
}));
vi.mock('../../vehicle-documents/hooks/use-scan-document', () => ({
  useScanStatusQuery: () => ({ queryKey: ['scan-status'], queryFn: async () => null }),
  useScanVehicleDocument: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
// Partial mock: the component tree still imports queryOptions and friends.
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => ({ data: undefined, isPending: false }),
}));

describe('ProtectionTab', () => {
  it('surfaces a failed documents request instead of an empty garage', () => {
    documentsQuery.current = {
      isPending: false,
      isError: true,
      error: new Error('Internal server error'),
      refetch: vi.fn(),
    };
    claimsQuery.current = { isPending: false, isError: false, data: [] };

    render(<ProtectionTab fuelType={FuelType.Petrol} vehicleId="vehicle-1" />);

    expect(screen.getByText('Unable to load protection details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // The regression this guards: a 500 used to render as "you have no policies".
    expect(screen.queryByText('No insurance policies')).not.toBeInTheDocument();
  });

  it('offers a scan for every document kind, not just insurance', () => {
    documentsQuery.current = { isPending: false, isError: false, data: [], refetch: vi.fn() };
    claimsQuery.current = { isPending: false, isError: false, data: [] };

    render(<ProtectionTab fuelType={FuelType.Petrol} vehicleId="vehicle-1" />);

    expect(screen.getByRole('button', { name: /scan policy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan warranty/i })).toBeInTheDocument();
    // Compliance covers three kinds, so its scan is a menu rather than one button.
    expect(screen.getByRole('button', { name: 'Scan' })).toBeInTheDocument();
  });

  it('sends the document scan to the camera on a phone', () => {
    documentsQuery.current = { isPending: false, isError: false, data: [], refetch: vi.fn() };
    claimsQuery.current = { isPending: false, isError: false, data: [] };

    const { container } = render(
      <ProtectionTab fuelType={FuelType.Petrol} vehicleId="vehicle-1" />,
    );

    // A policy or PUC certificate is a physical thing being photographed, so
    // the input opens the camera rather than the file picker. Desktop browsers
    // ignore `capture` and still show a picker.
    const scanInput = container.querySelector('input[type="file"]');
    expect(scanInput).toHaveAttribute('capture', 'environment');
  });

  it('reports a failed claims request without hiding the documents that loaded', () => {
    documentsQuery.current = { isPending: false, isError: false, data: [], refetch: vi.fn() };
    claimsQuery.current = {
      isPending: false,
      isError: true,
      error: new Error('Internal server error'),
      refetch: vi.fn(),
    };

    render(<ProtectionTab fuelType={FuelType.Petrol} vehicleId="vehicle-1" />);

    expect(screen.getByText('Unable to load claims')).toBeInTheDocument();
    expect(screen.getByText('No insurance policies')).toBeInTheDocument();
    expect(screen.queryByText('No claims yet')).not.toBeInTheDocument();
  });

  it('does not ask an electric vehicle for a PUC certificate, which it is exempt from', async () => {
    const user = userEvent.setup();
    documentsQuery.current = { isPending: false, isError: false, data: [], refetch: vi.fn() };
    claimsQuery.current = { isPending: false, isError: false, data: [] };

    render(<ProtectionTab fuelType={FuelType.Electric} vehicleId="vehicle-1" />);

    expect(screen.queryByRole('button', { name: 'Add PUC certificate' })).not.toBeInTheDocument();
    expect(screen.getByText(/Track your RC and road tax/)).toBeInTheDocument();
    expect(screen.getByText(/Electric vehicles are exempt from PUC/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add registration certificate' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: 'Add Registration certificate' }),
    ).toBeInTheDocument();
  });
});

// Read at render time, after this module has finished initialising.
const receipt: ClaimAttachment = {
  id: 'attachment-1',
  claimId: 'claim-1',
  kind: AttachmentKind.Document,
  fileName: 'garage-bill.pdf',
  originalFileName: 'garage-bill.pdf',
  mimeType: 'application/pdf',
  size: 2048,
  url: '/claims/attachments/attachment-1',
  uploadedAt: '2026-08-02T00:00:00.000Z',
};

const policy: VehicleDocument = {
  id: 'policy-1',
  vehicleId: 'vehicle-1',
  kind: 'insurance',
  provider: 'Acme General',
  number: 'POL-1',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2030-01-01'),
  notes: null,
  details: {},
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const claim: Claim = {
  id: 'claim-1',
  insurancePolicyId: 'policy-1',
  maintenanceRecordId: null,
  claimNumber: 'CLM-7',
  grossAmount: 20_000,
  insurerPaidAmount: 15_000,
  status: 'settled',
  filedDate: new Date('2026-08-01'),
  settledDate: new Date('2026-08-20'),
  notes: null,
  createdAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-20'),
};

function renderAs(role: VehicleRole) {
  documentsQuery.current = { isPending: false, isError: false, data: [policy], refetch: vi.fn() };
  claimsQuery.current = { isPending: false, isError: false, data: [claim] };

  return render(
    <VehicleAccessProvider role={role}>
      <ProtectionTab fuelType={FuelType.Petrol} vehicleId="vehicle-1" />
    </VehicleAccessProvider>,
  );
}

const sectionActions = [
  'Add policy',
  'Scan policy',
  'Record claim',
  'Add warranty',
  'Add document',
];
// Empty-state prompts, shown here because this vehicle has no warranty or compliance papers.
const emptyStateActions = ['Add warranty details', 'Add PUC certificate'];

describe('ProtectionTab roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])('lets an %s add and change cover', (role) => {
    renderAs(role);

    for (const name of sectionActions) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Edit document' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete document' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit claim' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete claim' })).toBeInTheDocument();
    for (const name of emptyStateActions) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('shows a viewer the cover without any way to change it', () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.getByText('Acme General')).toBeInTheDocument();
    expect(screen.getByText('#CLM-7')).toBeInTheDocument();
    // Showing a document is reading it: the viewer may be the one at the checkpoint.
    expect(screen.getByRole('link', { name: 'Show Insurance policy full screen' })).toHaveAttribute(
      'href',
      '/vehicles/$vehicleId/documents/$kind/$documentId',
    );
    for (const name of [
      ...sectionActions,
      'Edit document',
      'Delete document',
      'Edit claim',
      'Delete claim',
      ...emptyStateActions,
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    // The compliance scan is a menu trigger named just "Scan".
    expect(screen.queryByRole('button', { name: 'Scan' })).not.toBeInTheDocument();
  });

  it('lets a viewer open a claim receipt but not upload, extract or delete one', async () => {
    const user = userEvent.setup();
    renderAs(VehicleRole.Viewer);

    await user.click(screen.getByRole('button', { name: /receipts & documents/i }));

    expect(screen.getByText('garage-bill.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download attachment' })).toBeInTheDocument();
    for (const name of ['Delete attachment', 'Extract claim fields', /upload receipts/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('keeps receipt management for an editor', async () => {
    const user = userEvent.setup();
    renderAs(VehicleRole.Editor);

    await user.click(screen.getByRole('button', { name: /receipts & documents/i }));

    for (const name of ['Delete attachment', 'Extract claim fields', /upload receipts/i]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });
});

describe('ProtectionTab renewal', () => {
  // Dates as the API sends them: midnight UTC, read back as a UTC calendar day.
  const dayInput = (date: Date) => date.toISOString().slice(0, 10);
  const now = new Date();
  // A policy running out in ten days: close enough to renew.
  const expiresOn = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 10),
  );
  const expiring: VehicleDocument = {
    ...policy,
    id: 'policy-expiring',
    number: 'POL-OLD',
    startDate: addDays(addYears(expiresOn, -1), 1),
    endDate: expiresOn,
    details: { premiumAmount: 14_500 },
  };

  function renderWith(documents: VehicleDocument[], role: VehicleRole = VehicleRole.Owner) {
    documentsQuery.current = {
      isPending: false,
      isError: false,
      data: documents,
      refetch: vi.fn(),
    };
    claimsQuery.current = { isPending: false, isError: false, data: [] };
    return render(
      <VehicleAccessProvider role={role}>
        <ProtectionTab fuelType={FuelType.Petrol} vehicleId="vehicle-1" />
      </VehicleAccessProvider>,
    );
  }

  beforeEach(() => {
    createDocument.mockReset().mockResolvedValue(undefined);
    updateDocument.mockReset().mockResolvedValue(undefined);
  });

  it('opens the form prefilled from the expiring policy, with the next term', async () => {
    const user = userEvent.setup();
    renderWith([expiring]);

    await user.click(screen.getByRole('button', { name: 'Renew' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Renewing: details are copied/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/filled by AI/)).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/provider name/i)).toHaveValue('Acme General');
    expect(within(dialog).getByLabelText(/policy number/i)).toHaveValue('POL-OLD');
    expect(within(dialog).getByLabelText(/start date/i)).toHaveValue(
      dayInput(addDays(expiresOn, 1)),
    );
    expect(within(dialog).getByLabelText(/end date/i)).toHaveValue(
      dayInput(addYears(expiresOn, 1)),
    );
  });

  it('saves the renewal as a new record, leaving the old one alone', async () => {
    const user = userEvent.setup();
    renderWith([expiring]);

    await user.click(screen.getByRole('button', { name: 'Renew' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^add policy$/i }));

    await waitFor(() => expect(createDocument).toHaveBeenCalledTimes(1));
    expect(createDocument.mock.calls[0]?.[0]).toMatchObject({
      kind: 'insurance',
      provider: 'Acme General',
      policyNumber: 'POL-OLD',
      premiumAmount: 14_500,
    });
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it('does not offer it on a policy that is not near its expiry', () => {
    renderWith([policy]);

    expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument();
  });

  it('does not offer it on a policy a renewal has already superseded', () => {
    const renewal: VehicleDocument = {
      ...expiring,
      id: 'policy-renewal',
      startDate: addDays(expiresOn, 1),
      endDate: addYears(expiresOn, 1),
    };
    renderWith([expiring, renewal]);

    // The old one is history now, and the renewal is a year from expiry.
    expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument();
  });

  it('never offers it to a viewer', () => {
    renderWith([expiring], VehicleRole.Viewer);

    expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument();
  });
});

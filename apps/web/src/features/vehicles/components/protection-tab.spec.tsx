import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProtectionTab } from './protection-tab';

const documentsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const claimsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

const mutation = vi.hoisted(() => () => ({ mutateAsync: vi.fn(), isPending: false }));

vi.mock('../../vehicle-documents/hooks/use-documents', () => ({
  useVehicleDocuments: () => documentsQuery.current,
  useCreateVehicleDocument: mutation,
  useUpdateVehicleDocument: mutation,
  useDeleteVehicleDocument: mutation,
}));
vi.mock('../../claims/hooks/use-claims', () => ({
  useVehicleClaims: () => claimsQuery.current,
  useCreateClaim: mutation,
  useUpdateClaim: mutation,
  useDeleteClaim: mutation,
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

    render(<ProtectionTab vehicleId="vehicle-1" />);

    expect(screen.getByText('Unable to load protection details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // The regression this guards: a 500 used to render as "you have no policies".
    expect(screen.queryByText('No insurance policies')).not.toBeInTheDocument();
  });

  it('reports a failed claims request without hiding the documents that loaded', () => {
    documentsQuery.current = { isPending: false, isError: false, data: [], refetch: vi.fn() };
    claimsQuery.current = {
      isPending: false,
      isError: true,
      error: new Error('Internal server error'),
      refetch: vi.fn(),
    };

    render(<ProtectionTab vehicleId="vehicle-1" />);

    expect(screen.getByText('Unable to load claims')).toBeInTheDocument();
    expect(screen.getByText('No insurance policies')).toBeInTheDocument();
    expect(screen.queryByText('No claims yet')).not.toBeInTheDocument();
  });
});

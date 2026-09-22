import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/query-keys';

vi.mock('../api/manage-tyre', () => ({
  updateTyre: vi.fn().mockResolvedValue({ id: 't-1' }),
  deleteTyre: vi.fn().mockResolvedValue({ id: 't-1' }),
}));

import { useDeleteTyre, useUpdateTyre } from './use-tyres';

/**
 * A client holding a grading and a set of readings for the vehicle, as the
 * tracker would after loading.
 */
function loadedClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.tyres.all('vehicle-1'), []);
  client.setQueryData(queryKeys.tyres.condition('vehicle-1'), { overall: 'healthy', tyres: [] });
  client.setQueryData(queryKeys.tyres.inspections('vehicle-1'), []);
  client.setQueryData(queryKeys.dashboard.summary(), { attention: [] });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { client, wrapper };
}

const isStale = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated;

describe('tyre writes', () => {
  it('leave the grading to be fetched again after an edit, never worked out here', async () => {
    const { client, wrapper } = loadedClient();
    const { result } = renderHook(() => useUpdateTyre('vehicle-1'), { wrapper });

    await act(() =>
      result.current.mutateAsync({ tyreId: 't-1', input: { dotWeek: 1, dotYear: 2018 } }),
    );

    expect(isStale(client, queryKeys.tyres.condition('vehicle-1'))).toBe(true);
    expect(isStale(client, queryKeys.tyres.all('vehicle-1'))).toBe(true);
    // The attention queue shows the same verdicts.
    expect(isStale(client, queryKeys.dashboard.summary())).toBe(true);
  });

  it('take the readings with a deleted tyre', async () => {
    const { client, wrapper } = loadedClient();
    const { result } = renderHook(() => useDeleteTyre('vehicle-1'), { wrapper });

    await act(() => result.current.mutateAsync('t-1'));

    expect(isStale(client, queryKeys.tyres.inspections('vehicle-1'))).toBe(true);
    expect(isStale(client, queryKeys.tyres.condition('vehicle-1'))).toBe(true);
    expect(isStale(client, queryKeys.dashboard.summary())).toBe(true);
  });
});

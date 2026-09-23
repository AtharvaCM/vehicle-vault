import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/query-keys';

const api = vi.hoisted(() => ({
  getPushPublicKey: vi.fn(),
  subscribePush: vi.fn(),
  unsubscribePush: vi.fn(),
}));

vi.mock('../api/push', () => ({
  getPushPublicKey: api.getPushPublicKey,
  subscribePush: api.subscribePush,
  unsubscribePush: api.unsubscribePush,
}));

import { usePushNotifications } from './use-push-notifications';

const PUBLIC_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const ENDPOINT = 'https://push.example/subscription/abc';

/** A registration whose `getSubscription` answers `subscription` (or none). */
function stubBrowserSupport(subscription: PushSubscription | null) {
  const registration = {
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(subscription),
      subscribe: vi.fn().mockResolvedValue(subscription ?? makeSubscription()),
    },
  };

  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register: vi.fn().mockResolvedValue(registration) },
    configurable: true,
  });
  Object.defineProperty(window, 'PushManager', {
    value: function PushManager() {},
    configurable: true,
  });
  vi.stubGlobal('Notification', {
    permission: 'granted',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  });

  return registration;
}

function makeSubscription(): PushSubscription {
  return {
    endpoint: ENDPOINT,
    toJSON: () => ({ keys: { p256dh: 'p256dh-key', auth: 'auth-key' } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

function renderWithClient() {
  const queryClient = new QueryClient();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => usePushNotifications(), { wrapper });
  return { ...view, invalidateSpy };
}

describe('usePushNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getPushPublicKey.mockResolvedValue({ available: true, publicKey: PUBLIC_KEY });
    api.subscribePush.mockResolvedValue(undefined);
    api.unsubscribePush.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes notification preferences once this device successfully subscribes', async () => {
    stubBrowserSupport(null);
    const { result, invalidateSpy } = renderWithClient();

    await waitFor(() => expect(result.current.status).toBe('off'));
    invalidateSpy.mockClear();

    let enabled: boolean | undefined;
    await act(async () => {
      enabled = await result.current.enable();
    });

    expect(enabled).toBe(true);
    expect(result.current.status).toBe('on');
    expect(api.subscribePush).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.notifications.preferences() });
  });

  it('refreshes notification preferences once this device successfully unsubscribes', async () => {
    stubBrowserSupport(makeSubscription());
    const { result, invalidateSpy } = renderWithClient();

    await waitFor(() => expect(result.current.status).toBe('on'));
    invalidateSpy.mockClear();

    let disabled: boolean | undefined;
    await act(async () => {
      disabled = await result.current.disable();
    });

    expect(disabled).toBe(true);
    expect(result.current.status).toBe('off');
    expect(api.unsubscribePush).toHaveBeenCalledWith(ENDPOINT);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.notifications.preferences() });
  });

  it('does not refresh notification preferences when there was nothing to unsubscribe', async () => {
    stubBrowserSupport(null);
    const { result, invalidateSpy } = renderWithClient();

    await waitFor(() => expect(result.current.status).toBe('off'));
    invalidateSpy.mockClear();

    await act(async () => {
      await result.current.disable();
    });

    expect(api.unsubscribePush).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

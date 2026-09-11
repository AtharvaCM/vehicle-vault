import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const preferenceQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const setPreference = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const authUser = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@/features/notifications/hooks/use-alert-email-preference', () => ({
  useAlertEmailPreference: () => preferenceQuery.current,
  useSetAlertEmailPreference: () => setPreference,
}));

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: authUser.current }),
}));

vi.mock('@/lib/toast', () => ({ appToast: toast }));

import { AlertEmailCard } from './alert-email-card';

function setPreferenceData(data: { muted: boolean; mutedAt: string | null }) {
  preferenceQuery.current = { data, isPending: false, isError: false };
}

describe('AlertEmailCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPreference.isPending = false;
    setPreference.mutateAsync.mockResolvedValue({ muted: true, mutedAt: null });
    authUser.current = { email: 'atharva@example.com', emailVerified: true };
    setPreferenceData({ muted: false, mutedAt: null });
  });

  it('shows alert emails as on, with the way to turn them off', () => {
    render(<AlertEmailCard />);

    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /turn alert emails off/i })).toBeInTheDocument();
  });

  it('shows the muted state and when it started', () => {
    setPreferenceData({ muted: true, mutedAt: '2026-09-11T06:00:00.000Z' });

    render(<AlertEmailCard />);

    expect(screen.getByText('Muted')).toBeInTheDocument();
    expect(screen.getByText(/since 11 Sept 2026/i)).toBeInTheDocument();
  });

  it('offers a muted user the way back, since no email will carry them there', () => {
    setPreferenceData({ muted: true, mutedAt: '2026-09-11T06:00:00.000Z' });

    render(<AlertEmailCard />);

    expect(screen.getByRole('button', { name: /turn alert emails back on/i })).toBeInTheDocument();
  });

  it('re-enables alert email when the muted user asks for it', async () => {
    setPreferenceData({ muted: true, mutedAt: '2026-09-11T06:00:00.000Z' });

    render(<AlertEmailCard />);
    fireEvent.click(screen.getByRole('button', { name: /turn alert emails back on/i }));

    await waitFor(() => expect(setPreference.mutateAsync).toHaveBeenCalledWith(false));
    expect(toast.success).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Alert emails turned on' }),
    );
  });

  it('mutes when the user asks for that instead', async () => {
    render(<AlertEmailCard />);
    fireEvent.click(screen.getByRole('button', { name: /turn alert emails off/i }));

    await waitFor(() => expect(setPreference.mutateAsync).toHaveBeenCalledWith(true));
  });

  it('says the alerts themselves are unaffected either way', () => {
    render(<AlertEmailCard />);
    expect(screen.getByText(/keep appearing in the app/i)).toBeInTheDocument();

    setPreferenceData({ muted: true, mutedAt: null });
    render(<AlertEmailCard />);
    expect(screen.getByText(/still see every one of them in the app/i)).toBeInTheDocument();
  });

  it('surfaces a failure instead of silently leaving the toggle where it was', async () => {
    setPreference.mutateAsync.mockRejectedValue(new Error('nope'));

    render(<AlertEmailCard />);
    fireEvent.click(screen.getByRole('button', { name: /turn alert emails off/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});

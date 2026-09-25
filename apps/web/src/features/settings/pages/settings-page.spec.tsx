import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

const api = vi.hoisted(() => ({
  getAccountSecurity: vi.fn(),
  changePassword: vi.fn(),
}));
const setSession = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { name: 'Asha', email: 'asha@example.com', emailVerified: true },
    setSession,
  }),
}));
vi.mock('../api/account-security', () => ({
  accountSecurityQueryOptions: () => ({
    queryKey: ['account', 'security'],
    queryFn: api.getAccountSecurity,
  }),
  changePassword: api.changePassword,
}));
vi.mock('../api/sessions', () => ({
  sessionsQueryOptions: () => ({ queryKey: ['account', 'sessions'], queryFn: async () => [] }),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
}));
vi.mock('../hooks/use-download-account-export', () => ({
  useDownloadAccountExport: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
}));
vi.mock('../hooks/use-reconcile-attachments', () => ({
  useReconcileAttachments: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
}));

import { SettingsPage } from './settings-page';

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

const row = (label: string) =>
  screen.getAllByTestId('settings-row').find((node) => node.textContent?.startsWith(label))!;

beforeEach(() => {
  vi.clearAllMocks();
  api.getAccountSecurity.mockResolvedValue({ hasPassword: true, oauthProviders: ['google'] });
});

describe('SettingsPage', () => {
  it('is a directory of sections, each row one decision', async () => {
    show();

    for (const section of ['Profile', 'Security', 'Notifications', 'Data & privacy']) {
      expect(screen.getByRole('heading', { name: section })).toBeInTheDocument();
    }
    expect(row('Email')).toHaveTextContent('asha@example.com');
    expect(row('Email')).toHaveTextContent('Verified');
    await waitFor(() =>
      expect(row('Sign-in methods')).toHaveTextContent('Email and password · Google'),
    );
    expect(within(row('Activity')).getByRole('link')).toHaveAttribute('href', '/settings/activity');
  });

  it('changes the password, keeping this session with the tokens it gets back', async () => {
    const session = { accessToken: 'a', refreshToken: 'r', user: { id: 'u' } };
    api.changePassword.mockResolvedValue(session);
    show();

    await userEvent.click(await within(row('Password')).findByRole('button', { name: /Change/ }));
    const dialog = screen.getByRole('dialog', { name: 'Change password' });
    await userEvent.type(within(dialog).getByLabelText('Current password'), 'old-password-1');
    await userEvent.type(within(dialog).getByLabelText('New password'), 'new-password-2');
    await userEvent.type(within(dialog).getByLabelText('New password again'), 'new-password-2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change password' }));

    await waitFor(() => expect(api.changePassword).toHaveBeenCalled());
    expect(api.changePassword.mock.calls[0]![0]).toEqual({
      currentPassword: 'old-password-1',
      newPassword: 'new-password-2',
    });
    await waitFor(() => expect(setSession).toHaveBeenCalled());
    expect(setSession.mock.calls[0]![0]).toEqual(session);
  });

  it('checks the two new passwords match before asking the API', async () => {
    show();

    await userEvent.click(await within(row('Password')).findByRole('button', { name: /Change/ }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Current password'), 'old-password-1');
    await userEvent.type(within(dialog).getByLabelText('New password'), 'new-password-2');
    await userEvent.type(within(dialog).getByLabelText('New password again'), 'different-3');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change password' }));

    expect(await within(dialog).findByText('The two passwords do not match')).toBeInTheDocument();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('says so when the current password is wrong', async () => {
    api.changePassword.mockRejectedValue(
      new ApiError('Bad request', 400, {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Your current password is not right.' },
      }),
    );
    show();

    await userEvent.click(await within(row('Password')).findByRole('button', { name: /Change/ }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Current password'), 'wrong');
    await userEvent.type(within(dialog).getByLabelText('New password'), 'new-password-2');
    await userEvent.type(within(dialog).getByLabelText('New password again'), 'new-password-2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change password' }));

    expect(
      await within(dialog).findByText('Your current password is not right.'),
    ).toBeInTheDocument();
    expect(setSession).not.toHaveBeenCalled();
  });

  it('lets an account that only signs in with Google set a first password', async () => {
    api.getAccountSecurity.mockResolvedValue({ hasPassword: false, oauthProviders: ['google'] });
    api.changePassword.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: {} });
    show();

    await userEvent.click(
      await within(row('Password')).findByRole('button', { name: /Set a password/ }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Set a password' });
    expect(within(dialog).queryByLabelText('Current password')).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('New password'), 'first-password-1');
    await userEvent.type(within(dialog).getByLabelText('New password again'), 'first-password-1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Set password' }));

    await waitFor(() => expect(api.changePassword).toHaveBeenCalled());
    expect(api.changePassword.mock.calls[0]![0]).toEqual({ newPassword: 'first-password-1' });
  });
});

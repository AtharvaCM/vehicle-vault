import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AccountDeletionCheck } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ check: vi.fn(), remove: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());
const logout = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params: _params,
    search: _search,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to?: string;
    params?: unknown;
    search?: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
}));
vi.mock('@/features/auth/hooks/use-auth', () => ({ useAuth: () => ({ logout }) }));
vi.mock('@/features/auth/components/oauth-buttons', () => ({
  OAuthButtons: () => <a href="/api/auth/oauth/google">Continue with Google</a>,
}));
vi.mock('../api/account-deletion', () => ({
  accountDeletionCheckQueryOptions: () => ({
    queryKey: ['account', 'deletion'],
    queryFn: api.check,
  }),
  deleteAccount: api.remove,
}));

import { DeleteAccountDialog } from './delete-account-dialog';

const ready: AccountDeletionCheck = {
  hasPassword: true,
  needsFreshSignIn: false,
  vehicleCount: 2,
  fileCount: 5,
  sharedVehicles: [],
};

function show(onExport = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DeleteAccountDialog isExporting={false} onExport={onExport} onOpenChange={vi.fn()} open />
    </QueryClientProvider>,
  );
  return onExport;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.remove.mockResolvedValue({ deleted: true });
});

describe('DeleteAccountDialog', () => {
  it('says what goes, offers the backup first, and deletes after the password', async () => {
    const user = userEvent.setup();
    api.check.mockResolvedValue(ready);
    const onExport = show();

    expect(await screen.findByTestId('delete-account-what-goes')).toHaveTextContent(
      '2 vehicles with their service history, reminders, fuel and papers, 5 stored files',
    );
    await user.click(screen.getByRole('button', { name: 'Download your data first' }));
    expect(onExport).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(screen.getByText('Enter your password to confirm.')).toBeInTheDocument();
    expect(api.remove).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Password'), 'pass-word-1');
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await waitFor(() => expect(api.remove.mock.calls[0]?.[0]).toEqual({ password: 'pass-word-1' }));
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({ to: '/login' });
  });

  it('refuses while shared vehicles are still the owner’s, pointing at their members', async () => {
    api.check.mockResolvedValue({
      ...ready,
      sharedVehicles: [{ id: 'v1', label: 'Family', otherMembers: 2 }],
    });
    show();

    const shared = await screen.findByTestId('delete-account-shared');
    expect(shared).toHaveTextContent('Family · shared with 2 people');
    expect(within(shared).getByRole('link', { name: 'Members' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete my account' })).not.toBeInTheDocument();
  });

  it('asks an account with no password to sign in again first', async () => {
    api.check.mockResolvedValue({ ...ready, hasPassword: false, needsFreshSignIn: true });
    show();

    expect(await screen.findByRole('link', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete my account' })).not.toBeInTheDocument();
  });
});

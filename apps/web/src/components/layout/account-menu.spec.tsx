import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  role: 'user',
  allowedCatalogSources: [] as string[],
  logout: vi.fn(),
}));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
}));
vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      name: 'Asha Kulkarni',
      email: 'asha@example.test',
      role: auth.role,
      allowedCatalogSources: auth.allowedCatalogSources,
    },
    logout: auth.logout,
  }),
}));

import { AccountMenu } from './account-menu';

async function openMenu() {
  const user = userEvent.setup();
  render(<AccountMenu trigger="avatar" />);
  await user.click(screen.getByRole('button', { name: 'Account menu for Asha Kulkarni' }));
  return { user, menu: await screen.findByRole('menu') };
}

describe('AccountMenu', () => {
  beforeEach(() => {
    auth.role = 'user';
    auth.allowedCatalogSources = [];
    auth.logout.mockClear();
    navigate.mockClear();
  });

  it('holds the account things: settings, alert preferences, theme and sign out', async () => {
    const { menu } = await openMenu();

    expect(within(menu).getByRole('menuitem', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(
      within(menu).getByRole('menuitem', { name: 'Notification preferences' }),
    ).toHaveAttribute('href', '/settings/preferences');
    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual(['System', 'Light', 'Dark']);
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('shows Admin to admins', async () => {
    auth.role = 'admin';
    const { menu } = await openMenu();

    expect(within(menu).getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it('shows a curator Catalog curation, not Admin', async () => {
    auth.allowedCatalogSources = ['tata-india'];
    const { menu } = await openMenu();

    expect(within(menu).getByRole('menuitem', { name: 'Catalog curation' })).toHaveAttribute(
      'href',
      '/admin/catalog',
    );
    expect(within(menu).queryByRole('menuitem', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('signs out and goes to sign-in', async () => {
    const { user, menu } = await openMenu();

    await user.click(within(menu).getByRole('menuitem', { name: 'Sign out' }));

    expect(auth.logout).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith({ to: '/login' });
  });

  it('shows initials, not a blank circle', () => {
    render(<AccountMenu trigger="row" />);

    const trigger = screen.getByRole('button', { name: 'Account menu for Asha Kulkarni' });
    expect(trigger).toHaveTextContent('AK');
    expect(trigger).toHaveTextContent('Settings and account');
  });
});

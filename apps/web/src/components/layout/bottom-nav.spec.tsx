import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ pathname: '/home' }));
const auth = vi.hoisted(() => ({ role: 'user' }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: router.pathname } }),
}));
vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { name: 'Asha Kulkarni', email: 'asha@example.test', role: auth.role },
    logout: vi.fn(),
  }),
}));

import { BottomNav } from './bottom-nav';

describe('BottomNav', () => {
  beforeEach(() => {
    router.pathname = '/home';
    auth.role = 'user';
  });

  it('carries Home, Garage, Upcoming and History within thumb reach, then More', () => {
    render(<BottomNav />);

    const bar = screen.getByRole('navigation', { name: 'Primary' });
    const links = within(bar).getAllByRole('link');

    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Home', '/home'],
      ['Garage', '/garage'],
      ['Upcoming', '/upcoming'],
      ['History', '/history'],
    ]);
    expect(within(bar).getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('lights Garage on a vehicle page and on the records filed under it', () => {
    for (const pathname of ['/vehicles/v1', '/maintenance-records/r1', '/reminders/r1/edit']) {
      router.pathname = pathname;
      const { unmount } = render(<BottomNav />);

      expect(screen.getByRole('link', { name: 'Garage' })).toHaveAttribute('data-active', 'true');
      expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('data-active');
      unmount();
    }
  });

  it('lights More when the page is one of its destinations', () => {
    router.pathname = '/costs';
    render(<BottomNav />);

    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('data-active', 'true');
  });

  it('exists only below md, where it replaces the sidebar', () => {
    render(<BottomNav />);

    // jsdom has no layout, so the breakpoint is asserted as the class that
    // implements it; the Playwright spec checks the rendered widths.
    expect(screen.getByTestId('bottom-nav')).toHaveClass('md:hidden');
  });

  it('keeps clear of the iPhone home indicator', () => {
    render(<BottomNav />);

    expect(screen.getByTestId('bottom-nav')).toHaveClass('pb-[env(safe-area-inset-bottom)]');
  });

  it('opens Costs and the account from More, without repeating the bar', async () => {
    const user = userEvent.setup();
    render(<BottomNav />);

    await user.click(screen.getByRole('button', { name: 'More' }));

    const sheet = await screen.findByRole('dialog', { name: 'More' });
    const hrefs = within(sheet)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/costs', '/settings', '/settings/preferences']);
    expect(within(sheet).getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('offers Admin in More to admins only', async () => {
    auth.role = 'admin';
    const user = userEvent.setup();
    render(<BottomNav />);

    await user.click(screen.getByRole('button', { name: 'More' }));

    const sheet = await screen.findByRole('dialog', { name: 'More' });
    expect(within(sheet).getByRole('link', { name: 'Admin' })).toHaveAttribute(
      'href',
      '/admin/users',
    );
  });
});

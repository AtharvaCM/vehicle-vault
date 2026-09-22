import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    activeOptions: _activeOptions,
    activeProps: _activeProps,
    children,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    activeOptions?: unknown;
    activeProps?: unknown;
    to?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { name: 'Atharva', role: 'user' }, logout: vi.fn() }),
}));

import { BottomNav } from './bottom-nav';

describe('BottomNav', () => {
  it('carries the primary destinations within thumb reach', () => {
    render(<BottomNav />);

    const bar = screen.getByRole('navigation', { name: 'Primary' });
    const links = within(bar).getAllByRole('link');

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/dashboard',
      '/vehicles',
      '/maintenance',
      '/reminders',
    ]);
    // "Maintenance" does not fit a fifth of 375 px; the bar says what it is for.
    expect(within(bar).getByText('Service')).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('exists only below md, where it replaces the sidebar and the menu button', () => {
    render(<BottomNav />);

    // jsdom has no layout, so the breakpoint is asserted as the class that
    // implements it; the Playwright spec checks the rendered widths.
    expect(screen.getByTestId('bottom-nav')).toHaveClass('md:hidden');
  });

  it('keeps clear of the iPhone home indicator', () => {
    render(<BottomNav />);

    expect(screen.getByTestId('bottom-nav')).toHaveClass('pb-[env(safe-area-inset-bottom)]');
  });

  it('opens every other destination from More', async () => {
    const user = userEvent.setup();
    render(<BottomNav />);

    await user.click(screen.getByRole('button', { name: 'More' }));

    const menu = await screen.findByRole('dialog');
    expect(within(menu).getByRole('link', { name: /loans/i })).toHaveAttribute('href', '/loans');
    expect(within(menu).getByRole('link', { name: /settings/i })).toHaveAttribute(
      'href',
      '/settings',
    );
  });
});

import { render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { AuthContext } from '@/features/auth/providers/auth-provider';

import { PublicFrame } from './public-frame';

function hrefs(nav: HTMLElement) {
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'));
}

describe('PublicFrame', () => {
  it('gives a guest the logo home, the catalog, Sign in, and the footer links', () => {
    render(
      <PublicFrame>
        <p>Page</p>
      </PublicFrame>,
    );

    expect(screen.getByRole('link', { name: 'Vehicle Vault home' })).toHaveAttribute('href', '/');
    expect(hrefs(screen.getByRole('navigation', { name: 'Site' }))).toEqual([
      '/cars',
      '/bikes',
      '/login',
    ]);
    expect(hrefs(screen.getByRole('navigation', { name: 'Footer' }))).toEqual([
      '/cars',
      '/bikes',
      '/privacy',
      '/terms',
      '/contact',
    ]);
    expect(screen.getByText('Page')).toBeInTheDocument();
  });

  it('offers a signed-in visitor their garage instead of Sign in', () => {
    render(
      <AuthContext.Provider value={{ isAuthenticated: true } as never}>
        <PublicFrame>
          <p>Page</p>
        </PublicFrame>
      </AuthContext.Provider>,
    );

    const site = screen.getByRole('navigation', { name: 'Site' });
    expect(within(site).getByRole('link', { name: 'Open your garage' })).toHaveAttribute(
      'href',
      '/home',
    );
    expect(within(site).queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});

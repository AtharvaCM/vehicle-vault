import { Link } from '@tanstack/react-router';
import { APP_NAME } from '@vehicle-vault/shared';
import { useContext, type ReactNode } from 'react';

import { BrandMark } from '@/components/layout/brand-mark';
import { AuthContext } from '@/features/auth/providers/auth-provider';
import { cn } from '@/lib/utils';

type Width = 'narrow' | 'wide';

const WIDTH: Record<Width, string> = {
  // The catalog and the auth pages read as a column; the landing page spreads out.
  narrow: 'max-w-4xl',
  wide: 'max-w-6xl',
};

const NAV_LINK =
  'rounded-control px-2.5 py-2 text-ui font-medium text-fg-2 hover:bg-surface hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand';

/**
 * The footer's links, in order. Privacy, Terms and Contact join them when
 * their pages exist (#341).
 */
export const PUBLIC_FOOTER_LINKS: { to: '/cars' | '/bikes'; label: string }[] = [
  { to: '/cars', label: 'Cars' },
  { to: '/bikes', label: 'Bikes' },
];

/**
 * The signed-out header: the plate logo home, the catalog, and Sign in (the
 * only place it lives). It reads auth without requiring it, so a prerendered
 * catalog page renders it with no provider at all, as a guest header.
 */
export function PublicHeader({ width = 'narrow' }: { width?: Width }) {
  const isAuthenticated = useContext(AuthContext)?.isAuthenticated ?? false;

  return (
    <header className="border-b border-line-subtle bg-page">
      <div
        className={cn(
          'mx-auto flex items-center justify-between gap-2 px-4 py-3 sm:px-6',
          WIDTH[width],
        )}
      >
        <Link
          aria-label={`${APP_NAME} home`}
          className="-ml-1 rounded-control p-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
          to="/"
        >
          {/* On a phone the plate alone, so the catalog links and Sign in fit. */}
          <BrandMark nameClassName="max-[420px]:sr-only" withName />
        </Link>
        <nav aria-label="Site" className="flex items-center gap-0.5 sm:gap-1">
          <Link className={NAV_LINK} to="/cars">
            <span className="sm:hidden">Cars</span>
            <span className="max-sm:hidden">Browse cars</span>
          </Link>
          <Link className={NAV_LINK} to="/bikes">
            <span className="sm:hidden">Bikes</span>
            <span className="max-sm:hidden">Browse bikes</span>
          </Link>
          {isAuthenticated ? (
            <Link className={cn(NAV_LINK, 'font-semibold text-brand')} to="/home">
              Open your garage
            </Link>
          ) : (
            <Link className={cn(NAV_LINK, 'font-semibold text-fg')} to="/login">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter({ width = 'narrow' }: { width?: Width }) {
  return (
    <footer className="border-t border-line-subtle">
      <div
        className={cn(
          'mx-auto flex flex-col gap-3 px-4 py-6 text-small text-fg-2 sm:flex-row sm:items-center sm:justify-between sm:px-6',
          WIDTH[width],
        )}
      >
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
          {PUBLIC_FOOTER_LINKS.map((link) => (
            <Link
              className="rounded-control hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
              key={link.to}
              to={link.to}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p>
          © {new Date().getFullYear()} {APP_NAME}
        </p>
      </div>
    </footer>
  );
}

/**
 * One frame for everything a signed-out visitor sees (#340): the landing
 * page, the auth pages and the public catalog. The page owns its own width
 * and spacing inside it.
 */
export function PublicFrame({
  children,
  width = 'narrow',
}: {
  children: ReactNode;
  width?: Width;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-page text-fg" data-testid="public-frame">
      <PublicHeader width={width} />
      <div className="flex-1">{children}</div>
      <PublicFooter width={width} />
    </div>
  );
}

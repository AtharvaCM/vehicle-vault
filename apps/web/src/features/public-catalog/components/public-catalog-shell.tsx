import { useContext, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { APP_NAME } from '@vehicle-vault/shared';

import { AuthContext } from '@/features/auth/providers/auth-provider';

type PublicCatalogShellProps = {
  children: ReactNode;
};

/**
 * The frame around every public catalog page: the landing page's header and
 * footer, not the signed-in app shell. It reads auth without requiring it, so
 * the same tree renders with no provider at all — which is how the pages will
 * be prerendered — and shows a guest header then.
 */
export function PublicCatalogShell({ children }: PublicCatalogShellProps) {
  const isAuthenticated = useContext(AuthContext)?.isAuthenticated ?? false;

  return (
    <div className="min-h-screen bg-page text-fg">
      <header className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link
          className="rounded-lg text-small font-medium text-fg-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
          to="/"
        >
          {APP_NAME}
        </Link>
        {isAuthenticated ? (
          <Link
            className="rounded-lg px-3 py-2 text-ui font-medium text-fg hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
            to="/dashboard"
          >
            Open your garage
          </Link>
        ) : (
          <Link
            className="rounded-lg px-3 py-2 text-ui font-medium text-fg hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
            to="/login"
          >
            Sign in
          </Link>
        )}
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">{children}</main>

      <footer className="mx-auto max-w-4xl px-4 py-8 text-ui text-fg-2 sm:px-6">
        © {new Date().getFullYear()} {APP_NAME}
      </footer>
    </div>
  );
}

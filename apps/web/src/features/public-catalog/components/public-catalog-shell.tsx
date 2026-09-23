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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link
          className="rounded-lg text-xs font-semibold uppercase tracking-[0.28em] text-slate-600 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400"
          to="/"
        >
          {APP_NAME}
        </Link>
        {isAuthenticated ? (
          <Link
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400"
            to="/dashboard"
          >
            Open your garage
          </Link>
        ) : (
          <Link
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400"
            to="/login"
          >
            Sign in
          </Link>
        )}
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">{children}</main>

      <footer className="mx-auto max-w-4xl px-4 py-8 text-sm text-slate-600 sm:px-6">
        © {new Date().getFullYear()} {APP_NAME}
      </footer>
    </div>
  );
}

import { Link } from '@tanstack/react-router';
import { APP_NAME } from '@vehicle-vault/shared';
import type { ReactNode } from 'react';

import { PublicFrame } from '@/components/public/public-frame';
import { useDocumentTitle } from '@/hooks/use-document-title';

type AuthPageShellProps = {
  title: string;
  /** One line under the title; optional, since the title often says it all. */
  description?: ReactNode;
  /** Above the title: why this sign-in is happening (a catalog vehicle, an invite). */
  context?: ReactNode;
  /** The link to the other way in; null where there is none (a loading step). */
  alternateAction: ReactNode;
  children: ReactNode;
};

/**
 * Every auth page (#343): one centred card on all widths, the brand in the
 * public header above it, and no marketing column, so the form sits above the
 * fold on a phone with one title.
 */
export function AuthPageShell({
  title,
  description,
  context,
  alternateAction,
  children,
}: AuthPageShellProps) {
  useDocumentTitle(`${title} | ${APP_NAME}`);

  return (
    <PublicFrame>
      <main className="mx-auto w-full max-w-md px-4 py-6 sm:py-12">
        <div
          className="space-y-5 rounded-card border border-line bg-surface p-5 shadow-xs sm:p-6"
          data-testid="auth-card"
        >
          {context}
          <div className="space-y-1">
            <h1 className="font-display text-heading font-semibold tracking-tight text-fg">
              {title}
            </h1>
            {description ? <p className="text-ui text-fg-2">{description}</p> : null}
          </div>
          {children}
          {alternateAction ? (
            <div className="border-t border-line-subtle pt-4 text-ui text-fg-2">
              {alternateAction}
            </div>
          ) : null}
        </div>
      </main>
    </PublicFrame>
  );
}

export function AuthPageLink({
  label,
  next,
  to,
  text,
}: {
  label: string;
  /** A return path to keep when switching between sign-in and registration. */
  next?: string;
  to: '/login' | '/register';
  text: string;
}) {
  return (
    <p>
      {text}{' '}
      <Link className="font-semibold text-fg hover:text-fg-2" search={next ? { next } : {}} to={to}>
        {label}
      </Link>
    </p>
  );
}

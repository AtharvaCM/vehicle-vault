import { Link } from '@tanstack/react-router';
import { APP_NAME } from '@vehicle-vault/shared';
import type { ReactNode } from 'react';

import { PublicFrame } from '@/components/public/public-frame';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type AuthPageShellProps = {
  title: string;
  description: string;
  alternateAction: ReactNode;
  children: ReactNode;
};

export function AuthPageShell({
  title,
  description,
  alternateAction,
  children,
}: AuthPageShellProps) {
  useDocumentTitle(`${title} | ${APP_NAME}`);

  return (
    <PublicFrame>
      <div className="mx-auto flex max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="text-title font-semibold tracking-tight text-fg sm:text-display">
                {title}
              </h1>
              <p className="max-w-xl text-lead leading-7 text-fg-2">{description}</p>
            </div>

            <div className="rounded-3xl border border-line bg-surface p-6">
              <h2 className="text-ui font-semibold text-fg">Why this matters</h2>
              <ul className="mt-4 grid gap-3 text-ui leading-6 text-fg-2">
                <li>Keep every vehicle, service entry, reminder, and receipt in one place.</li>
                <li>See what is due and urgent for your own garage only.</li>
                <li>Pick up where you left off whenever you come back.</li>
              </ul>
            </div>
          </div>

          <Card className="border-line shadow-xs">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {children}
              <div className="border-t border-line pt-4 text-ui text-fg-2">{alternateAction}</div>
            </CardContent>
          </Card>
        </div>
      </div>
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

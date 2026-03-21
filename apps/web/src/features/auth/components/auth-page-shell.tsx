import { Link } from '@tanstack/react-router';
import { APP_NAME } from '@vehicle-vault/shared';
import type { ReactNode } from 'react';

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
    <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              {APP_NAME}
            </p>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950">{title}</h1>
              <p className="max-w-xl text-base leading-7 text-slate-600">{description}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-slate-900">Why this matters</h2>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
                <li>Keep every vehicle, service entry, reminder, and receipt in one place.</li>
                <li>See dashboard counts and urgent items for your own garage only.</li>
                <li>Pick up where you left off whenever you come back.</li>
              </ul>
            </div>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {children}
              <div className="border-t border-slate-200 pt-4 text-sm text-slate-600">
                {alternateAction}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function AuthPageLink({
  label,
  to,
  text,
}: {
  label: string;
  to: '/login' | '/register';
  text: string;
}) {
  return (
    <p>
      {text}{' '}
      <Link className="font-semibold text-slate-900 hover:text-slate-700" to={to}>
        {label}
      </Link>
    </p>
  );
}

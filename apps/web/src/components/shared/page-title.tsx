import type { ReactNode } from 'react';

import { APP_NAME } from '@vehicle-vault/shared';

import { useDocumentTitle } from '@/hooks/use-document-title';

type PageTitleProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageTitle({ title, description, actions }: PageTitleProps) {
  useDocumentTitle(`${title} | ${APP_NAME}`);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>

      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

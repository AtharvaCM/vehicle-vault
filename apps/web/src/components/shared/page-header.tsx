import type { ReactNode } from 'react';

import { APP_NAME } from '@vehicle-vault/shared';

import { useDocumentTitle } from '@/hooks/use-document-title';
import { cn } from '@/lib/utils/cn';

type PageHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  eyebrow?: string;
  className?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  eyebrow = APP_NAME,
  className,
}: PageHeaderProps) {
  useDocumentTitle(`${title} | ${APP_NAME}`);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {eyebrow}
        </p>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>

      {actions ? (
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

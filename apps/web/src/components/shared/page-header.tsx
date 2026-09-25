import type { ReactNode } from 'react';

import { APP_NAME } from '@vehicle-vault/shared';

import { useDocumentTitle } from '@/hooks/use-document-title';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  useDocumentTitle(`${title} | ${APP_NAME}`);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:flex-wrap sm:items-end',
        className,
      )}
    >
      {/* The title keeps at least 20rem beside the actions. Where that doesn't
          fit, the actions drop to a row of their own below it. */}
      <div className="space-y-1.5 sm:min-w-80 sm:flex-1">
        <div className="space-y-1">
          <h1 className="text-title font-semibold tracking-tight text-foreground">{title}</h1>
          <div className="max-w-3xl text-ui leading-5 text-muted-foreground">{description}</div>
        </div>
      </div>

      {actions ? (
        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end *:w-full sm:*:w-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

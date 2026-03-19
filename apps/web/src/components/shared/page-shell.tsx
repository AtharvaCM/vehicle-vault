import type { PropsWithChildren } from 'react';

import { cn } from '@/lib/utils/cn';

type PageShellProps = PropsWithChildren<{
  className?: string;
}>;

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      className={cn(
        'mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-8 lg:px-12',
        className,
      )}
    >
      {children}
    </div>
  );
}

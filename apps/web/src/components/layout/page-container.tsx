import type { PropsWithChildren } from 'react';

import { cn } from '@/lib/utils/cn';

type PageContainerProps = PropsWithChildren<{
  className?: string;
}>;

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8',
        className,
      )}
    >
      {children}
    </div>
  );
}

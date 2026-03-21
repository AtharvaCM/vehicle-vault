import type { PropsWithChildren } from 'react';

import { cn } from '@/lib/utils/cn';

type PageContainerProps = PropsWithChildren<{
  className?: string;
}>;

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8',
        className,
      )}
    >
      {children}
    </div>
  );
}

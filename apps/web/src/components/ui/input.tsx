import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 16px text below md, or iOS zooms the page when the field takes focus.
        'flex h-12 w-full rounded-control border border-line bg-surface px-3 text-field text-fg placeholder:text-fg-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-late aria-invalid:focus-visible:ring-late md:h-10 md:text-body file:border-0 file:bg-transparent file:text-small file:font-medium file:text-fg',
        className,
      )}
      {...props}
    />
  );
}

export { Input };

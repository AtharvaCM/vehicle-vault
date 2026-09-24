import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-24 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-base text-fg placeholder:text-fg-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-late aria-invalid:focus-visible:ring-late md:text-body',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

import type * as React from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';

import { cn } from '@/lib/utils';

/** A single on/off control (e.g. bold/italic in a toolbar); see `toggle-group.tsx` for the segmented control. */
function Toggle({ className, ...props }: React.ComponentProps<typeof TogglePrimitive.Root>) {
  return (
    <TogglePrimitive.Root
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-control px-3 text-small font-medium text-fg-2 transition-colors outline-hidden hover:bg-page hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-brand-tint data-[state=on]:text-brand md:h-9',
        className,
      )}
      data-slot="toggle"
      {...props}
    />
  );
}

export { Toggle };

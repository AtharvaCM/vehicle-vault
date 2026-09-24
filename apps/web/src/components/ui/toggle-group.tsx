import type * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';

import { cn } from '@/lib/utils';

/** The segmented control: a row of mutually exclusive options in a tinted track. */
function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn('inline-flex gap-1 rounded-control bg-page p-[3px]', className)}
      data-slot="toggle-group"
      {...props}
    />
  );
}

function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        'inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[4px] px-3.5 text-small font-medium text-fg-2 transition-colors outline-hidden hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:font-semibold data-[state=on]:ring-1 data-[state=on]:ring-line md:h-9',
        className,
      )}
      data-slot="toggle-group-item"
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };

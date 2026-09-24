import type { ComponentProps } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';

function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-card bg-popover text-popover-foreground',
        className,
      )}
      data-slot="command"
      {...props}
    />
  );
}

function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center border-b px-3" data-slot="command-input-wrapper">
      <Search className="mr-2 h-4 w-4 shrink-0 text-fg-3" />
      <CommandPrimitive.Input
        className={cn(
          'flex h-11 w-full rounded-control bg-transparent py-3 text-field outline-hidden placeholder:text-fg-3 md:text-body disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        data-slot="command-input"
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn('max-h-[280px] overflow-x-hidden overflow-y-auto', className)}
      data-slot="command-list"
      {...props}
    />
  );
}

function CommandEmpty(props: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className="py-6 text-center text-body text-fg-2"
      data-slot="command-empty"
      {...props}
    />
  );
}

function CommandGroup({ className, ...props }: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        'overflow-hidden p-1 text-fg **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-caption **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:text-fg-3',
        className,
      )}
      data-slot="command-group"
      {...props}
    />
  );
}

function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        'relative flex min-h-11 cursor-default items-center gap-2 rounded-[4px] px-2 py-2 text-body text-fg outline-hidden select-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-page data-[disabled=true]:opacity-50 md:min-h-9',
        className,
      )}
      data-slot="command-item"
      {...props}
    />
  );
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem };

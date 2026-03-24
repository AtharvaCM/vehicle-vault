import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors [&>svg]:mr-1 [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive/10 text-destructive',
        outline: 'border-border bg-background text-foreground',
        ghost: 'border-transparent bg-transparent text-muted-foreground',
        accent: 'border-transparent bg-primary/10 text-primary',
        warning: 'border-transparent bg-amber-500/10 text-amber-600',
        neutral: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  tone,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    tone?: 'accent' | 'danger' | 'warning' | 'neutral';
  }) {
  const Comp = asChild ? Slot : 'span';
  const resolvedVariant =
    tone === 'danger'
      ? 'destructive'
      : tone === 'warning'
        ? 'warning'
        : tone === 'accent'
          ? 'accent'
          : tone === 'neutral'
            ? 'neutral'
            : variant;

  return (
    <Comp
      data-slot="badge"
      data-variant={resolvedVariant}
      className={cn(badgeVariants({ variant: resolvedVariant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };

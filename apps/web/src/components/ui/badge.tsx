import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors [&>svg]:mr-1 [&>svg]:size-3.5',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-slate-100 text-slate-700',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-rose-100 text-rose-700',
        outline: 'border-border text-foreground',
        ghost: 'border-transparent bg-transparent text-muted-foreground',
        accent: 'border-transparent bg-sky-100 text-sky-700',
        warning: 'border-transparent bg-amber-100 text-amber-700',
        neutral: 'border-transparent bg-slate-100 text-slate-700',
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
}: React.ComponentProps<'span'> &
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

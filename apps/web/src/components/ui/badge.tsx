import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-medium transition-colors [&>svg]:mr-1 [&>svg]:size-3.5',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-page text-fg-2',
        secondary: 'border-transparent bg-page text-fg-2',
        destructive: 'border-transparent bg-late-tint text-late',
        outline: 'border-line text-fg',
        ghost: 'border-transparent bg-transparent text-fg-2',
        accent: 'border-transparent bg-brand-tint text-brand',
        warning: 'border-transparent bg-soon-tint text-soon',
        success: 'border-transparent bg-ok-tint text-ok',
        neutral: 'border-transparent bg-page text-fg-2',
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
    tone?: 'accent' | 'danger' | 'warning' | 'success' | 'neutral';
  }) {
  const Comp = asChild ? Slot : 'span';
  const resolvedVariant =
    tone === 'danger'
      ? 'destructive'
      : tone === 'warning'
        ? 'warning'
        : tone === 'success'
          ? 'success'
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

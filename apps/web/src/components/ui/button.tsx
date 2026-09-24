import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Every size is at least 44px tall below `md`, where it is tapped with a
 * thumb; from `md` up it takes its desktop height. `lg` is the primary phone
 * action (52px), the one pinned to the bottom of a form.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand text-on-brand hover:bg-brand-hover',
        outline: 'border border-line bg-surface text-fg hover:bg-page',
        secondary: 'bg-page text-fg hover:bg-line-subtle',
        ghost: 'text-fg-2 hover:bg-page hover:text-fg',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        'destructive-outline': 'border border-late/35 bg-surface text-late hover:bg-late-tint',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4 text-body md:h-10',
        xs: 'h-11 px-2.5 text-small md:h-7',
        sm: 'h-11 px-3 text-small md:h-8',
        lg: 'h-13 px-5 text-body md:h-11',
        icon: 'size-11 md:size-10',
        'icon-xs': 'size-11 md:size-7',
        'icon-sm': 'size-11 md:size-8',
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;
type IconSize = Extract<ButtonSize, `icon${string}`>;
/** The sizes for a button with visible text: what a component passing a size through accepts. */
type TextButtonSize = Exclude<ButtonSize, IconSize>;

/**
 * An icon-only button has no text to be announced by, so it must be named:
 * the type refuses an icon size without `aria-label` or `aria-labelledby`.
 */
type ButtonNaming =
  | { size?: TextButtonSize | null }
  | { size: IconSize; 'aria-label': string }
  | { size: IconSize; 'aria-labelledby': string };

type ButtonProps = Omit<React.ComponentProps<'button'>, 'aria-label' | 'aria-labelledby'> &
  Omit<VariantProps<typeof buttonVariants>, 'size'> & {
    asChild?: boolean;
    'aria-label'?: string;
    'aria-labelledby'?: string;
  } & ButtonNaming;

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps, ButtonSize, TextButtonSize };

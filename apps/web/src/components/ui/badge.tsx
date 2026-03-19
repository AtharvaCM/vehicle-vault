import type { HTMLAttributes } from 'react';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]',
  {
    variants: {
      tone: {
        neutral: 'border-slate-300/70 bg-white/70 text-slate-700',
        accent: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-800',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

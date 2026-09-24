import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type FigureProps = {
  /** Sentence case, a few words: "Spent, last 12 months". Never an uppercase micro-label. */
  label: string;
  value: ReactNode;
  /** A line under the value that says where it comes from or what to do: "Service, fuel and insurance". */
  hint?: ReactNode;
  /** `md` for figures in a row of several, `lg` for the one that leads a card. */
  size?: 'md' | 'lg';
  className?: string;
};

/**
 * A labelled figure: the label above in the caption colour, the value in
 * tabular numerals, an optional hint below. Replaces the tiny uppercase grey
 * label over a value that read at ~2.6:1. The label names the group, so a
 * screen reader hears "Spent, last 12 months, ₹28,236".
 */
export function Figure({ label, value, hint, size = 'md', className }: FigureProps) {
  const labelId = useId();

  return (
    <div
      aria-labelledby={labelId}
      className={cn('flex min-w-0 flex-col gap-1', className)}
      data-slot="figure"
      role="group"
    >
      <span className="text-small text-fg-3" id={labelId}>
        {label}
      </span>
      <span
        className={cn(
          'font-semibold text-fg tabular-nums',
          size === 'lg' ? 'text-heading' : 'text-lead',
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-small text-fg-2">{hint}</span> : null}
    </div>
  );
}

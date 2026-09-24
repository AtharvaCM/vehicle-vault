import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type SectionHeaderProps = {
  /** Sentence case: "Needs attention", "Recently logged". */
  title: string;
  description?: ReactNode;
  /** A link or button or two, set at the end of the title's line. */
  actions?: ReactNode;
  /** The heading level; sections on a page are h2. */
  as?: 'h2' | 'h3';
  id?: string;
  className?: string;
};

/** The title of a section or card, with an optional description and actions. */
export function SectionHeader({
  title,
  description,
  actions,
  as: Heading = 'h2',
  id,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2', className)}
      data-slot="section-header"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <Heading
          className={cn(
            'font-display font-semibold text-fg',
            Heading === 'h2' ? 'text-heading' : 'text-lead',
          )}
          id={id}
        >
          {title}
        </Heading>
        {description ? <p className="text-small text-fg-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

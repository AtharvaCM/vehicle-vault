import { APP_NAME } from '@vehicle-vault/shared';

import { cn } from '@/lib/utils';

/**
 * The logo: "VV" lettered as a small number plate, with the wordmark beside it
 * where there is room (`withName`). The plate stays white in dark mode, like
 * every plate.
 */
export function BrandMark({
  withName,
  className,
  nameClassName,
}: {
  withName?: boolean;
  className?: string;
  /** For the wordmark, e.g. to hide it on a phone and keep only the plate. */
  nameClassName?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className="inline-flex h-[26px] items-stretch overflow-hidden rounded-[4px] border-[1.5px] border-plate-ink bg-plate"
      >
        <span className="w-[7px] bg-plate-strip" />
        <span className="flex items-center px-1.5 font-display text-ui font-bold tracking-[0.08em] text-plate-ink [font-stretch:78%]">
          VV
        </span>
      </span>
      {withName ? (
        <span
          className={cn(
            'font-display text-lead font-semibold text-fg [font-stretch:90%]',
            nameClassName,
          )}
        >
          {APP_NAME}
        </span>
      ) : (
        <span className="sr-only">{APP_NAME}</span>
      )}
    </span>
  );
}

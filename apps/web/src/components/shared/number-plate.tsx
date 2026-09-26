import type { CSSProperties } from 'react';

import { format, parseRegistration } from '@/lib/format';
import { cn } from '@/lib/utils';

export type NumberPlateSize = 'sm' | 'md' | 'lg' | 'xl';

type PlateMetrics = {
  height: number;
  border: number;
  radius: number;
  strip: number;
  font: number;
  tracking: string;
  padding: number;
  /** The "IND" on the strip, from L up: its size and how far it sits off the bottom. */
  ind?: { font: number; bottom: number };
};

/**
 * The four plate sizes of docs/design-language.md, in px. Exact sizes rather
 * than the type scale: the plate is drawn, not set as text, and its lettering
 * is sized to the plate.
 */
const SIZES: Record<NumberPlateSize, PlateMetrics> = {
  // S: list rows, the attention queue.
  sm: { height: 22, border: 1.25, radius: 3, strip: 5, font: 13, tracking: '0.06em', padding: 6 },
  // M: garage cards, the log-service header.
  md: { height: 36, border: 2, radius: 5, strip: 9, font: 21, tracking: '0.08em', padding: 10 },
  // L: the vehicle header.
  lg: {
    height: 56,
    border: 2.5,
    radius: 6,
    strip: 22,
    font: 32,
    tracking: '0.08em',
    padding: 16,
    ind: { font: 8, bottom: 6 },
  },
  // XL: show papers, held up at a checkpoint.
  xl: {
    height: 72,
    border: 3,
    radius: 8,
    strip: 26,
    font: 40,
    tracking: '0.08em',
    padding: 16,
    ind: { font: 9, bottom: 8 },
  },
};

/** What an empty plate shows faintly in place of a number. */
const EMPTY_PLACEHOLDER = 'MH 00 AB 0000';

type NumberPlateProps = {
  /** The registration as stored, in any case or spacing. Empty draws the dashed "no plate yet" plate. */
  registration: string | null | undefined;
  size?: NumberPlateSize;
  /**
   * A green plate, as electric vehicles carry on the road. Required, so no
   * screen can draw an EV on a white plate by leaving it out (#355).
   */
  electric: boolean;
  /** What a screen reader hears for an empty plate. */
  emptyLabel?: string;
  className?: string;
};

/**
 * An Indian number plate: white, dark border, the blue IND strip, condensed
 * lettering spaced state · district · series · number (`MH 12 DM 0002`), or
 * year · BH · number · series for a Bharat plate. It is a physical object, so
 * it stays white in dark mode.
 *
 * The lettering is real text, so it can be selected and copied. A screen
 * reader hears it spelled out ("M H, 1 2, D M, 0 0 0 2") instead of the
 * printed groups, which it would read as words and numbers.
 */
export function NumberPlate({
  registration,
  size = 'md',
  electric,
  emptyLabel = 'No number plate yet',
  className,
}: NumberPlateProps) {
  const metrics = SIZES[size];
  const { groups } = parseRegistration(registration);
  const empty = groups.length === 0;
  const variant = empty ? 'empty' : electric ? 'electric' : 'private';

  const plateStyle: CSSProperties = {
    height: metrics.height,
    borderWidth: metrics.border,
    borderRadius: metrics.radius,
  };
  const letteringStyle: CSSProperties = {
    fontSize: metrics.font,
    letterSpacing: metrics.tracking,
    paddingInline: metrics.padding,
    fontStretch: '78%',
  };

  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-stretch overflow-hidden align-middle',
        variant === 'private' && 'border-solid border-plate-ink bg-plate text-plate-ink',
        variant === 'electric' && 'border-solid border-plate-ink bg-plate-ev text-plate-ev-ink',
        variant === 'empty' && 'border-dashed border-fg-3/60 bg-transparent text-fg-3',
        className,
      )}
      data-size={size}
      data-slot="number-plate"
      data-variant={variant}
      style={plateStyle}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-end justify-center font-sans font-semibold leading-none tracking-[0.04em]',
          empty ? 'bg-ended-dot' : 'bg-plate-strip text-plate',
        )}
        style={{
          width: metrics.strip,
          paddingBottom: metrics.ind?.bottom,
          fontSize: metrics.ind?.font,
        }}
      >
        {metrics.ind && !empty ? 'IND' : null}
      </span>
      <span
        className="flex min-w-0 items-center whitespace-nowrap font-display font-bold leading-none"
        style={letteringStyle}
      >
        {empty ? (
          <>
            <span aria-hidden="true">{EMPTY_PLACEHOLDER}</span>
            <span className="sr-only">{emptyLabel}</span>
          </>
        ) : (
          <>
            <span aria-hidden="true">{groups.join(' ')}</span>
            {/* Not selectable, so copying the plate copies only its printed number. */}
            <span className="sr-only select-none">
              {format.spokenRegistration(registration)}
              {electric ? ', electric' : ''}
            </span>
          </>
        )}
      </span>
    </span>
  );
}

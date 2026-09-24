import { format } from '@/lib/format';
import { cn } from '@/lib/utils';

import { ChartSwatch, type ChartSlot } from './chart';

export type Share = { key: string; label: string; slot: ChartSlot; value: number };

type ShareBarProps = {
  shares: Share[];
  /** Names the breakdown for assistive technology: "Spend by category, last 12 months". */
  label: string;
  className?: string;
};

/**
 * How a whole splits into parts: one bar in proportion, then each part named
 * with its amount and share. Reads at any width, and every part is named in
 * words, so the colours are identity only. Parts at or below zero are left out.
 */
export function ShareBar({ shares, label, className }: ShareBarProps) {
  const parts = shares.filter((share) => share.value > 0);
  const total = parts.reduce((sum, share) => sum + share.value, 0);

  if (total === 0) return null;

  return (
    <div
      aria-label={label}
      className={cn('flex flex-col gap-4', className)}
      data-slot="share-bar"
      role="group"
    >
      <div aria-hidden="true" className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {parts.map((share) => (
          <span
            className="h-full min-w-1 first:rounded-l-full last:rounded-r-full"
            key={share.key}
            style={{ flexGrow: share.value, backgroundColor: `var(--chart-${share.slot})` }}
          />
        ))}
      </div>
      <ul className="flex flex-col divide-y divide-line-subtle">
        {parts.map((share) => (
          <li className="flex items-center gap-2 py-2 text-body" key={share.key}>
            <ChartSwatch slot={share.slot} />
            <span className="text-fg-2">{share.label}</span>
            <span className="ml-auto font-semibold text-fg tabular-nums">
              {format.money(share.value)}
            </span>
            <span className="w-12 text-right text-small text-fg-3 tabular-nums">
              {format.number((share.value / total) * 100, { decimals: 0 })}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

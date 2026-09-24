import { format, type MoneyOptions } from '@/lib/format';
import { cn } from '@/lib/utils';

type MoneyProps = MoneyOptions & {
  value: number | null | undefined;
  className?: string;
};

/**
 * An amount as the design language writes it: rupees in Indian grouping
 * (₹1,31,624) with tabular numerals, so amounts line up down a column. "—"
 * when there is no amount. Kept on one line: an amount never wraps mid-figure.
 */
export function Money({ value, currency, decimals, className }: MoneyProps) {
  return (
    <span className={cn('whitespace-nowrap tabular-nums', className)} data-slot="money">
      {format.money(value, { currency, decimals })}
    </span>
  );
}

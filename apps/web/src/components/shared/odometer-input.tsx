import { forwardRef, type ComponentProps } from 'react';

import { Input } from '@/components/ui/input';
import { format } from '@/lib/format';
import { cn } from '@/lib/utils';

type OdometerInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  /** Whole kilometres; NaN, null or undefined read as empty. */
  value: number | null | undefined;
  /** An empty field reports NaN, as `valueAsNumber` would, so the schema can name it. */
  onChange: (value: number) => void;
};

/**
 * A reading in kilometres, grouped as it is read ("32,000") with its unit
 * beside it. Only digits are kept, so a pasted "32,000 km" is 32000.
 */
export const OdometerInput = forwardRef<HTMLInputElement, OdometerInputProps>(
  function OdometerInput({ className, value, onChange, ...props }, ref) {
    const shown =
      typeof value === 'number' && Number.isFinite(value)
        ? format.number(value, { decimals: 0 })
        : '';

    return (
      <div className="relative">
        <Input
          {...props}
          autoComplete="off"
          className={cn('pr-12 tabular-nums', className)}
          inputMode="numeric"
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, 7);
            onChange(digits ? Number(digits) : Number.NaN);
          }}
          ref={ref}
          type="text"
          value={shown}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ui text-fg-3"
        >
          km
        </span>
      </div>
    );
  },
);

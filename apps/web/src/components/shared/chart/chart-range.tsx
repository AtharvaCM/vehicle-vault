import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

type ChartRangeProps<Value extends string> = {
  options: ReadonlyArray<{ value: Value; label: string }>;
  value: Value;
  onChange: (value: Value) => void;
  /** What the control picks, for assistive technology. Default "Range". */
  label?: string;
  className?: string;
};

/**
 * The one range control charts use: a segmented control whose options share
 * the width on a phone, set a step smaller there, so four ranges fit in a
 * card at 390px. Choosing the selected
 * option again keeps it (a range is never empty).
 */
export function ChartRange<Value extends string>({
  options,
  value,
  onChange,
  label = 'Range',
  className,
}: ChartRangeProps<Value>) {
  return (
    <ToggleGroup
      aria-label={label}
      className={cn('flex w-full sm:inline-flex sm:w-auto', className)}
      onValueChange={(next) => {
        if (next) onChange(next as Value);
      }}
      type="single"
      value={value}
    >
      {options.map((option) => (
        <ToggleGroupItem
          className="flex-1 px-1 text-caption sm:flex-none sm:px-3.5 sm:text-small"
          key={option.value}
          value={option.value}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

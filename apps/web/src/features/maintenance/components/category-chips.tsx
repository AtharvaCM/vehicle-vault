import { MaintenanceCategory } from '@vehicle-vault/shared';
import { useState } from 'react';

import { cn } from '@/lib/utils';

import { CATEGORY_CHIPS, categoryChipLabel } from '../utils/service-work';

const MAIN_CATEGORIES = new Set(CATEGORY_CHIPS.map((chip) => chip.category));
const OTHER_CATEGORIES = Object.values(MaintenanceCategory).filter(
  (category) => !MAIN_CATEGORIES.has(category),
);

const CHIP_CLASS =
  'inline-flex h-11 items-center justify-center rounded-full border px-3.5 text-ui transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-10';

function chipClass(isSelected: boolean) {
  return cn(
    CHIP_CLASS,
    isSelected
      ? 'border-brand bg-brand-tint font-semibold text-brand ring-1 ring-inset ring-brand'
      : 'border-line bg-surface font-medium text-fg hover:bg-page',
  );
}

type CategoryChipsProps = {
  value: MaintenanceCategory | undefined;
  onChange: (category: MaintenanceCategory) => void;
  labelledBy: string;
  describedBy?: string;
};

/**
 * What was done, one tap each: the five most logged kinds of work, then
 * More… for every other category. A category from elsewhere (a bill, a
 * reminder, the record being edited) that is not one of the five shows as a
 * chip of its own, selected.
 */
export function CategoryChips({ value, onChange, labelledBy, describedBy }: CategoryChipsProps) {
  const [showAll, setShowAll] = useState(false);
  const extra = value && !MAIN_CATEGORIES.has(value) && !showAll ? value : undefined;

  const chip = (category: MaintenanceCategory) => (
    <button
      aria-pressed={value === category}
      className={chipClass(value === category)}
      key={category}
      onClick={() => onChange(category)}
      type="button"
    >
      {categoryChipLabel(category)}
    </button>
  );

  return (
    <div
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
      className="flex flex-wrap gap-2"
      role="group"
    >
      {CATEGORY_CHIPS.map((item) => chip(item.category))}
      {extra ? chip(extra) : null}
      {showAll ? OTHER_CATEGORIES.map(chip) : null}
      <button
        aria-expanded={showAll}
        className={cn(chipClass(false), 'text-fg-2')}
        onClick={() => setShowAll((current) => !current)}
        type="button"
      >
        {showAll ? 'Fewer' : 'More…'}
      </button>
    </div>
  );
}

import type { PublicCatalogBrowsePage } from '@vehicle-vault/shared';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

import { bodyTypeChips, bodyTypePlural } from '../utils/body-type-chips';
import { PublicCatalogLink } from './public-catalog-link';

const CHIP_CLASS =
  'inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-ui transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:h-9';

function chipClass(isSelected: boolean) {
  return cn(
    CHIP_CLASS,
    isSelected
      ? 'border-brand bg-brand-tint font-semibold text-brand ring-1 ring-inset ring-brand'
      : 'border-line bg-surface font-medium text-fg hover:border-fg-3',
  );
}

type BodyTypeFilterProps = {
  page: PublicCatalogBrowsePage;
  /** The selected chip's URL value (`suv`); ignored when it names no chip. */
  selected: string | null;
  /** Given by the route, which keeps the selection in the URL; without it the filter keeps its own. */
  onChange?: (slug: string | null) => void;
};

/**
 * Body-type chips on the browse page (#389), each with its model count. One
 * selected lists its models, on sale first; selecting it again clears it.
 * Renders nothing when the segment has no chips, which is every bike page and
 * any car catalog without near-complete body types.
 */
export function BodyTypeFilter({ page, selected, onChange }: BodyTypeFilterProps) {
  const [ownSelection, setOwnSelection] = useState<string | null>(null);
  const chips = bodyTypeChips(page);
  if (chips.length === 0) return null;

  const current = chips.find((chip) => chip.slug === (onChange ? selected : ownSelection));
  const select = (slug: string | null) => (onChange ? onChange(slug) : setOwnSelection(slug));
  const models = current
    ? page.models
        .filter((model) => model.bodyType === current.bodyType)
        .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
    : [];

  return (
    <section aria-labelledby="body-type-heading" className="space-y-3">
      <h2 className="text-lead font-semibold tracking-tight text-fg" id="body-type-heading">
        Body type
      </h2>
      <div aria-labelledby="body-type-heading" className="flex flex-wrap gap-2" role="group">
        {chips.map((chip) => {
          const isSelected = chip.slug === current?.slug;
          return (
            <button
              aria-pressed={isSelected}
              className={chipClass(isSelected)}
              key={chip.slug}
              onClick={() => select(isSelected ? null : chip.slug)}
              type="button"
            >
              {chip.bodyType}{' '}
              <span className={cn('text-small', isSelected ? 'text-brand' : 'text-fg-3')}>
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {current ? (
        <div aria-live="polite">
          <ul
            aria-label={bodyTypePlural(current.bodyType)}
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            {models.map((model) => (
              <li key={`${model.make.slug}/${model.slug}`}>
                <PublicCatalogLink
                  address={{ segment: page.segment, make: model.make.slug, model: model.slug }}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-control border border-line bg-surface px-3 py-2 text-ui hover:border-fg-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="font-medium text-fg wrap-anywhere">{`${model.make.name} ${model.name}`}</span>
                  <span className="flex shrink-0 items-center gap-1 text-small text-fg-3">
                    {model.isCurrent ? 'On sale' : 'No longer sold'}
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </span>
                </PublicCatalogLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

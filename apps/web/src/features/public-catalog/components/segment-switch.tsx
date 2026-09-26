import type { PublicCatalogSegment } from '@vehicle-vault/shared';

import { cn } from '@/lib/utils';

import { PublicCatalogLink } from './public-catalog-link';

const SEGMENTS: Array<{ segment: PublicCatalogSegment; label: string }> = [
  { segment: 'cars', label: 'Cars' },
  { segment: 'bikes', label: 'Bikes' },
];

/**
 * Cars or Bikes, as one segmented control: the current one filled. The router
 * marks it `aria-current="page"`, as it does any link to the page it is on.
 */
export function SegmentSwitch({ current }: { current: PublicCatalogSegment }) {
  return (
    <nav aria-label="Cars or bikes">
      <ul className="inline-flex rounded-control border border-line bg-surface p-1 shadow-xs">
        {SEGMENTS.map(({ segment, label }) => (
          <li key={segment}>
            <PublicCatalogLink
              address={{ segment }}
              className={cn(
                'inline-flex h-9 min-w-20 items-center justify-center rounded-[calc(var(--radius-control)-4px)] px-4 text-ui font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand',
                segment === current
                  ? 'bg-brand text-on-brand'
                  : 'text-fg-2 hover:bg-page hover:text-fg',
              )}
            >
              {label}
            </PublicCatalogLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

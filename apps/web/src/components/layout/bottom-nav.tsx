import { Link } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { useState } from 'react';

import { Sheet, SheetTrigger } from '@/components/ui/sheet';

import { MobileNavSheetContent } from './mobile-nav-sheet';
import { appNavigation } from './sidebar';

/** The destinations that earn a slot on the bar; everything else is under More. */
const BAR_DESTINATIONS = ['/dashboard', '/vehicles', '/maintenance', '/reminders'] as const;

/** Five slots across 375 px leave room for about nine characters each. */
const SHORT_LABELS: Partial<Record<(typeof BAR_DESTINATIONS)[number], string>> = {
  '/maintenance': 'Service',
};

// The active colour keys off the `data-status="active"` TanStack's Link sets: an
// `activeProps` class would tie with `text-fg-3` and lose on stylesheet order.
const ITEM_CLASS =
  'flex min-w-0 flex-col items-center justify-center gap-1 text-caption font-semibold text-fg-3 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[status=active]:text-primary';

/**
 * Primary navigation below `md`, within thumb reach. The sidebar only appears at
 * `xl` and the topbar's menu from `md`, so on a phone this is the navigation.
 * `AppLayout` pads the page by the bar's height plus the iOS home-indicator
 * inset, so the bar never sits over the last row of a list.
 */
export function BottomNav() {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const items = BAR_DESTINATIONS.map((to) => appNavigation.find((item) => item.to === to)).filter(
    (item) => item !== undefined,
  );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      data-testid="bottom-nav"
    >
      <div className="grid h-16 grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              activeOptions={{ exact: item.exact ?? false }}
              className={ITEM_CLASS}
              key={item.to}
              to={item.to}
            >
              <Icon aria-hidden="true" className="h-5 w-5" />
              <span className="max-w-full truncate">
                {SHORT_LABELS[item.to as (typeof BAR_DESTINATIONS)[number]] ?? item.label}
              </span>
            </Link>
          );
        })}

        <Sheet onOpenChange={setIsMoreOpen} open={isMoreOpen}>
          <SheetTrigger asChild>
            <button className={ITEM_CLASS} type="button">
              <Menu aria-hidden="true" className="h-5 w-5" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <MobileNavSheetContent onClose={() => setIsMoreOpen(false)} />
        </Sheet>
      </div>
    </nav>
  );
}

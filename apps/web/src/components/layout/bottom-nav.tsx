import { Link } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { Fragment, useState } from 'react';

import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { MORE_SECTIONS, MoreSheetContent } from './more-sheet';
import { QuickLogButton } from './quick-log';
import { navItem, type NavSection } from './navigation';
import { useActiveSection } from './use-active-section';

/** The destinations that earn a slot on the bar, either side of the ＋; the rest are under More. */
export const BAR_SECTIONS: readonly NavSection[] = ['home', 'garage', 'upcoming'];

const ITEM_CLASS =
  'flex min-w-0 flex-col items-center justify-center gap-1 text-caption font-medium text-fg-3 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[active]:font-semibold data-[active]:text-brand';

/**
 * Primary navigation below `md`, within thumb reach, with the quick-log ＋ in
 * the middle. The sidebar only appears
 * from `md`, so on a phone this is the navigation. `AppLayout` pads the page
 * by the bar's height plus the iOS home-indicator inset, so the bar never sits
 * over the last row of a list.
 */
export function BottomNav() {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const activeSection = useActiveSection();
  const moreIsActive = activeSection !== null && MORE_SECTIONS.includes(activeSection);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      data-testid="bottom-nav"
    >
      <div className="grid h-16 grid-cols-5">
        {BAR_SECTIONS.map((section, index) => {
          const item = navItem(section);
          const Icon = item.icon;

          return (
            <Fragment key={item.to}>
              {/* Home · Garage · ＋ · Upcoming: the ＋ takes the middle slot. */}
              {index === 2 ? <QuickLogButton /> : null}
              <Link
                className={ITEM_CLASS}
                data-active={section === activeSection || undefined}
                to={item.to}
              >
                <Icon aria-hidden="true" className="size-[22px]" strokeWidth={1.75} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </Fragment>
          );
        })}

        <Sheet onOpenChange={setIsMoreOpen} open={isMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(ITEM_CLASS)}
              data-active={moreIsActive || undefined}
              type="button"
            >
              <Menu aria-hidden="true" className="size-[22px]" strokeWidth={1.75} />
              <span>More</span>
            </button>
          </SheetTrigger>
          <MoreSheetContent onClose={() => setIsMoreOpen(false)} />
        </Sheet>
      </div>
    </nav>
  );
}

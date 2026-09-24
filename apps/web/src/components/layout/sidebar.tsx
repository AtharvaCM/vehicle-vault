import { Link } from '@tanstack/react-router';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { AccountMenu } from './account-menu';
import { BrandMark } from './brand-mark';
import { primaryNavigation } from './navigation';
import { useActiveSection } from './use-active-section';

/**
 * The one navigation from `md` up. From `xl` it is the full sidebar: logo,
 * the five destinations with their names, and the account row at its foot.
 * Between `md` and `xl` the same list collapses to an icon rail, with each
 * name in a tooltip (and still the link's accessible name), and the account
 * menu moves to the topbar. Below `md` the bottom bar takes over.
 */
export function Sidebar() {
  const activeSection = useActiveSection();

  return (
    <div
      className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col border-r border-line bg-surface md:flex xl:w-[232px]"
      data-testid="sidebar"
    >
      <Link
        className="mx-auto mt-6 mb-6 flex rounded-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring xl:mx-6"
        to="/home"
      >
        <BrandMark className="xl:hidden" />
        <BrandMark className="hidden xl:flex" withName />
      </Link>

      <nav aria-label="Primary" className="flex flex-col gap-0.5 px-3 xl:px-4">
        {primaryNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = item.section === activeSection;

          return (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>
                <Link
                  className={cn(
                    'flex h-11 items-center justify-center gap-3 rounded-control text-ui font-medium text-fg-2 transition-colors hover:bg-page hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring xl:h-10 xl:justify-start xl:px-3',
                    isActive &&
                      'bg-brand-tint font-semibold text-brand hover:bg-brand-tint hover:text-brand',
                  )}
                  data-active={isActive || undefined}
                  to={item.to}
                >
                  <Icon aria-hidden="true" className="size-5 xl:size-4" strokeWidth={1.75} />
                  <span className="sr-only xl:not-sr-only">{item.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent className="xl:hidden" side="right">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="mt-auto hidden border-t border-line px-3 py-4 xl:block">
        <AccountMenu trigger="row" />
      </div>
    </div>
  );
}

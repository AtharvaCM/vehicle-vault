import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { NotificationCenter } from '@/features/notifications/components/notification-center';
import { cn } from '@/lib/utils';

import { AccountMenu } from './account-menu';
import { BrandMark } from './brand-mark';
import { Breadcrumbs } from './breadcrumbs';

/**
 * Global tools only: where you are on a deep page (the breadcrumb), adding a
 * vehicle, the bell and, below `xl`, the account menu. It never repeats the
 * page's title; the page's own H1 does that once. On a phone's top-level page
 * the logo takes the breadcrumb's place.
 */
export function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 md:h-16 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center">
          <Breadcrumbs
            fallback={
              <Link
                className="rounded-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                to="/home"
              >
                <BrandMark withName />
              </Link>
            }
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            className={cn(
              buttonVariants({ size: 'sm', variant: 'outline' }),
              'hidden sm:inline-flex',
            )}
            to="/vehicles/new"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add vehicle
          </Link>
          <NotificationCenter />
          <AccountMenu className="xl:hidden" trigger="avatar" />
        </div>
      </div>
    </header>
  );
}

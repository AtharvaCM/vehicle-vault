import { Link, useRouter } from '@tanstack/react-router';
import type { PublicCatalogModelPage, PublicCatalogVariantPage } from '@vehicle-vault/shared';
import { ArrowRight } from 'lucide-react';
import { useContext, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { AuthContext } from '@/features/auth/providers/auth-provider';
import { toCatalogIntentParam } from '@/features/catalog-intent/lib/catalog-intent';

type TrackThisVehicleProps = {
  page: PublicCatalogVariantPage | PublicCatalogModelPage;
};

/**
 * The end of every variant and model page: an offer to track this vehicle. It
 * is a plain link carrying the page as a catalog intent, so it works from
 * static HTML before the app has booted, and it reads auth without requiring
 * it — signed out it goes to registration, signed in straight to the
 * add-vehicle form. Nothing here touches storage; the pages it links to keep
 * the intent. A model page's intent names make and model only, and the form
 * leaves the variant for the owner.
 */
/** Where Track this vehicle goes for this page: its link target and the catalog intent it carries. */
function useTrackTarget(page: PublicCatalogVariantPage | PublicCatalogModelPage) {
  const isAuthenticated = useContext(AuthContext)?.isAuthenticated ?? false;
  const isVariant = 'variant' in page;
  const catalog = toCatalogIntentParam(
    isVariant
      ? {
          segment: page.segment,
          make: page.make.slug,
          model: page.model.slug,
          generation: page.generation.slug,
          variant: page.variant.slug,
        }
      : { segment: page.segment, make: page.make.slug, model: page.model.slug },
  );
  const to: '/vehicles/new' | '/register' = isAuthenticated ? '/vehicles/new' : '/register';
  return { isVariant, catalog, to };
}

function TrackLink({
  page,
  className,
  children,
}: {
  page: PublicCatalogVariantPage | PublicCatalogModelPage;
  className?: string;
  children: ReactNode;
}) {
  const { catalog, to } = useTrackTarget(page);
  const router = useRouter({ warn: false });
  return router ? (
    <Link className={className} search={{ catalog }} to={to}>
      {children}
    </Link>
  ) : (
    // Rendered with no router at all, as a prerender may be.
    <a className={className} href={`${to}?${new URLSearchParams({ catalog })}`}>
      {children}
    </a>
  );
}

/**
 * On a phone, the offer stays in reach (#344): a bar along the bottom of a
 * variant page, carrying the same intent as the page's Track this vehicle.
 * From `md` up the page is short enough to reach the offer itself.
 */
export function TrackThisVehicleBar({ page }: { page: PublicCatalogVariantPage }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden"
      data-testid="track-this-vehicle-bar"
    >
      <TrackLink
        className="flex min-h-11 items-center justify-between gap-3 rounded-control bg-primary px-4 text-ui font-semibold text-primary-foreground"
        page={page}
      >
        <span className="min-w-0 truncate">
          Track your {page.model.name} {page.variant.name} free
        </span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
      </TrackLink>
    </div>
  );
}

export function TrackThisVehicle({ page }: TrackThisVehicleProps) {
  const { isVariant } = useTrackTarget(page);
  const vehicleName = isVariant
    ? `${page.make.name} ${page.model.name} ${(page as PublicCatalogVariantPage).variant.name}`
    : `${page.make.name} ${page.model.name}`;
  const label = (
    <>
      Track this vehicle
      <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
    </>
  );

  return (
    <section
      aria-labelledby="track-this-vehicle-heading"
      className="rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5"
    >
      <h2
        className="text-lead font-semibold tracking-tight text-fg"
        id="track-this-vehicle-heading"
      >
        Own a {vehicleName}?
      </h2>
      <p className="mt-1 text-ui leading-6 text-fg-2">
        Keep its service history, reminders and documents in one place, and hear before something
        falls due.{' '}
        {isVariant
          ? 'We’ll fill in the make, model and variant for you.'
          : 'We’ll fill in the make and model for you; add the variant if you know it.'}
      </p>
      <Button asChild className="mt-4 w-full sm:w-auto" size="lg">
        <TrackLink page={page}>{label}</TrackLink>
      </Button>
    </section>
  );
}

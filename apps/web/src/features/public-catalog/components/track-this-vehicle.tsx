import { Link, useRouter } from '@tanstack/react-router';
import type { PublicCatalogModelPage, PublicCatalogVariantPage } from '@vehicle-vault/shared';
import { ArrowRight } from 'lucide-react';
import { useContext } from 'react';

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
export function TrackThisVehicle({ page }: TrackThisVehicleProps) {
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
  const vehicleName = isVariant
    ? `${page.make.name} ${page.model.name} ${page.variant.name}`
    : `${page.make.name} ${page.model.name}`;
  const router = useRouter({ warn: false });
  const to = isAuthenticated ? '/vehicles/new' : '/register';
  const label = (
    <>
      Track this vehicle
      <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
    </>
  );

  return (
    <section
      aria-labelledby="track-this-vehicle-heading"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <h2
        className="text-lg font-semibold tracking-tight text-slate-950"
        id="track-this-vehicle-heading"
      >
        Own a {vehicleName}?
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Keep its service history, reminders and documents in one place, and hear before something
        falls due.{' '}
        {isVariant
          ? 'We’ll fill in the make, model and variant for you.'
          : 'We’ll fill in the make and model for you; add the variant if you know it.'}
      </p>
      <Button asChild className="mt-4 w-full sm:w-auto" size="lg">
        {router ? (
          <Link search={{ catalog }} to={to}>
            {label}
          </Link>
        ) : (
          // Rendered with no router at all, as a prerender may be.
          <a href={`${to}?${new URLSearchParams({ catalog })}`}>{label}</a>
        )}
      </Button>
    </section>
  );
}

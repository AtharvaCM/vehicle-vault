import { Link, useRouter } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { useContext } from 'react';

import { Button } from '@/components/ui/button';
import { AuthContext } from '@/features/auth/providers/auth-provider';

type TrackYourVehicleOfferProps = {
  /** "Own one already?" on a browse page, "Own a Honda?" on a make page. */
  heading: string;
  /** "Track your vehicle", or "Track your Honda". */
  action: string;
};

/**
 * The owner offer on browse and make pages (#345): the reason the catalog
 * exists. No vehicle is picked yet, so it carries no catalog intent (a model or
 * variant page's Track this vehicle does). Signed out it goes to registration,
 * signed in to the add-vehicle form; a plain link, so it works from static HTML.
 */
export function TrackYourVehicleOffer({ heading, action }: TrackYourVehicleOfferProps) {
  const isAuthenticated = useContext(AuthContext)?.isAuthenticated ?? false;
  const router = useRouter({ warn: false });
  const to = isAuthenticated ? '/vehicles/new' : '/register';
  const label = (
    <>
      {action}
      <ArrowRight aria-hidden="true" />
    </>
  );

  return (
    <section
      aria-labelledby="track-your-vehicle-heading"
      className="flex flex-col gap-4 rounded-card border border-brand/30 bg-brand-tint/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
      data-testid="track-your-vehicle-offer"
    >
      <div>
        <h2 className="font-semibold text-fg" id="track-your-vehicle-heading">
          {heading}
        </h2>
        <p className="mt-1 text-ui text-fg-2">
          Keep its service history, PUC and insurance in one place, free.
        </p>
      </div>
      <Button asChild className="w-full shrink-0 sm:w-auto">
        {router ? <Link to={to}>{label}</Link> : <a href={to}>{label}</a>}
      </Button>
    </section>
  );
}

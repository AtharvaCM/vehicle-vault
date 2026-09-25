import { Link } from '@tanstack/react-router';
import { CarFront, Plus } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PREVIEW = [
  { title: 'Insurance renewal', when: 'in 12 days' },
  { title: 'Oil change', when: 'at 20,000 km' },
] as const;

type EmptyGarageProps = {
  /**
   * On Home the setup checklist above already offers Add vehicle and carries
   * the page's title, so the heading and button are left out there.
   */
  withAction?: boolean;
  className?: string;
};

/**
 * An account with no vehicle yet (#346), the same on Home and Garage: what to
 * do, where an invite comes in, and a greyed preview of what the reminders
 * will look like once there is a vehicle.
 */
export function EmptyGarage({ withAction = true, className }: EmptyGarageProps) {
  return (
    <section
      aria-labelledby="empty-garage-heading"
      className={cn('rounded-card border border-line bg-surface p-5 text-center sm:p-8', className)}
      data-testid="empty-garage"
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand">
        <CarFront aria-hidden="true" className="size-6" />
      </div>
      <h2
        className="mt-3 font-display text-heading font-semibold tracking-tight text-fg"
        id="empty-garage-heading"
      >
        Your garage is empty
      </h2>
      <p className="mx-auto mt-1 max-w-md text-ui text-fg-2">
        Add a car or two-wheeler and we’ll remind you before service, insurance and PUC fall due.
      </p>
      {withAction ? (
        <Link className={cn(buttonVariants(), 'mt-4')} to="/vehicles/new">
          <Plus aria-hidden="true" />
          Add your vehicle
        </Link>
      ) : null}
      <p className="mt-3 text-small text-fg-3">Have an invite? Open the link from your email.</p>

      <div className="mx-auto mt-6 max-w-sm border-t border-line-subtle pt-4 text-left">
        <p className="text-small font-medium text-fg-3">What you’ll see</p>
        <ul aria-label="An example of your reminders" className="mt-2 space-y-2 opacity-60">
          {PREVIEW.map((row) => (
            <li
              className="flex items-center justify-between gap-3 rounded-control border-l-4 border-line bg-page px-3 py-2 text-ui"
              key={row.title}
            >
              <span className="font-medium text-fg-2">{row.title}</span>
              <span className="text-small text-fg-3">{row.when}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

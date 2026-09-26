import type { ReactNode } from 'react';

import { NumberPlate } from '@/components/shared/number-plate';
import { cn } from '@/lib/utils';

type VehicleIdentityLayout = 'row' | 'card' | 'header';

type VehicleIdentityProps = {
  registration: string | null | undefined;
  /** The nickname, or make and model when it has none. */
  name: string;
  /** The model line under the name: "Hyundai Creta SX · 18,500 km". */
  details?: ReactNode;
  /** A green plate for an electric vehicle; required, as on `NumberPlate`. */
  electric: boolean;
  /**
   * `row`: an S plate over the name, for lists and the attention queue.
   * `card`: an M plate over the name and details, for garage cards.
   * `header`: an L plate beside the page heading, for the vehicle page.
   */
  layout?: VehicleIdentityLayout;
  /** The element the name is. Default `h1` in the header, a plain span elsewhere. */
  nameAs?: 'h1' | 'h2' | 'h3' | 'span';
  className?: string;
};

/**
 * A vehicle named the way the design language names it: plate first, the
 * nickname second, then the model. Wherever a vehicle is named, this is how.
 */
export function VehicleIdentity({
  registration,
  name,
  details,
  electric,
  layout = 'row',
  nameAs,
  className,
}: VehicleIdentityProps) {
  const Name = nameAs ?? (layout === 'header' ? 'h1' : 'span');

  if (layout === 'header') {
    return (
      <div
        className={cn('flex flex-wrap items-center gap-x-6 gap-y-3', className)}
        data-slot="vehicle-identity"
        data-layout={layout}
      >
        <NumberPlate electric={electric} registration={registration} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <Name className="font-display text-title font-semibold text-fg [overflow-wrap:anywhere]">
            {name}
          </Name>
          {details ? <p className="text-body text-fg-2">{details}</p> : null}
        </div>
      </div>
    );
  }

  if (layout === 'card') {
    return (
      <div
        className={cn('flex min-w-0 flex-col gap-3.5', className)}
        data-slot="vehicle-identity"
        data-layout={layout}
      >
        <NumberPlate
          className="self-start"
          electric={electric}
          registration={registration}
          size="md"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Name className="truncate font-display text-heading font-semibold text-fg">{name}</Name>
          {details ? <span className="truncate text-small text-fg-2">{details}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('flex min-w-0 flex-col items-start gap-1', className)}
      data-slot="vehicle-identity"
      data-layout={layout}
    >
      <NumberPlate electric={electric} registration={registration} size="sm" />
      <Name className="max-w-full truncate text-caption text-fg-3">
        {name}
        {details ? <> · {details}</> : null}
      </Name>
    </div>
  );
}

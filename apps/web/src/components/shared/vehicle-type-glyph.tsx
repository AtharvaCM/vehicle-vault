import { VehicleType } from '@vehicle-vault/shared';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type VehicleGlyphKind = 'car' | 'suv' | 'scooter' | 'motorcycle' | 'van' | 'truck';

const NAMES: Record<VehicleGlyphKind, string> = {
  car: 'Car',
  suv: 'SUV',
  scooter: 'Scooter',
  motorcycle: 'Motorcycle',
  van: 'Van',
  truck: 'Truck',
};

/**
 * Which glyph a vehicle gets. There is no scooter vehicle type, so a
 * two-wheeler is a scooter only when its linked catalog variant's body type
 * says so; with no link, or any other body type, it is a motorcycle.
 */
export function vehicleGlyphKind(
  vehicleType: VehicleType,
  catalogBodyType?: string | null,
): VehicleGlyphKind {
  switch (vehicleType) {
    case VehicleType.Motorcycle:
      return catalogBodyType?.trim().toLowerCase() === 'scooter' ? 'scooter' : 'motorcycle';
    case VehicleType.SUV:
      return 'suv';
    case VehicleType.Van:
      return 'van';
    case VehicleType.Truck:
      return 'truck';
    default:
      return 'car';
  }
}

/** Side views on a 24px grid, drawn in the stroke weight of the app's icons. */
const PATHS: Record<VehicleGlyphKind, ReactNode> = {
  car: (
    <>
      <path d="M3.5 16.5H2.8a.8.8 0 0 1-.8-.8v-2.2c0-.5.3-.9.8-1l2.6-.7 2.1-3.2a1.5 1.5 0 0 1 1.2-.6h6.2c.5 0 .9.2 1.2.6l2.4 3.2 2.7.7c.5.1.8.5.8 1v2.2a.8.8 0 0 1-.8.8h-.7" />
      <path d="M9.5 16.5h5" />
      <path d="M5.5 11.8h13" />
      <circle cx="7" cy="16.5" r="2" />
      <circle cx="17" cy="16.5" r="2" />
    </>
  ),
  suv: (
    <>
      <path d="M3.5 16.5H2.8a.8.8 0 0 1-.8-.8v-3.9c0-.4.2-.8.6-1l1.7-1L5.8 6.6A1.5 1.5 0 0 1 7.1 6h9.4c.6 0 1.1.3 1.3.8l1.5 3 2 .9c.4.2.7.6.7 1.1v3.9a.8.8 0 0 1-.8.8h-.7" />
      <path d="M9.5 16.5h5" />
      <path d="M4.5 10.2h15" />
      <path d="M11.5 6v4.2" />
      <circle cx="7" cy="16.5" r="2" />
      <circle cx="17" cy="16.5" r="2" />
    </>
  ),
  scooter: (
    <>
      <circle cx="5.5" cy="17" r="2" />
      <circle cx="18.5" cy="17" r="2" />
      <path d="M7.5 17h6.8c.4 0 .8-.3.9-.7l1.8-6.8a1 1 0 0 1 1-.7h1" />
      <path d="M17 6h2.5" />
      <path d="M18.2 6l-.6 3.8" />
      <path d="M5.5 15l1.6-2.8a1 1 0 0 1 .9-.5h5" />
      <path d="M8 11.7h4.5" />
    </>
  ),
  motorcycle: (
    <>
      <circle cx="5.5" cy="16" r="3" />
      <circle cx="18.5" cy="16" r="3" />
      <path d="M5.5 16l3.3-5h5.2l2.5 3.5" />
      <path d="M14 11l2.3-4h2.2" />
      <path d="M8.8 11L8 9H5.5" />
      <path d="M10 16h4.5" />
    </>
  ),
  van: (
    <>
      <path d="M3.5 16.5H2.8a.8.8 0 0 1-.8-.8V7.3c0-.7.6-1.3 1.3-1.3h11.4c.4 0 .8.2 1 .5l3.8 4.6 1.9.7c.4.1.6.5.6.9v3a.8.8 0 0 1-.8.8h-.7" />
      <path d="M9.5 16.5h5" />
      <path d="M15.5 6.5V11h4" />
      <circle cx="7" cy="16.5" r="2" />
      <circle cx="17" cy="16.5" r="2" />
    </>
  ),
  truck: (
    <>
      <path d="M2 15.7V6.8c0-.4.4-.8.8-.8h10.4c.4 0 .8.4.8.8v8.9" />
      <path d="M14 9h3.6c.3 0 .6.1.8.4l3 3.3c.2.2.3.5.3.8v2.2a.8.8 0 0 1-.8.8H20" />
      <path d="M9 16.5h5.5" />
      <path d="M2 16.5h.9" />
      <circle cx="6" cy="16.5" r="2" />
      <circle cx="17.5" cy="16.5" r="2" />
    </>
  ),
};

type VehicleTypeGlyphProps = {
  kind: VehicleGlyphKind;
  /**
   * `decorative` beside words that already name the vehicle; otherwise the
   * glyph is an image named for its kind ("Scooter").
   */
  decorative?: boolean;
  className?: string;
};

/**
 * The vehicle-type glyph (#356): car, SUV, scooter, motorcycle, van or truck,
 * in the current text colour, legible from 16 to 24 px in light and dark.
 */
export function VehicleTypeGlyph({ kind, decorative = false, className }: VehicleTypeGlyphProps) {
  return (
    <svg
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : NAMES[kind]}
      className={cn('size-5 shrink-0', className)}
      data-glyph={kind}
      fill="none"
      role={decorative ? undefined : 'img'}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 24 24"
    >
      {PATHS[kind]}
    </svg>
  );
}

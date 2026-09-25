import { Link } from '@tanstack/react-router';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Vehicle } from '@vehicle-vault/shared';

import { format } from '@/lib/format';

import { useVehicleAccess } from '../context/vehicle-access';
import { useVariantSpecs } from '../hooks/use-variant-specs';
import { keySpecsLine } from '../utils/key-specs';
import { VehicleSpecSheet } from './vehicle-spec-sheet';

type VehicleAboutProps = {
  vehicle: Vehicle;
};

/**
 * More → About this vehicle: which variant it is, the specs that matter as one
 * line (the full sheet a tap away), and when and for how much it was bought.
 * Each row has at most one action, and a viewer gets none.
 */
export function VehicleAbout({ vehicle }: VehicleAboutProps) {
  const { canEdit } = useVehicleAccess();
  const variant = vehicle.variant?.trim() ?? '';
  const specsQuery = useVariantSpecs(vehicle.make, vehicle.model, variant);
  const [sheetOpen, setSheetOpen] = useState(false);
  const specs = variant ? (specsQuery.data ?? null) : null;

  const editLink = (label: string) =>
    canEdit ? (
      <Link
        className={actionClass}
        params={{ vehicleId: vehicle.id }}
        to="/vehicles/$vehicleId/edit"
      >
        {label}
        <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
    ) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <ul
        className="divide-y divide-line-subtle rounded-card border border-line bg-surface"
        data-testid="vehicle-about"
      >
        <AboutRow
          action={editLink(variant ? 'Change' : 'Pick a variant')}
          label="Variant"
          value={variant || `Not picked for this ${vehicle.make} ${vehicle.model}`}
        />
        <AboutRow
          action={
            specs ? (
              <button
                aria-controls="vehicle-spec-sheet"
                aria-expanded={sheetOpen}
                className={actionClass}
                onClick={() => setSheetOpen((open) => !open)}
                type="button"
              >
                Full spec sheet
                {sheetOpen ? (
                  <ChevronDown aria-hidden="true" className="size-4" />
                ) : (
                  <ChevronRight aria-hidden="true" className="size-4" />
                )}
              </button>
            ) : variant && specsQuery.isError ? (
              <button className={actionClass} onClick={() => specsQuery.refetch()} type="button">
                Try again
              </button>
            ) : variant && specsQuery.isPending ? null : (
              editLink('Pick a variant')
            )
          }
          label="Specs"
          testId="about-specs"
          value={specsValue({ variant, specs, specsQuery })}
        />
        <AboutRow
          action={
            vehicle.purchaseDate || vehicle.purchasePrice != null
              ? null
              : editLink('Add purchase date & price')
          }
          label="Bought"
          testId="about-bought"
          value={boughtValue(vehicle)}
        />
      </ul>

      {specs && sheetOpen ? (
        <div id="vehicle-spec-sheet">
          <VehicleSpecSheet specs={specs} />
        </div>
      ) : null}
    </div>
  );
}

function specsValue({
  variant,
  specs,
  specsQuery,
}: {
  variant: string;
  specs: ReturnType<typeof useVariantSpecs>['data'] | null;
  specsQuery: ReturnType<typeof useVariantSpecs>;
}) {
  // The catalogue publishes specs per variant, so without one there is nothing
  // to look up, and the query never runs (it would sit pending forever).
  if (!variant) return 'Pick the variant to see its specs';
  if (specsQuery.isPending) return 'Looking up the specs…';
  if (specsQuery.isError) return "We couldn't load the specs just now";
  if (!specs) return "We don't have specs for this variant yet";

  return keySpecsLine(specs) ?? 'Only the full sheet has figures for this variant';
}

function boughtValue(vehicle: Vehicle) {
  const parts = [
    vehicle.purchaseDate ? format.date(vehicle.purchaseDate) : null,
    vehicle.purchasePrice != null ? format.money(vehicle.purchasePrice) : null,
    vehicle.purchaseOdometer != null ? `at ${format.odometer(vehicle.purchaseOdometer)}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : 'No purchase date or price yet';
}

const actionClass =
  '-mr-2 inline-flex h-11 shrink-0 items-center gap-1 rounded-control px-2 text-ui font-semibold text-brand hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring';

function AboutRow({
  label,
  value,
  action,
  testId,
}: {
  label: string;
  value: string;
  action: ReactNode;
  testId?: string;
}) {
  return (
    <li
      className="flex flex-col gap-1 px-4 py-3 sm:min-h-16 sm:flex-row sm:items-center sm:gap-4"
      data-testid={testId}
    >
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-fg">{label}</p>
        <p className="text-small text-fg-2">{value}</p>
      </div>
      {action ? <div className="-ml-2 sm:ml-0">{action}</div> : null}
    </li>
  );
}

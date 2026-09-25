import { Link } from '@tanstack/react-router';
import { Fuel, Gauge, Package, Paperclip, Wrench, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { FuelType, type HistoryEntry, type Vehicle } from '@vehicle-vault/shared';

import { Money } from '@/components/shared/money';
import { VehicleIdentity } from '@/components/shared/vehicle-identity';
import { MaintenanceDraftBadge } from '@/features/maintenance/components/maintenance-draft-badge';
import { isDraftRecord } from '@/features/maintenance/utils/is-draft-record';
import { accessFor } from '@/features/vehicles/context/vehicle-access';
import { getVehicleDisplayName } from '@/features/vehicles/utils/get-vehicle-display-name';
import { endpoints } from '@/lib/api/endpoints';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { openApiFileInNewTab } from '@/lib/api/open-api-file';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

export type HistoryVehicle = Pick<
  Vehicle,
  'id' | 'nickname' | 'make' | 'model' | 'registrationNumber' | 'fuelType' | 'currentUserRole'
>;

type HistoryRowProps = {
  entry: HistoryEntry;
  /** Missing while the garage list loads, or for a vehicle no longer shared. */
  vehicle: HistoryVehicle | undefined;
  /** Off for a one-vehicle garage, where the plate would only repeat itself. */
  showVehicle: boolean;
  /**
   * Select mode. `selectable` leads the row with a checkbox; a row that cannot
   * be selected (a fill, a reading, a vehicle shared for viewing) keeps the
   * checkbox's space so the list stays in line.
   */
  selection?: {
    selectable: boolean;
    selected: boolean;
    onSelectedChange: (checked: boolean) => void;
  };
  /**
   * An accessory has no page of its own: its row opens it for editing. Omitted
   * for someone who cannot edit the vehicle, whose row only reads.
   */
  onOpenAccessory?: (accessoryId: string) => void;
};

const KIND_ICONS: Record<HistoryEntry['kind'], LucideIcon> = {
  service: Wrench,
  fuel: Fuel,
  odometer: Gauge,
  accessory: Package,
};

type RowText = { title: string; details: string[]; amount: ReactNode };

function describe(entry: HistoryEntry): RowText {
  const date = format.date(entry.occurredAt, 'short');

  switch (entry.kind) {
    case 'service':
      return {
        title: format.enumLabel('maintenanceCategory', entry.category),
        details: [date, entry.workshopName, format.odometer(entry.odometer)].filter(
          (detail): detail is string => Boolean(detail),
        ),
        amount: (
          <Money
            className={isDraftRecord(entry) ? 'text-fg-3' : undefined}
            currency={entry.currencyCode}
            value={Number(entry.totalCost)}
          />
        ),
      };
    case 'fuel':
      return {
        title: `Fuel, ${format.number(entry.quantity)} L`,
        details: [date, entry.location, format.odometer(entry.odometer)].filter(
          (detail): detail is string => Boolean(detail),
        ),
        amount: <Money value={Number(entry.totalCost)} />,
      };
    case 'odometer': {
      const previous = entry.previousOdometer;
      const change =
        previous === null
          ? null
          : entry.odometer >= previous
            ? `Up ${format.distance(entry.odometer - previous)} from ${format.odometer(previous)}`
            : `Corrected from ${format.odometer(previous)}`;

      return {
        title: `Odometer at ${format.odometer(entry.odometer)}`,
        details: [date, change].filter((detail): detail is string => Boolean(detail)),
        amount: null,
      };
    }
    case 'accessory':
      return {
        title: entry.name,
        details: [
          date,
          entry.brand,
          entry.warrantyExpiresAt ? `warranty to ${format.date(entry.warrantyExpiresAt)}` : null,
        ].filter((detail): detail is string => Boolean(detail)),
        amount: <Money currency={entry.currencyCode} value={Number(entry.cost)} />,
      };
  }
}

function EntryLink({
  entry,
  className,
  children,
  onOpenAccessory,
}: {
  entry: HistoryEntry;
  className: string;
  children: ReactNode;
  onOpenAccessory?: (accessoryId: string) => void;
}) {
  if (entry.kind === 'accessory') {
    return onOpenAccessory ? (
      <button
        aria-label={`Edit ${entry.name}`}
        className={cn(className, 'text-left')}
        onClick={() => onOpenAccessory(entry.id)}
        type="button"
      >
        {children}
      </button>
    ) : (
      <div className={className}>{children}</div>
    );
  }

  if (entry.kind === 'service') {
    return (
      <Link
        className={className}
        params={{ recordId: entry.id }}
        to="/maintenance-records/$recordId"
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      className={className}
      params={{ vehicleId: entry.vehicleId }}
      search={entry.kind === 'fuel' ? { tab: 'history', view: 'fuel' } : {}}
      to="/vehicles/$vehicleId"
    >
      {children}
    </Link>
  );
}

async function openReceipt(attachmentId: string) {
  try {
    await openApiFileInNewTab(endpoints.attachments.file(attachmentId));
  } catch (error) {
    appToast.error({ title: getApiErrorMessage(error, 'Could not open the receipt') });
  }
}

/**
 * One thing done to a vehicle: plate, what, when and where, and what it cost.
 * A draft service says so, and costs in grey: it counts in no total until it
 * is confirmed, which the strip under it offers to those who can.
 */
export function HistoryRow({
  entry,
  vehicle,
  showVehicle,
  selection,
  onOpenAccessory,
}: HistoryRowProps) {
  const { title, details, amount } = describe(entry);
  const Icon = KIND_ICONS[entry.kind];
  const isDraft = entry.kind === 'service' && isDraftRecord(entry);
  const canEdit = accessFor(vehicle?.currentUserRole ?? null).canEdit;

  const selected = Boolean(selection?.selectable && selection.selected);

  return (
    <li
      className={cn(selected && 'bg-brand-tint')}
      data-kind={entry.kind}
      data-selected={selected ? 'true' : undefined}
      data-testid="history-row"
    >
      <div className="flex items-stretch">
        {selection ? (
          selection.selectable ? (
            <label className="flex w-12 shrink-0 cursor-pointer items-center justify-center">
              <input
                aria-label={`Select ${title}, ${format.date(entry.occurredAt, 'short')}`}
                checked={selection.selected}
                className="size-4 rounded border-line text-fg focus:ring-ring"
                onChange={(event) => selection.onSelectedChange(event.currentTarget.checked)}
                type="checkbox"
              />
            </label>
          ) : (
            <span aria-hidden="true" className="w-12 shrink-0" />
          )
        ) : null}
        <EntryLink
          className={cn(
            'group grid min-h-14 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 pr-4 transition-colors hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:pr-5',
            selection ? 'pl-0' : 'pl-4 sm:pl-5',
            showVehicle && 'sm:grid-cols-[9rem_minmax(0,1fr)_auto]',
          )}
          entry={entry}
          onOpenAccessory={onOpenAccessory}
        >
          {showVehicle ? (
            <VehicleIdentity
              className="col-span-2 sm:col-span-1"
              electric={vehicle?.fuelType === FuelType.Electric}
              layout="row"
              name={vehicle ? getVehicleDisplayName(vehicle) : 'Vehicle'}
              registration={vehicle?.registrationNumber}
            />
          ) : null}
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-2">
              <Icon aria-hidden="true" className="size-4 shrink-0 text-fg-3" />
              <span className="truncate font-semibold text-fg transition-colors group-hover:text-primary">
                {title}
              </span>
              {isDraft ? <MaintenanceDraftBadge /> : null}
            </p>
            <p className="mt-0.5 text-small text-fg-2 [overflow-wrap:anywhere]">
              {details.join(' · ')}
            </p>
          </div>
          <div className="self-start text-right text-ui font-semibold text-fg sm:self-center">
            {amount}
          </div>
        </EntryLink>
        {/* Outside the row's own control: one control cannot hold another. */}
        {entry.kind === 'accessory' && entry.receiptId ? (
          <button
            aria-label={`Open the receipt for ${entry.name}`}
            className="flex w-11 shrink-0 items-center justify-center text-fg-3 hover:bg-page hover:text-brand focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={() => void openReceipt(entry.receiptId!)}
            title="Receipt"
            type="button"
          >
            <Paperclip aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Outside the row's link: a link cannot hold another. */}
      {isDraft ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-soon/30 bg-soon-tint/70 px-4 py-2.5 text-small sm:px-5">
          <p className="text-soon">
            {canEdit
              ? 'Not counted in costs, reports or reminders until it is confirmed.'
              : 'Not counted in costs, reports or reminders until an owner or editor confirms it.'}
          </p>
          {canEdit ? (
            <Link
              className="inline-flex min-h-11 items-center font-semibold text-soon underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-0"
              params={{ recordId: entry.id }}
              to="/maintenance-records/$recordId/edit"
            >
              Review and confirm
            </Link>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

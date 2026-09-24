import { Link, useMatches, type LinkProps } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

import { useMaintenanceRecord } from '@/features/maintenance/hooks/use-maintenance-record';
import { useReminder } from '@/features/reminders/hooks/use-reminder';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';
import { getVehicleDisplayName } from '@/features/vehicles/utils/get-vehicle-display-name';
import { cn } from '@/lib/utils';

/** One step of the trail. The last one is the page itself and is not a link. */
export type Crumb = { label: string; link?: LinkProps };

const GARAGE: Crumb = { label: 'Garage', link: { to: '/garage' } };
const SETTINGS: Crumb = { label: 'Settings', link: { to: '/settings' } };

/**
 * Where a deep page sits, in place of repeating its title: "Garage / Family
 * SUV / Service record". Top-level pages have none; their H1 says it. Below
 * `md` only the way back fits, so the trail shortens to its parent ("‹ Family
 * SUV"). `fallback` shows on pages without a trail.
 */
export function Breadcrumbs({ fallback = null }: { fallback?: ReactNode }) {
  const match = useMatches({
    select: (matches) => {
      const last = matches[matches.length - 1];
      return last
        ? { fullPath: last.fullPath, params: last.params as Record<string, string> }
        : null;
    },
  });

  if (!match) return fallback;
  const { params } = match;

  switch (match.fullPath) {
    case '/vehicles/new':
      return <Trail crumbs={[GARAGE, { label: 'Add vehicle' }]} />;
    case '/vehicles/$vehicleId':
      return <VehicleTrail vehicleId={params.vehicleId!} />;
    case '/vehicles/$vehicleId/edit':
      return <VehicleTrail tail={[{ label: 'Edit' }]} vehicleId={params.vehicleId!} />;
    case '/vehicles/$vehicleId/documents/$kind/$documentId':
      return <VehicleTrail tail={[{ label: 'Papers' }]} vehicleId={params.vehicleId!} />;
    case '/vehicles/$vehicleId/maintenance':
      return <VehicleTrail tail={[{ label: 'Service history' }]} vehicleId={params.vehicleId!} />;
    case '/vehicles/$vehicleId/maintenance/new':
      return <VehicleTrail tail={[{ label: 'Log service' }]} vehicleId={params.vehicleId!} />;
    case '/vehicles/$vehicleId/reminders':
      return <VehicleTrail tail={[{ label: 'Reminders' }]} vehicleId={params.vehicleId!} />;
    case '/vehicles/$vehicleId/reminders/new':
      return <VehicleTrail tail={[{ label: 'Add reminder' }]} vehicleId={params.vehicleId!} />;
    case '/maintenance-records/$recordId':
      return <RecordTrail recordId={params.recordId!} />;
    case '/maintenance-records/$recordId/edit':
      return <RecordTrail editing recordId={params.recordId!} />;
    case '/reminders/$reminderId':
      return <ReminderTrail reminderId={params.reminderId!} />;
    case '/reminders/$reminderId/edit':
      return <ReminderTrail editing reminderId={params.reminderId!} />;
    case '/settings/activity':
      return <Trail crumbs={[SETTINGS, { label: 'Activity' }]} />;
    case '/settings/preferences':
      return <Trail crumbs={[SETTINGS, { label: 'Notification preferences' }]} />;
    default:
      return fallback;
  }
}

function useVehicleCrumb(vehicleId: string): Crumb {
  const { data: vehicle } = useVehicle(vehicleId);
  const label = vehicle ? getVehicleDisplayName(vehicle) : 'Vehicle';
  return { label, link: { to: '/vehicles/$vehicleId', params: { vehicleId } } };
}

function VehicleTrail({ vehicleId, tail = [] }: { vehicleId: string; tail?: Crumb[] }) {
  const vehicle = useVehicleCrumb(vehicleId);
  return <Trail crumbs={[GARAGE, vehicle, ...tail]} />;
}

/** A service record, under the vehicle it was logged against. */
function RecordTrail({ recordId, editing = false }: { recordId: string; editing?: boolean }) {
  const { data: record } = useMaintenanceRecord(recordId);
  const vehicle = useVehicleCrumb(record?.vehicleId ?? '');
  const self: Crumb = editing
    ? {
        label: 'Service record',
        link: { to: '/maintenance-records/$recordId', params: { recordId } },
      }
    : { label: 'Service record' };
  return <Trail crumbs={[GARAGE, vehicle, self, ...(editing ? [{ label: 'Edit' }] : [])]} />;
}

/** A reminder, under the vehicle it belongs to. */
function ReminderTrail({ reminderId, editing = false }: { reminderId: string; editing?: boolean }) {
  const { data: reminder } = useReminder(reminderId);
  const vehicle = useVehicleCrumb(reminder?.vehicleId ?? '');
  const self: Crumb = editing
    ? { label: 'Reminder', link: { to: '/reminders/$reminderId', params: { reminderId } } }
    : { label: 'Reminder' };
  return <Trail crumbs={[GARAGE, vehicle, self, ...(editing ? [{ label: 'Edit' }] : [])]} />;
}

const LINK_CLASS =
  'rounded-[4px] text-fg-2 transition-colors hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring';

export function Trail({ crumbs }: { crumbs: Crumb[] }) {
  const parent = crumbs[crumbs.length - 2];

  return (
    <>
      {/* Phone: the way back, as a 44px target. */}
      {parent?.link ? (
        <Link
          {...parent.link}
          className={cn(
            LINK_CLASS,
            '-ml-2 flex h-11 min-w-0 items-center gap-1 px-2 text-ui font-medium md:hidden',
          )}
        >
          <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{parent.label}</span>
        </Link>
      ) : null}

      <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
        <ol className="flex min-w-0 items-center gap-1.5 text-ui">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <Fragment key={`${index}-${crumb.label}`}>
                {index > 0 ? (
                  <li aria-hidden="true" className="text-fg-3">
                    <ChevronRight className="size-4" />
                  </li>
                ) : null}
                <li className={cn('min-w-0', isLast ? 'shrink' : 'shrink-0 max-w-60')}>
                  {isLast || !crumb.link ? (
                    <span
                      aria-current={isLast ? 'page' : undefined}
                      className="block truncate font-semibold text-fg"
                    >
                      {crumb.label}
                    </span>
                  ) : (
                    <Link {...crumb.link} className={cn(LINK_CLASS, 'block truncate font-medium')}>
                      {crumb.label}
                    </Link>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

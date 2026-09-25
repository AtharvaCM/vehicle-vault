import { Link } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Vehicle, VehicleRole } from '@vehicle-vault/shared';

import { SectionHeader } from '@/components/shared/section-header';
import { cn } from '@/lib/utils';
import { ActivityFeed } from '@/features/audit/components/activity-feed';
import type { useVehicleAudit } from '@/features/audit/hooks/use-vehicle-audit';
import { VehicleLoansPanel } from '@/features/loans/components/vehicle-loans-panel';
import type { useMaintenanceRecords } from '@/features/maintenance/hooks/use-maintenance-records';
import { MembersTab } from '@/features/vehicle-sharing/components/members-tab';

import { useVehicleAccess } from '../context/vehicle-access';
import type { VehicleMoreSection } from '../types/vehicle-detail-search';
import { VehicleAbout } from './vehicle-about';
import type { VehicleActions } from './vehicle-detail-header';
import { VehicleTyreTracker } from './vehicle-tyre-tracker';

const sections: Record<
  VehicleMoreSection,
  { title: string; description: string; ownerOnly?: boolean }
> = {
  about: { title: 'About this vehicle', description: 'Variant, key specs and when you bought it' },
  tyres: { title: 'Tyres', description: 'Tread, age and rotation' },
  loans: { title: 'Loans', description: "EMIs and what's left to pay", ownerOnly: true },
  members: { title: 'Members', description: 'Who can see this vehicle or log for it' },
  activity: { title: 'Activity', description: 'Every change, in words, newest first' },
};

type VehicleMoreTabProps = {
  vehicle: Vehicle;
  /** The section open, or the list of sections when absent. */
  section: VehicleMoreSection | undefined;
  currentUserRole: VehicleRole | null;
  auditQuery: ReturnType<typeof useVehicleAudit>;
  maintenanceQuery: ReturnType<typeof useMaintenanceRecords>;
  actions: VehicleActions;
};

/**
 * Everything on the vehicle that is looked at now and then: a list of
 * sections, each opened on its own (a link, so Back returns to the list), then
 * the vehicle's downloads and the rare edits. Loans and Delete are the owner's.
 */
export function VehicleMoreTab({
  vehicle,
  section,
  currentUserRole,
  auditQuery,
  maintenanceQuery,
  actions,
}: VehicleMoreTabProps) {
  const { canEdit, isOwner } = useVehicleAccess();
  const vehicleId = vehicle.id;
  const openSection = section && (!sections[section].ownerOnly || isOwner) ? section : undefined;

  if (openSection) {
    return (
      <div className="space-y-4">
        <Link
          className="-ml-2 inline-flex h-11 items-center gap-1 rounded-control px-2 text-ui font-semibold text-brand hover:bg-page"
          params={{ vehicleId }}
          search={{ tab: 'more' }}
          to="/vehicles/$vehicleId"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          More
        </Link>
        <SectionHeader as="h2" title={sections[openSection].title} />
        <MoreSection
          auditQuery={auditQuery}
          currentUserRole={currentUserRole}
          maintenanceQuery={maintenanceQuery}
          section={openSection}
          vehicle={vehicle}
        />
      </div>
    );
  }

  const listed = (Object.keys(sections) as VehicleMoreSection[]).filter(
    (key) => !sections[key].ownerOnly || isOwner,
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <nav aria-label="More about this vehicle">
        <ul className="divide-y divide-line-subtle rounded-card border border-line bg-surface">
          {listed.map((key) => (
            <li key={key}>
              <Link
                className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                params={{ vehicleId }}
                search={{ tab: 'more', section: key }}
                to="/vehicles/$vehicleId"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body font-semibold text-fg">{sections[key].title}</span>
                  <span className="text-small text-fg-2">{sections[key].description}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-3" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="vehicle-more-actions">
        <h2 className="sr-only" id="vehicle-more-actions">
          Vehicle actions
        </h2>
        <ul className="divide-y divide-line-subtle rounded-card border border-line bg-surface">
          <ActionRow onClick={actions.onDownloadServiceHistory}>
            Download service history (PDF)
          </ActionRow>
          <ActionRow onClick={actions.onDownloadResaleReport}>
            Download resale report (PDF)
          </ActionRow>
          {canEdit ? (
            <li>
              <Link
                className={actionRowClass}
                params={{ vehicleId }}
                to="/vehicles/$vehicleId/edit"
              >
                Edit vehicle
              </Link>
            </li>
          ) : null}
          {isOwner ? (
            <ActionRow className="text-late" onClick={actions.onDeleteVehicle}>
              Delete vehicle
            </ActionRow>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

const actionRowClass =
  'flex min-h-12 w-full items-center px-4 py-3 text-left text-body font-semibold text-fg hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

function ActionRow({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button className={cn(actionRowClass, className)} onClick={onClick} type="button">
        {children}
      </button>
    </li>
  );
}

function MoreSection({
  section,
  vehicle,
  currentUserRole,
  auditQuery,
  maintenanceQuery,
}: {
  section: VehicleMoreSection;
  vehicle: Vehicle;
  currentUserRole: VehicleRole | null;
  auditQuery: ReturnType<typeof useVehicleAudit>;
  maintenanceQuery: ReturnType<typeof useMaintenanceRecords>;
}) {
  const vehicleId = vehicle.id;
  const { isOwner } = useVehicleAccess();

  switch (section) {
    case 'about':
      return <VehicleAbout vehicle={vehicle} />;
    case 'tyres':
      return <VehicleTyreTracker maintenanceQuery={maintenanceQuery} vehicle={vehicle} />;
    case 'loans':
      return (
        <VehicleLoansPanel
          vehicleId={vehicleId}
          vehicleLabel={`${vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`} • ${vehicle.registrationNumber}`}
        />
      );
    case 'members':
      return <MembersTab currentUserRole={currentUserRole} vehicleId={vehicleId} />;
    case 'activity':
      return (
        <ActivityFeed
          // Only an owner sees a vehicle's activity; the raw changes are theirs too.
          allowTechnicalDetails={isOwner}
          emptyDescription="Changes to this vehicle and its service, reminders, fuel and papers show up here."
          query={auditQuery}
        />
      );
  }
}

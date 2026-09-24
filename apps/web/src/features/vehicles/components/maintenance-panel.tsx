import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { SectionHeader } from '@/components/shared/section-header';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

import { MaintenanceRecordCard } from '@/features/maintenance/components/maintenance-record-card';
import { useMaintenanceRecords } from '@/features/maintenance/hooks/use-maintenance-records';

import { useVehicleAccess } from '../context/vehicle-access';

type MaintenancePanelProps = {
  vehicleId: string;
  maintenanceQuery: ReturnType<typeof useMaintenanceRecords>;
  title?: string;
  visibleCount?: number | undefined;
};

export function MaintenancePanel({
  vehicleId,
  maintenanceQuery,
  title = 'Recent service',
  visibleCount = 3,
}: MaintenancePanelProps) {
  const { canEdit } = useVehicleAccess();
  const records =
    visibleCount === undefined
      ? (maintenanceQuery.data ?? [])
      : (maintenanceQuery.data ?? []).slice(0, visibleCount);

  return (
    <Card className="border-line/60 bg-surface">
      <CardHeader className="border-b border-line-subtle pb-4">
        <SectionHeader
          actions={
            <>
              <Link
                className={buttonVariants({ size: 'xs', variant: 'ghost' })}
                params={{ vehicleId }}
                search={{ tab: 'history' }}
                to="/vehicles/$vehicleId"
              >
                View all
              </Link>
              {canEdit ? (
                <Link
                  className={buttonVariants({ size: 'xs', variant: 'outline' })}
                  params={{ vehicleId }}
                  to="/vehicles/$vehicleId/maintenance/new"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Log
                </Link>
              ) : null}
            </>
          }
          as="h3"
          description="Service history records."
          title={title}
        />
      </CardHeader>
      <CardContent className="pt-5 sm:p-5">
        {maintenanceQuery.isPending ? (
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-page rounded-xl" />
            <div className="h-20 bg-page rounded-xl" />
          </div>
        ) : maintenanceQuery.isError ? (
          <EmptyState
            description="Service history couldn't be loaded right now."
            title="Unable to load service records"
          />
        ) : records.length ? (
          <div className="space-y-3">
            {records.map((record) => (
              <MaintenanceRecordCard key={record.id} record={record} />
            ))}
          </div>
        ) : (
          <EmptyState
            action={
              canEdit ? (
                <Link
                  className={buttonVariants()}
                  params={{ vehicleId }}
                  to="/vehicles/$vehicleId/maintenance/new"
                >
                  Add first record
                </Link>
              ) : undefined
            }
            description="No service logged yet."
            title="No records"
          />
        )}
      </CardContent>
    </Card>
  );
}

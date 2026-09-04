import { Link } from '@tanstack/react-router';
import { ClipboardList, Paperclip, Wrench } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { SectionCard } from '@/components/shared/section-card';
import { buttonVariants } from '@/components/ui/button';
import { formatMaintenanceCategory } from '@/features/maintenance/utils/format-maintenance-category';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

import type { DashboardMaintenanceSummary } from '../types/dashboard';
import { VehiclePickerMenu, type VehiclePickerVehicle } from './vehicle-picker-menu';

const RECENT_LIMIT = 5;

type RecentServiceCardProps = {
  recentMaintenance: DashboardMaintenanceSummary[];
  vehicles: VehiclePickerVehicle[];
};

function MetaDot() {
  return <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-slate-300" />;
}

export function RecentServiceCard({ recentMaintenance, vehicles }: RecentServiceCardProps) {
  const records = recentMaintenance.slice(0, RECENT_LIMIT);

  return (
    <SectionCard
      action={
        <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/maintenance">
          All records
        </Link>
      }
      contentClassName={records.length > 0 ? 'pt-0' : undefined}
      description="Latest logged services across the garage."
      title="Recent service"
    >
      {records.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {records.map((record) => (
            <Link
              className="group flex items-center justify-between gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              key={record.id}
              params={{ recordId: record.id }}
              to="/maintenance-records/$recordId"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate font-semibold text-slate-900 transition-colors group-hover:text-primary">
                  {formatMaintenanceCategory(record.category)}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500">
                  <span className="min-w-0 truncate">{record.vehicleLabel}</span>
                  <MetaDot />
                  <span className="tabular-nums">{formatDate(record.serviceDate)}</span>
                  {record.workshopName?.trim() ? (
                    <>
                      <MetaDot />
                      <span className="min-w-0 truncate">{record.workshopName}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {record.attachmentCount > 0 ? (
                  <span className="flex items-center gap-1 text-[12px] tabular-nums text-slate-400">
                    <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
                    <span aria-hidden="true">{record.attachmentCount}</span>
                    <span className="sr-only">
                      {record.attachmentCount} attachment{record.attachmentCount === 1 ? '' : 's'}
                    </span>
                  </span>
                ) : null}
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatCurrency(record.totalCost)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          action={
            <VehiclePickerMenu
              buildLink={(vehicleId) => ({
                to: '/vehicles/$vehicleId/maintenance/new',
                params: { vehicleId },
              })}
              icon={Wrench}
              label="Log service"
              size="sm"
              variant="default"
              vehicles={vehicles}
            />
          }
          description="Log the last service for each vehicle so next-due dates and suggestions have something to work from."
          icon={ClipboardList}
          title="No service logged yet"
        />
      )}
    </SectionCard>
  );
}

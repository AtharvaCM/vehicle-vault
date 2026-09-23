import { Link } from '@tanstack/react-router';
import { ChevronRight, ClipboardList } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useVehicleAccess } from '@/features/vehicles/context/vehicle-access';
import { format } from '@/lib/format';

import type { MaintenanceRecord } from '../types/maintenance-record';
import { isDraftRecord } from '../utils/is-draft-record';
import { MaintenanceDraftBadge } from './maintenance-draft-badge';

type MaintenanceRecordCardProps = {
  record: MaintenanceRecord;
  selectionControl?: ReactNode;
  vehicleLabel?: string;
};

export function MaintenanceRecordCard({
  record,
  selectionControl,
  vehicleLabel,
}: MaintenanceRecordCardProps) {
  const { canEdit } = useVehicleAccess();
  const isDraft = isDraftRecord(record);
  const detailBits = [
    vehicleLabel,
    format.date(record.serviceDate),
    record.invoiceNumber?.trim() ? `Invoice ${record.invoiceNumber.trim()}` : undefined,
    record.lineItems?.length
      ? `${record.lineItems.length} item${record.lineItems.length === 1 ? '' : 's'}`
      : undefined,
  ].filter(Boolean);

  return (
    <div className="group relative flex items-center gap-2 sm:gap-4">
      {selectionControl ? <div className="shrink-0">{selectionControl}</div> : null}

      {/* The card fills anything from a phone to half a desktop panel, so its figures
          move beside the text by the card's own width (@xl, 36rem), not the screen's. */}
      <Card className="@container flex-1 overflow-hidden border-slate-200/60 bg-white/70 p-0 transition-all duration-300 hover:border-primary/20 hover:bg-white sm:p-5">
        <Link
          className="flex flex-col p-0 @xl:flex-row @xl:items-center"
          params={{ recordId: record.id }}
          to="/maintenance-records/$recordId"
        >
          {/* Main Content */}
          <div className="flex min-w-0 flex-1 items-center gap-4 p-3 sm:p-5">
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors sm:flex">
              <ClipboardList className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="truncate font-bold text-slate-900 group-hover:text-primary transition-colors">
                  {record.workshopName?.trim() || 'Direct Service / DIY'}
                </p>
                <Badge
                  variant="outline"
                  className="bg-white text-[10px] font-bold uppercase tracking-widest"
                >
                  {format.enumLabel('maintenanceCategory', record.category)}
                </Badge>
                {isDraft ? <MaintenanceDraftBadge /> : null}
              </div>
              <div className="flex flex-col gap-y-1 text-[13px] font-medium text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
                {detailBits.map((detail, index) => (
                  <span key={`${detail}-${index}`}>
                    {index > 0 ? (
                      <span className="mr-3 hidden text-slate-300 sm:inline">•</span>
                    ) : null}
                    {detail}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Metrics & Action */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 p-3 sm:p-4 @xl:border-l @xl:border-t-0 @xl:bg-transparent max-sm:@xl:px-6 max-sm:@xl:py-0">
            <div className="flex items-center gap-8 @xl:gap-12">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Odometer
                </p>
                <p className="text-[13px] font-semibold tabular-nums text-slate-700">
                  {format.odometer(record.odometer)}
                </p>
              </div>

              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Total Cost
                </p>
                <p className="text-[13px] font-bold tabular-nums text-primary">
                  {format.money(record.totalCost, { currency: record.currencyCode })}
                </p>
              </div>
            </div>

            <div className="ml-4 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-primary">
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </Link>

        {/* Outside the card's link: a link cannot hold another. */}
        {isDraft ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-amber-100 bg-amber-50/70 px-3 py-2.5 text-[13px] sm:mt-3 sm:rounded-lg sm:border sm:px-4">
            <p className="text-amber-800">
              {canEdit
                ? 'Not counted in costs, reports or reminders until it is confirmed.'
                : 'Not counted in costs, reports or reminders until an owner or editor confirms it.'}
            </p>
            {canEdit ? (
              <Link
                className="font-semibold text-amber-900 underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                params={{ recordId: record.id }}
                to="/maintenance-records/$recordId/edit"
              >
                Review and confirm
              </Link>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

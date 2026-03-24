import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

import type { MaintenanceRecord } from '../types/maintenance-record';
import { formatMaintenanceCategory } from '../utils/format-maintenance-category';

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
  return (
    <div className="flex items-start gap-3">
      {selectionControl ? <div className="pt-3">{selectionControl}</div> : null}
      <Link className="flex-1" params={{ recordId: record.id }} to="/maintenance-records/$recordId">
        <Card className="rounded-xl transition-colors hover:border-slate-300">
          <CardContent className="grid gap-3.5 p-3.5 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto] md:items-center">
            <div className="space-y-0.5">
              <p className="font-medium text-slate-950">
                {record.workshopName?.trim() || 'Workshop not specified'}
              </p>
              <div className="space-y-0.5 text-[13px] text-slate-600">
                {vehicleLabel ? <p>{vehicleLabel}</p> : null}
                <p>{formatDate(record.serviceDate)}</p>
              </div>
            </div>

            <div>
              <Badge>{formatMaintenanceCategory(record.category)}</Badge>
            </div>

            <div className="space-y-0.5 text-[13px] text-slate-600">
              <p>{record.odometer.toLocaleString('en-IN')} km</p>
              <p>{formatCurrency(record.totalCost)}</p>
            </div>

            <div className="flex items-center justify-end gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Open
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

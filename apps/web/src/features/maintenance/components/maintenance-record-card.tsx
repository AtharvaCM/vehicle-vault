import { Link } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

import type { MaintenanceRecord } from '../types/maintenance-record';
import { formatMaintenanceCategory } from '../utils/format-maintenance-category';

type MaintenanceRecordCardProps = {
  record: MaintenanceRecord;
};

export function MaintenanceRecordCard({ record }: MaintenanceRecordCardProps) {
  return (
    <Link params={{ recordId: record.id }} to="/maintenance-records/$recordId">
      <Card className="transition-colors hover:border-slate-300">
        <CardContent className="grid gap-4 p-4 md:grid-cols-[1.2fr_0.9fr_0.8fr_auto] md:items-center">
          <div className="space-y-1">
            <p className="font-medium text-slate-950">
              {record.workshopName?.trim() || 'Workshop not specified'}
            </p>
            <p className="text-sm text-slate-600">{formatDate(record.serviceDate)}</p>
          </div>

          <div>
            <Badge>{formatMaintenanceCategory(record.category)}</Badge>
          </div>

          <div className="space-y-1 text-sm text-slate-600">
            <p>{record.odometer.toLocaleString('en-IN')} km</p>
            <p>{formatCurrency(record.totalCost)}</p>
          </div>

          <div className="text-sm font-medium text-slate-900">View record</div>
        </CardContent>
      </Card>
    </Link>
  );
}

import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

import type { MaintenanceRecord } from '../types/maintenance-record';
import { formatMaintenanceCategory } from '../utils/format-maintenance-category';

type MaintenanceSummaryCardProps = {
  record: MaintenanceRecord;
};

export function MaintenanceSummaryCard({ record }: MaintenanceSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance summary</CardTitle>
        <CardDescription>
          Review the recorded service details for this maintenance event.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <Detail
          label="Category"
          value={<Badge>{formatMaintenanceCategory(record.category)}</Badge>}
        />
        <Detail label="Service date" value={formatDate(record.serviceDate)} />
        <Detail label="Odometer" value={`${record.odometer.toLocaleString('en-IN')} km`} />
        <Detail label="Total cost" value={formatCurrency(record.totalCost)} />
        <Detail
          label="Workshop name"
          value={record.workshopName?.trim() || 'Workshop not specified'}
        />
        <Detail
          label="Next due date"
          value={record.nextDueDate ? formatDate(record.nextDueDate) : 'Not specified'}
        />
        <Detail
          label="Next due odometer"
          value={
            record.nextDueOdometer !== undefined
              ? `${record.nextDueOdometer.toLocaleString('en-IN')} km`
              : 'Not specified'
          }
        />
        <Detail
          label="Created"
          value={formatDate(record.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
        />
        <Detail
          label="Updated"
          value={formatDate(record.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
        />
        <Detail
          label="Notes"
          value={record.notes?.trim() || 'No additional service notes were recorded.'}
          className="md:col-span-2"
        />
      </CardContent>
    </Card>
  );
}

type DetailProps = {
  className?: string;
  label: string;
  value: ReactNode;
};

function Detail({ className, label, value }: DetailProps) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-2 text-sm text-slate-900">{value}</div>
    </div>
  );
}

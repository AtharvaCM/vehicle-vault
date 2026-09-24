import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from '@/lib/format';
import { cn } from '@/lib/utils';

import type { MaintenanceRecord } from '../types/maintenance-record';
import { MaintenanceRecordCard } from './maintenance-record-card';

type MaintenanceRecordListProps = {
  onSelectionChange?: (recordId: string, checked: boolean) => void;
  records: MaintenanceRecord[];
  selectedRecordIds?: string[];
  title?: string;
  vehicleLabelById?: Record<string, string>;
};

export function MaintenanceRecordList({
  onSelectionChange,
  records,
  selectedRecordIds = [],
  title = 'Service records',
  vehicleLabelById,
}: MaintenanceRecordListProps) {
  return (
    <Card className="p-3 sm:p-5">
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {records.map((record) => (
          <MaintenanceRecordCard
            key={record.id}
            record={record}
            selectionControl={
              onSelectionChange ? (
                <label className="flex items-center justify-center rounded-md border border-border/70 bg-surface p-2 shadow-xs">
                  <input
                    aria-label={`Select service record ${record.workshopName?.trim() || format.enumLabel('maintenanceCategory', record.category)} on ${record.serviceDate}`}
                    checked={selectedRecordIds.includes(record.id)}
                    className={cn('h-4 w-4 rounded border-line text-fg focus:ring-line')}
                    onChange={(event) => onSelectionChange(record.id, event.currentTarget.checked)}
                    type="checkbox"
                  />
                </label>
              ) : null
            }
            vehicleLabel={vehicleLabelById?.[record.vehicleId]}
          />
        ))}
      </CardContent>
    </Card>
  );
}

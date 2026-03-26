import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

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
  title = 'Maintenance history',
  vehicleLabelById,
}: MaintenanceRecordListProps) {
  return (
    <Card>
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
                <label
                  className="flex items-center justify-center rounded-md border border-border/70 bg-white p-2 shadow-sm"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  <input
                    aria-label={`Select maintenance record ${record.workshopName?.trim() || formatSelectionLabel(record.category)} on ${record.serviceDate}`}
                    checked={selectedRecordIds.includes(record.id)}
                    className={cn(
                      'h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400',
                    )}
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

function formatSelectionLabel(category: MaintenanceRecord['category']) {
  return category.replace(/_/g, ' ');
}

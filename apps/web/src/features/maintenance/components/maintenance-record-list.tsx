import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { MaintenanceRecord } from '../types/maintenance-record';
import { MaintenanceRecordCard } from './maintenance-record-card';

type MaintenanceRecordListProps = {
  records: MaintenanceRecord[];
  title?: string;
};

export function MaintenanceRecordList({
  records,
  title = 'Maintenance history',
}: MaintenanceRecordListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {records.map((record) => (
          <MaintenanceRecordCard key={record.id} record={record} />
        ))}
      </CardContent>
    </Card>
  );
}

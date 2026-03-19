import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

import type { MaintenanceRecord } from '../types/maintenance-record';

type MaintenanceListProps = {
  items: MaintenanceRecord[];
};

export function MaintenanceList({ items }: MaintenanceListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:grid-cols-[1.2fr_1fr_1fr_auto]"
            key={item.id}
          >
            <div>
              <p className="font-medium text-slate-900">{item.workshopName}</p>
              <p>{formatDate(item.serviceDate)}</p>
            </div>
            <div>
              <Badge>{item.category}</Badge>
            </div>
            <div>{item.odometer.toLocaleString('en-IN')} km</div>
            <div className="font-medium text-slate-900">{formatCurrency(item.totalCost)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

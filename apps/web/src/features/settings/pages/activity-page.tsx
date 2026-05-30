import { useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AuditFeed } from '@/features/audit/components/audit-feed';
import { useMyAudit } from '@/features/audit/hooks/use-my-audit';
import type { AuditResourceType } from '@/features/audit/types/audit-event';

const RESOURCE_FILTERS: { value: AuditResourceType; label: string }[] = [
  { value: 'vehicle', label: 'Vehicles' },
  { value: 'maintenance_record', label: 'Maintenance' },
  { value: 'reminder', label: 'Reminders' },
  { value: 'fuel_log', label: 'Fuel logs' },
  { value: 'insurance_policy', label: 'Insurance' },
  { value: 'warranty', label: 'Warranties' },
  { value: 'claim', label: 'Claims' },
  { value: 'attachment', label: 'Attachments' },
  { value: 'user', label: 'Account' },
];

const ALL = 'all';

export function ActivityPage() {
  const [filter, setFilter] = useState<string>(ALL);
  const resourceType = filter === ALL ? undefined : (filter as AuditResourceType);
  const query = useMyAudit(resourceType);

  return (
    <PageContainer>
      <PageTitle
        description="Every change made to your garage, newest first. Click an entry to see what changed."
        title="Activity"
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg font-bold">Account activity</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All activity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All activity</SelectItem>
              {RESOURCE_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <AuditFeed
            query={query}
            emptyDescription="Once you start adding vehicles and logging maintenance, your history shows up here."
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}

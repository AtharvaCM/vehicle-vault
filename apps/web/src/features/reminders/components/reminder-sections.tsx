import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils/format-date';

import type { ReminderSummary } from '../types/reminder';

type ReminderSectionsProps = {
  dueSoon: ReminderSummary[];
  overdue: ReminderSummary[];
};

export function ReminderSections({ dueSoon, overdue }: ReminderSectionsProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ReminderGroup
        description="Items that should become prominent in the next notification cycle."
        items={dueSoon}
        title="Due soon"
        tone="warning"
      />
      <ReminderGroup
        description="Items that should show escalation treatment once backend logic is available."
        items={overdue}
        title="Overdue"
        tone="danger"
      />
    </div>
  );
}

type ReminderGroupProps = {
  description: string;
  items: ReminderSummary[];
  title: string;
  tone: 'warning' | 'danger';
};

function ReminderGroup({ description, items, title, tone }: ReminderGroupProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            key={item.id}
          >
            <div>
              <p className="font-medium text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{formatDate(item.dueDate)}</p>
            </div>
            <Badge tone={tone}>{item.priority}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

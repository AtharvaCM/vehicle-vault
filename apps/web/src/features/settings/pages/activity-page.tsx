import { useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ActivityFeed } from '@/features/audit/components/activity-feed';
import { useMyAudit } from '@/features/audit/hooks/use-my-audit';
import type { AuditCategory } from '@/features/audit/types/audit-event';

const VIEWS: { value: AuditCategory; label: string }[] = [
  { value: 'garage', label: 'Garage changes' },
  { value: 'security', label: 'Sign-ins & security' },
];

/**
 * Settings → Activity: what happened, in sentences, split in two. Garage
 * changes are everything done to vehicles and their records; sign-ins and
 * security are sign-ins, failed attempts, and password and session changes,
 * with "Not you?" beside anything that could be someone else.
 */
export function ActivityPage() {
  const [view, setView] = useState<AuditCategory>('garage');
  const query = useMyAudit(view);

  return (
    <PageContainer>
      <PageTitle description="What happened in your account, newest first." title="Activity" />

      <ToggleGroup
        aria-label="Show"
        className="flex w-full sm:inline-flex sm:w-auto"
        onValueChange={(value) => {
          if (value) setView(value as AuditCategory);
        }}
        type="single"
        value={view}
      >
        {VIEWS.map((option) => (
          <ToggleGroupItem className="flex-1 sm:flex-none" key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <ActivityFeed
        // The account's own log: its owner may see the raw changes.
        allowTechnicalDetails
        emptyDescription={
          view === 'garage'
            ? 'Once you add a vehicle and log a service, it shows up here.'
            : 'Sign-ins and password changes show up here.'
        }
        key={view}
        notYou={view === 'security'}
        query={query}
      />
    </PageContainer>
  );
}

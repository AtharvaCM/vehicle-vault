import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';

import type { AuditListResponse } from '../types/audit-event';
import { AuditEventRow } from './audit-event-row';

type AuditFeedProps = {
  query: UseInfiniteQueryResult<InfiniteData<AuditListResponse>>;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function AuditFeed({
  query,
  emptyTitle = 'No activity yet',
  emptyDescription = 'Changes to this record will show up here as they happen.',
}: AuditFeedProps) {
  if (query.isPending) {
    return <LoadingState description="Fetching the activity log." title="Loading activity" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        description="The activity log couldn't be loaded right now. Try again in a moment."
        title="Unable to load activity"
      />
    );
  }

  const events = query.data.pages.flatMap((page) => page.events);

  if (events.length === 0) {
    return <EmptyState description={emptyDescription} title={emptyTitle} />;
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {events.map((event) => (
          <AuditEventRow key={event.id} event={event} />
        ))}
      </ul>
      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={query.isFetchingNextPage}
            onClick={() => {
              void query.fetchNextPage();
            }}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

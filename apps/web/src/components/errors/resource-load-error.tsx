import type { ReactNode } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';

export type ResourceLoadErrorVariant = 'not-found' | 'forbidden' | 'retryable';

/**
 * What a detail page's query failure means to the person looking at it: a
 * well-formed id for something that isn't theirs (404 — including a
 * malformed id, which the API now also answers with 404), access that was
 * there and got taken away (403), or everything else, which is worth another
 * try. A generic "couldn't load" message collapses all three into one dead
 * end; this tells them apart so the page can say something true and, for the
 * retryable case, offer a `Try again` that actually retries.
 */
export function classifyResourceLoadError(error: unknown): ResourceLoadErrorVariant {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'not-found';
    if (error.status === 403) return 'forbidden';
  }
  return 'retryable';
}

type ResourceLoadErrorProps = {
  error: unknown;
  /** Title Case, e.g. "Vehicle", "Maintenance record", "Reminder" — used in titles. */
  resourceLabel: string;
  /** Lowercase, e.g. "vehicle", "record", "reminder" — used in body copy. */
  subject: string;
  onRetry: () => void;
  isRetrying?: boolean;
  /** The "Your garage" / "Upcoming" link back to a list, shown in every variant. */
  listAction: ReactNode;
};

/**
 * Replaces a detail page's `query.isError` branch. One place owns the
 * 404 / 403 / retryable copy and layout so `VehicleDetailPage`,
 * `MaintenanceRecordDetailPage` and `ReminderDetailPage` don't each restate
 * (and drift on) the same three messages. It says what happened once, as the
 * page's own title and line, then offers the way back (#365): no second card
 * repeating the title under a description of the page that failed to load.
 */
export function ResourceLoadError({
  error,
  resourceLabel,
  subject,
  onRetry,
  isRetrying = false,
  listAction,
}: ResourceLoadErrorProps) {
  const variant = classifyResourceLoadError(error);
  const copy =
    variant === 'not-found'
      ? { title: `${resourceLabel} not found`, line: `This ${subject} isn't in your garage.` }
      : variant === 'forbidden'
        ? {
            title: `${resourceLabel} access removed`,
            line: 'You no longer have access — the owner may have removed you.',
          }
        : {
            title: `Couldn't load this ${subject}`,
            line: `We couldn't load this ${subject}.`,
          };

  return (
    <PageContainer>
      <PageTitle description={copy.line} title={copy.title} />
      <div className="flex flex-wrap gap-2" data-testid="resource-load-error">
        {variant === 'retryable' ? (
          <Button disabled={isRetrying} onClick={onRetry}>
            {isRetrying ? 'Trying again…' : 'Try again'}
          </Button>
        ) : null}
        {listAction}
      </div>
    </PageContainer>
  );
}

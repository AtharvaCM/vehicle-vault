import type { ReactNode } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ErrorState } from '@/components/shared/error-state';
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
  /** The page's normal (non-error) description, kept so the header doesn't jump around. */
  pageDescription: string;
  onRetry: () => void;
  isRetrying?: boolean;
  /** The "Your vehicles" / "Your reminders" link back to a list, shown in every variant. */
  listAction: ReactNode;
};

/**
 * Replaces a detail page's `query.isError` branch. One place owns the
 * 404 / 403 / retryable copy and layout so `VehicleDetailPage`,
 * `MaintenanceRecordDetailPage` and `ReminderDetailPage` don't each restate
 * (and drift on) the same three messages.
 */
export function ResourceLoadError({
  error,
  resourceLabel,
  subject,
  pageDescription,
  onRetry,
  isRetrying = false,
  listAction,
}: ResourceLoadErrorProps) {
  const variant = classifyResourceLoadError(error);

  if (variant === 'not-found') {
    const title = `${resourceLabel} not found`;
    return (
      <PageContainer>
        <PageTitle description={pageDescription} title={title} />
        <ErrorState
          action={listAction}
          description={`This ${subject} isn't in your garage.`}
          title={title}
        />
      </PageContainer>
    );
  }

  if (variant === 'forbidden') {
    const title = `${resourceLabel} access removed`;
    return (
      <PageContainer>
        <PageTitle description={pageDescription} title={title} />
        <ErrorState
          action={listAction}
          description="You no longer have access — the owner may have removed you."
          title={title}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle description={pageDescription} title={`Unable to load ${subject}`} />
      <ErrorState
        action={
          <>
            <Button disabled={isRetrying} onClick={onRetry} variant="secondary">
              {isRetrying ? 'Trying again…' : 'Try again'}
            </Button>
            {listAction}
          </>
        }
        description={`We couldn't load this ${subject}.`}
        title={`${resourceLabel} request failed`}
      />
    </PageContainer>
  );
}

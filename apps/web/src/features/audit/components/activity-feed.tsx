import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { format } from '@/lib/format';

import type { AuditEvent, AuditListResponse } from '../types/audit-event';
import { describeAuditEvent } from '../utils/describe-audit-event';

type ActivityFeedProps = {
  query: UseInfiniteQueryResult<InfiniteData<AuditListResponse>>;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Owners may see each change's raw before and after. */
  allowTechnicalDetails?: boolean;
  /** Beside a failed sign-in or an unasked reset: where to change the password. */
  notYou?: boolean;
};

/** "Today", "Yesterday", or the date: the heading a day's events sit under. */
export function dayLabel(occurredAt: string, now: Date = new Date()) {
  const days = format.daysUntil(occurredAt, now);
  if (days === 0) return 'Today';
  if (days === -1) return 'Yesterday';
  return format.date(occurredAt, 'long');
}

/** Consecutive events of one day together; the API sends them newest first. */
export function groupByDay(events: AuditEvent[], now: Date = new Date()) {
  const groups: { label: string; events: AuditEvent[] }[] = [];
  for (const event of events) {
    const label = dayLabel(event.occurredAt, now);
    const last = groups.at(-1);
    if (last?.label === label) last.events.push(event);
    else groups.push({ label, events: [event] });
  }
  return groups;
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** The raw change, as recorded: for owners who want to see exactly what moved. */
function TechnicalDetails({ event }: { event: AuditEvent }) {
  return (
    <div
      className="mt-2 space-y-2 rounded-control bg-page px-3 py-2"
      data-testid="activity-technical"
    >
      <p className="font-mono text-caption text-fg-3">{event.action}</p>
      {event.changedFields.length > 0 ? (
        <dl className="space-y-1">
          {event.changedFields.map((field) => (
            <div
              className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-2 text-caption"
              key={field}
            >
              {/* Field names, ids and JSON have nowhere to wrap, so they may break
                  mid-word rather than widen the page. */}
              <dt className="font-mono text-fg-3 wrap-anywhere">{field}</dt>
              <dd className="flex flex-wrap items-center gap-2 text-fg-2">
                <span className="rounded bg-late-tint px-1.5 py-0.5 text-late line-through decoration-late/40 wrap-anywhere">
                  {renderValue(event.before?.[field])}
                </span>
                <span className="text-fg-3">→</span>
                <span className="rounded bg-ok-tint px-1.5 py-0.5 text-ok wrap-anywhere">
                  {renderValue(event.after?.[field])}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {event.ipAddress || event.userAgent ? (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-fg-3">
          {event.ipAddress ? <span>IP {event.ipAddress}</span> : null}
          {event.userAgent ? <span className="wrap-anywhere">{event.userAgent}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

function ActivityRow({
  event,
  technical,
  notYou,
}: {
  event: AuditEvent;
  technical: boolean;
  notYou: boolean;
}) {
  const sentence = describeAuditEvent(event);

  return (
    <li
      className="px-4 py-3 sm:px-5"
      data-suspicious={sentence.suspicious || undefined}
      data-testid="activity-row"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-body text-fg">
            {sentence.link ? (
              <Link
                {...sentence.link}
                className="font-medium text-fg underline-offset-2 hover:text-brand hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                {sentence.text}
              </Link>
            ) : (
              <span className="font-medium">{sentence.text}</span>
            )}
            {sentence.detail ? <span className="text-fg-2"> — {sentence.detail}</span> : null}
          </p>
          {notYou && sentence.suspicious ? (
            <p className="mt-1 text-small text-soon">
              Not you?{' '}
              <Link className="font-semibold underline underline-offset-2" to="/settings">
                Change password
              </Link>
            </p>
          ) : null}
        </div>
        <time
          className="shrink-0 whitespace-nowrap text-small tabular-nums text-fg-3"
          dateTime={event.occurredAt}
          title={format.date(event.occurredAt, 'dateTime')}
        >
          {format.date(event.occurredAt, 'time')}
        </time>
      </div>
      {technical ? <TechnicalDetails event={event} /> : null}
    </li>
  );
}

/**
 * The activity log in plain sentences, actor first, grouped by day: "You
 * logged a fuel fill — 28 L · ₹2,996 · 18,500 km", linking to the record
 * while it still exists. Owners can switch on the raw change beneath each.
 */
export function ActivityFeed({
  query,
  emptyTitle = 'No activity yet',
  emptyDescription = 'Changes show up here as they happen.',
  allowTechnicalDetails = false,
  notYou = false,
}: ActivityFeedProps) {
  const [technical, setTechnical] = useState(false);

  if (query.isPending) {
    return <LoadingState description="Fetching the activity log." title="Loading activity" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        action={
          <Button onClick={() => void query.refetch()} variant="secondary">
            Try again
          </Button>
        }
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
      {allowTechnicalDetails ? (
        <label className="flex items-center justify-end gap-2 text-small text-fg-2">
          Show technical details
          <Switch
            aria-label="Show technical details"
            checked={technical}
            onCheckedChange={setTechnical}
          />
        </label>
      ) : null}
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        {groupByDay(events).map((group) => (
          <section
            aria-label={group.label}
            className="border-t border-line-subtle first:border-t-0"
            data-testid="activity-day"
            key={group.label}
          >
            <h3 className="border-b border-line-subtle bg-page/60 px-4 py-2 text-small font-semibold text-fg-2 sm:px-5">
              {group.label}
            </h3>
            <ul className="divide-y divide-line-subtle">
              {group.events.map((event) => (
                <ActivityRow event={event} key={event.id} notYou={notYou} technical={technical} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
            variant="outline"
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Show older activity'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

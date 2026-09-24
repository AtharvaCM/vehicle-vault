import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { format } from '@/lib/format';
import { cn } from '@/lib/utils';

import type { AuditEvent } from '../types/audit-event';
import { formatAuditAction, formatResourceType } from '../utils/format-audit-action';

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

type AuditEventRowProps = {
  event: AuditEvent;
};

export function AuditEventRow({ event }: AuditEventRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { label, tone } = formatAuditAction(event.action);
  const resourceLabel = formatResourceType(event.resourceType);
  const hasDetail =
    event.changedFields.length > 0 || Boolean(event.ipAddress) || Boolean(event.userAgent);

  return (
    <li className="rounded-xl border border-line/60 bg-surface">
      <button
        type="button"
        disabled={!hasDetail}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          // On a phone the timestamp goes under the chips: beside them it pushed the
          // row past the edge of the screen.
          'flex w-full flex-col gap-2 px-4 py-3 text-left sm:flex-row sm:items-start sm:gap-3',
          hasDetail ? 'cursor-pointer hover:bg-page/80' : 'cursor-default',
        )}
        aria-expanded={hasDetail ? expanded : undefined}
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone === 'neutral' ? 'neutral' : tone}>{label}</Badge>
            {resourceLabel ? (
              <span className="text-xs font-medium text-fg-3">{resourceLabel}</span>
            ) : null}
            {event.resourceId ? (
              <span className="font-mono text-caption text-fg-3">
                {event.resourceId.slice(0, 8)}
              </span>
            ) : null}
          </div>
          {event.changedFields.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {event.changedFields.map((field) => (
                <span
                  key={field}
                  className="rounded-md bg-brand-tint px-1.5 py-0.5 font-mono text-caption text-brand"
                >
                  {field}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          <time
            className="whitespace-nowrap text-xs tabular-nums text-fg-3"
            dateTime={event.occurredAt}
          >
            {format.date(event.occurredAt, 'dateTime')}
          </time>
          {hasDetail ? (
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-fg-3 transition-transform',
                expanded && 'rotate-180',
              )}
            />
          ) : null}
        </div>
      </button>

      {expanded && hasDetail ? (
        <div className="space-y-3 border-t border-line-subtle px-4 py-3">
          {event.changedFields.length > 0 ? (
            <dl className="space-y-2">
              {event.changedFields.map((field) => (
                <div
                  key={field}
                  className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-2 text-xs"
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
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-fg-3">
              {event.ipAddress ? <span>IP {event.ipAddress}</span> : null}
              {event.userAgent ? <span className="truncate">{event.userAgent}</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

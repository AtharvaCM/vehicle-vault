import { Link } from '@tanstack/react-router';
import { AlertTriangle, CheckCircle2, Clock, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Figure } from '@/components/shared/figure';
import { StatusDot, type Status } from '@/components/shared/status-pill';
import { cn } from '@/lib/utils';

import type { DashboardSummary } from '../types/dashboard';
import type { DashboardFocus } from '../types/dashboard-search';
import { formatRelativeDue } from '../utils/format-due';

type AttentionSummaryProps = {
  summary: DashboardSummary;
  focus?: DashboardFocus;
};

const TILE_BASE =
  'group flex flex-col gap-1.5 rounded-card border border-line bg-surface p-4 transition-colors hover:border-brand focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-5';
const TILE_ACTIVE = 'border-brand bg-brand-tint';

type TileBodyProps = {
  label: string;
  value: string;
  description: string;
};

function TileBody({ label, value, description }: TileBodyProps) {
  return <Figure hint={description} label={label} value={value} />;
}

type FocusTileProps = TileBodyProps & {
  focus: DashboardFocus;
  active: boolean;
};

function AttentionTile({ focus, active, ...body }: FocusTileProps) {
  return (
    <Link
      aria-current={active ? 'true' : undefined}
      className={cn(TILE_BASE, active && TILE_ACTIVE)}
      search={{ focus }}
      to="/dashboard"
    >
      <TileBody {...body} />
    </Link>
  );
}

function GarageTile(body: TileBodyProps) {
  return (
    <Link className={TILE_BASE} hash="garage" to="/dashboard">
      <TileBody {...body} />
    </Link>
  );
}

const BAND_ICON: Record<Status, LucideIcon> = {
  late: AlertTriangle,
  soon: Clock,
  ok: CheckCircle2,
  ended: CheckCircle2,
  draft: Clock,
  info: Clock,
};

/** The band's background tint per status; only late/soon/ok are used here. */
const BAND_TINT: Record<Status, string> = {
  late: 'bg-late-tint',
  soon: 'bg-soon-tint',
  ok: 'bg-ok-tint',
  ended: 'bg-page',
  draft: 'bg-page',
  info: 'bg-brand-tint',
};

type StatusBandProps = {
  status: Status;
  headline: string;
  subtext: string;
  aside: ReactNode;
};

function StatusBand({ status, headline, subtext, aside }: StatusBandProps) {
  const Icon = BAND_ICON[status];

  return (
    <div
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3',
        BAND_TINT[status],
      )}
      data-testid="status-band"
      role="status"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <StatusDot className="text-lead" status={status}>
          {headline}
        </StatusDot>
        <p className="truncate text-small text-fg-2">{subtext}</p>
      </div>
      <div className="hidden shrink-0 text-small text-fg-3 sm:block">{aside}</div>
    </div>
  );
}

/** "{title} · {relative} · {vehicleName}" — the band's one-line summary of an item. */
function itemLine(item: DashboardSummary['attention'][number]) {
  return `${item.title} · ${formatRelativeDue(item)} · ${item.vehicleName}`;
}

export function AttentionSummary({ summary, focus }: AttentionSummaryProps) {
  const counts = summary.attentionCounts;
  const vehicleCount = summary.vehicles.length;

  if (vehicleCount > 1 && counts.total > 0) {
    const dueThisWeek = counts.today + counts.thisWeek;

    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AttentionTile
          active={focus === 'overdue'}
          description="Past due or expired"
          focus="overdue"
          label="Late"
          value={String(counts.overdue)}
        />
        <AttentionTile
          active={focus === 'week'}
          description="Today through the next 7 days"
          focus="week"
          label="Due this week"
          value={String(dueThisWeek)}
        />
        <AttentionTile
          active={focus === 'documents'}
          description="Insurance, PUC, RC, road tax within 30 days"
          focus="documents"
          label="Papers running out"
          value={String(counts.documentsExpiring30d)}
        />
        <GarageTile
          description="Something overdue or due within 7 days"
          label="Vehicles needing you"
          // `urgentVehicles` is the headline's own count, so the two always agree.
          value={`${counts.urgentVehicles} of ${summary.vehiclesTotal}`}
        />
      </div>
    );
  }

  const aside = `${vehicleCount} vehicle${vehicleCount === 1 ? '' : 's'}`;

  if (counts.overdue > 0) {
    const worst = summary.attention[0];

    return (
      <StatusBand
        aside={aside}
        headline={`${counts.overdue} late`}
        status="late"
        subtext={worst ? itemLine(worst) : 'Past due or expired'}
      />
    );
  }

  const dueThisWeek = counts.today + counts.thisWeek;

  if (dueThisWeek > 0) {
    const first = summary.attention[0];

    return (
      <StatusBand
        aside={aside}
        headline={`${dueThisWeek} due this week`}
        status="soon"
        subtext={first ? itemLine(first) : 'Today through the next 7 days'}
      />
    );
  }

  const next = summary.attention.find((item) => item.urgency === 'this_month');

  return (
    <StatusBand
      aside={aside}
      headline="All clear"
      status="ok"
      subtext={
        next
          ? `Next up: ${next.title} · ${formatRelativeDue(next)}`
          : 'Nothing due in the next 30 days.'
      }
    />
  );
}

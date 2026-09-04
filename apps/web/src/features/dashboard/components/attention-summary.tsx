import { Link } from '@tanstack/react-router';
import { AlertTriangle, CheckCircle2, Clock, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

import type { DashboardSummary } from '../types/dashboard';
import type { DashboardFocus } from '../types/dashboard-search';
import { formatRelativeDue } from '../utils/format-due';

type AttentionSummaryProps = {
  summary: DashboardSummary;
  focus?: DashboardFocus;
};

type TileTone = 'danger' | 'warning' | 'neutral';

const TILE_VALUE_TONE: Record<TileTone, string> = {
  danger: 'text-rose-600',
  warning: 'text-amber-600',
  neutral: 'text-slate-900',
};

const TILE_BASE =
  'group flex flex-col gap-1.5 rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-premium-sm transition-colors hover:border-primary/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-5';
const TILE_ACTIVE = 'border-primary/40 bg-white ring-1 ring-primary/20';

type TileBodyProps = {
  label: string;
  value: string;
  description: string;
  tone: TileTone;
};

function TileBody({ label, value, description, tone }: TileBodyProps) {
  return (
    <>
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 transition-colors group-hover:text-slate-500">
        {label}
      </span>
      <span
        className={cn(
          'text-2xl font-bold tabular-nums tracking-tight sm:text-3xl',
          TILE_VALUE_TONE[tone],
        )}
      >
        {value}
      </span>
      <span className="text-[13px] leading-relaxed text-slate-500">{description}</span>
    </>
  );
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

type StatusBandTone = 'danger' | 'warning' | 'ok';

const BAND_STYLES: Record<StatusBandTone, { wrapper: string; icon: string; Icon: LucideIcon }> = {
  danger: {
    wrapper: 'border-rose-200 bg-rose-50 text-rose-900',
    icon: 'bg-rose-100 text-rose-700',
    Icon: AlertTriangle,
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: 'bg-amber-100 text-amber-700',
    Icon: Clock,
  },
  ok: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: 'bg-emerald-100 text-emerald-700',
    Icon: CheckCircle2,
  },
};

type StatusBandProps = {
  tone: StatusBandTone;
  headline: string;
  subtext: string;
  aside: ReactNode;
};

function StatusBand({ tone, headline, subtext, aside }: StatusBandProps) {
  const { wrapper, icon, Icon } = BAND_STYLES[tone];

  return (
    <div
      className={cn('flex w-full items-center gap-3 rounded-xl border px-4 py-3', wrapper)}
      data-testid="status-band"
      role="status"
    >
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', icon)}>
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold leading-tight">{headline}</p>
        <p className="truncate text-[13px] opacity-80">{subtext}</p>
      </div>
      <div className="hidden shrink-0 text-[13px] opacity-70 sm:block">{aside}</div>
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
          label="Overdue"
          tone={counts.overdue > 0 ? 'danger' : 'neutral'}
          value={String(counts.overdue)}
        />
        <AttentionTile
          active={focus === 'week'}
          description="Today through the next 7 days"
          focus="week"
          label="Due this week"
          tone={dueThisWeek > 0 ? 'warning' : 'neutral'}
          value={String(dueThisWeek)}
        />
        <AttentionTile
          active={focus === 'documents'}
          description="Insurance, PUC, RC, road tax within 30 days"
          focus="documents"
          label="Documents expiring"
          tone="neutral"
          value={String(counts.documentsExpiring30d)}
        />
        <GarageTile
          description="Something overdue or due soon"
          label="Vehicles needing attention"
          tone="neutral"
          value={`${counts.vehiclesNeedingAttention} of ${summary.vehiclesTotal}`}
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
        headline={`${counts.overdue} overdue`}
        subtext={worst ? itemLine(worst) : 'Past due or expired'}
        tone="danger"
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
        subtext={first ? itemLine(first) : 'Today through the next 7 days'}
        tone="warning"
      />
    );
  }

  const next = summary.attention.find((item) => item.urgency === 'this_month');

  return (
    <StatusBand
      aside={aside}
      headline="All clear"
      subtext={
        next
          ? `Next up: ${next.title} · ${formatRelativeDue(next)}`
          : 'Nothing due in the next 30 days.'
      }
      tone="ok"
    />
  );
}

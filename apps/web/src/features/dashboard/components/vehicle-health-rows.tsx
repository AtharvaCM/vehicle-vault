import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { StatusDot, dueStatus, type Status } from '@/components/shared/status-pill';
import type { VehicleDetailSearch } from '@/features/vehicles/types/vehicle-detail-search';
import { format } from '@/lib/format';

import type { DashboardDataGap, DashboardVehicleHealth } from '../types/dashboard';
import { describeVehicleDocuments } from '../utils/describe-vehicle-documents';
import { formatOdometerMeta, formatRelativeAgo, formatRelativeDue } from '../utils/format-due';
import { OdometerQuickUpdate } from './odometer-quick-update';

/**
 * The rows that say how one vehicle is doing: what is due next, its papers, its
 * last service, how complete its data is and when its odometer was read. Home's
 * garage card and the vehicle's Overview both show them, from the same
 * `DashboardVehicleHealth`, so the two never word a vehicle differently.
 */

/** `describeVehicleDocuments`'s tone, read as the shared status vocabulary. */
const DOCUMENT_STATUS: Record<'danger' | 'warning' | 'ok', Status> = {
  danger: 'late',
  warning: 'soon',
  ok: 'ok',
};

const INLINE_LINK =
  'rounded-sm hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring';

type MicroRowProps = {
  label: string;
  children: ReactNode;
};

export function MicroRow({ label, children }: MicroRowProps) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-small text-fg-2">{label}</p>
      <div className="min-w-0 truncate text-caption font-medium text-fg-2">{children}</div>
    </div>
  );
}

/**
 * How each gap in the vehicle's data reads, and where it is filled. The
 * odometer has no link: its Update control is on the row itself.
 */
const DATA_GAPS: Record<
  DashboardDataGap,
  { text: string; fill: VehicleDetailSearch | 'edit' | null }
> = {
  service_history: { text: 'Service history incomplete', fill: { tab: 'history' } },
  odometer: { text: 'Odometer not updated lately', fill: null },
  insurance: { text: 'No current insurance', fill: { tab: 'papers' } },
  catalog_link: { text: 'Not linked to a catalog model', fill: 'edit' },
  puc: { text: 'No current PUC', fill: { tab: 'papers' } },
  tyres: { text: 'Tyres not tracked', fill: { tab: 'more', section: 'tyres' } },
  purchase_price: { text: 'No purchase price', fill: 'edit' },
};

/** The score, and the one gap worth filling next: linked for someone who can fill it. */
function DataHealthText({
  vehicle,
  canEdit,
}: {
  vehicle: DashboardVehicleHealth;
  canEdit: boolean;
}) {
  const health = vehicle.dataHealth;
  if (!health) return null;

  if (health.nextGap === null) {
    return <span className="text-ok">Complete</span>;
  }

  const { text, fill } = DATA_GAPS[health.nextGap];
  let gap: ReactNode = <span>{text}</span>;
  if (canEdit && fill === 'edit') {
    gap = (
      <Link
        className={INLINE_LINK}
        params={{ vehicleId: vehicle.id }}
        to="/vehicles/$vehicleId/edit"
      >
        {text}
      </Link>
    );
  } else if (canEdit && fill !== null && fill !== 'edit') {
    gap = (
      <Link
        className={INLINE_LINK}
        params={{ vehicleId: vehicle.id }}
        search={fill}
        to="/vehicles/$vehicleId"
      >
        {text}
      </Link>
    );
  }

  return (
    <>
      <span className="tabular-nums">{health.score}%</span> · {gap}
    </>
  );
}

/** The next-due row's status, from the same day count its words are built from. */
export function nextDueStatus(
  nextDue: NonNullable<DashboardVehicleHealth['nextDue']>,
): Status | null {
  if (!nextDue.dueDate) return null;

  return dueStatus(nextDue.daysUntilDue, {
    mode: nextDue.kind === 'document' || nextDue.kind === 'accessory' ? 'ends' : 'due',
  });
}

export function nextDueText(nextDue: NonNullable<DashboardVehicleHealth['nextDue']>) {
  if (nextDue.kind === 'loan_emi' && nextDue.dueDate) {
    const relative = formatRelativeDue({
      kind: nextDue.kind,
      daysUntilDue: nextDue.daysUntilDue,
      dueDate: nextDue.dueDate,
    });

    return nextDue.amount !== undefined
      ? `EMI ${format.money(nextDue.amount)} · ${relative}`
      : `EMI · ${relative}`;
  }

  if (nextDue.dueDate) {
    const relative = formatRelativeDue({
      kind: nextDue.kind,
      daysUntilDue: nextDue.daysUntilDue,
      dueDate: nextDue.dueDate,
      dueOdometer: nextDue.dueOdometer,
    });

    // An odometer-triggered reminder can be overdue while its date is weeks away; keep the
    // km target visible so the status pill always has a visible cause.
    return nextDue.dueOdometer !== undefined
      ? `${nextDue.title} · ${relative} · ${formatOdometerMeta(nextDue.dueOdometer)}`
      : `${nextDue.title} · ${relative}`;
  }

  if (nextDue.dueOdometer !== undefined) {
    return `${nextDue.title} · ${formatOdometerMeta(nextDue.dueOdometer)}`;
  }

  return nextDue.title;
}

type RowProps = { vehicle: DashboardVehicleHealth };

export function NextDueRow({ vehicle }: RowProps) {
  const status = vehicle.nextDue ? nextDueStatus(vehicle.nextDue) : null;

  return (
    <MicroRow label="Next due">
      {vehicle.nextDue ? (
        status ? (
          <StatusDot status={status}>{nextDueText(vehicle.nextDue)}</StatusDot>
        ) : (
          <span>{nextDueText(vehicle.nextDue)}</span>
        )
      ) : (
        <span className="text-fg-3">Nothing scheduled</span>
      )}
    </MicroRow>
  );
}

export function PapersRow({ vehicle, today }: RowProps & { today?: Date }) {
  const documents = describeVehicleDocuments(vehicle, today);

  return (
    <MicroRow label="Papers">
      <Link
        className={INLINE_LINK}
        params={{ vehicleId: vehicle.id }}
        search={{ tab: 'papers' }}
        to="/vehicles/$vehicleId"
      >
        <StatusDot status={DOCUMENT_STATUS[documents.tone]}>{documents.text}</StatusDot>
      </Link>
    </MicroRow>
  );
}

export function LastServiceRow({ vehicle }: RowProps) {
  const kmSinceService = vehicle.lastService ? vehicle.odometer - vehicle.lastService.odometer : 0;

  return (
    <MicroRow label="Last service">
      {vehicle.lastService ? (
        <Link
          className={INLINE_LINK}
          params={{ recordId: vehicle.lastService.recordId }}
          to="/maintenance-records/$recordId"
        >
          Serviced {format.date(vehicle.lastService.serviceDate)}
          {kmSinceService > 0 ? ` · ${format.distance(kmSinceService)} ago` : ''}
        </Link>
      ) : (
        <span className="text-fg-3">No service logged</span>
      )}
    </MicroRow>
  );
}

export function DataRow({ vehicle, canEdit }: RowProps & { canEdit: boolean }) {
  if (!vehicle.dataHealth) return null;

  return (
    <MicroRow label="Data">
      <DataHealthText canEdit={canEdit} vehicle={vehicle} />
    </MicroRow>
  );
}

export function OdometerRow({
  vehicle,
  canEdit,
  today,
  bare = false,
}: RowProps & {
  canEdit: boolean;
  today?: Date;
  /** Without its label: under a reading that already says "Odometer". */
  bare?: boolean;
}) {
  const body = (
    <>
      Updated {formatRelativeAgo(vehicle.odometerUpdatedAt, today)}
      {canEdit ? (
        <>
          {' · '}
          <OdometerQuickUpdate
            displayName={vehicle.displayName}
            odometer={vehicle.odometer}
            vehicleId={vehicle.id}
          />
        </>
      ) : null}
    </>
  );

  return bare ? (
    <p className="text-caption font-medium text-fg-2">{body}</p>
  ) : (
    <MicroRow label="Odometer">{body}</MicroRow>
  );
}

import { Link } from '@tanstack/react-router';
import { ClipboardList } from 'lucide-react';
import { useMemo } from 'react';
import type { HistoryKind } from '@vehicle-vault/shared';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { Money } from '@/components/shared/money';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { VehiclePickerDialog } from '@/features/vehicles/components/vehicle-picker-dialog';
import { useVehicles } from '@/features/vehicles/hooks/use-vehicles';
import { format } from '@/lib/format';

import { HistoryFilters } from '../components/history-filters';
import { HistoryRow, type HistoryVehicle } from '../components/history-row';
import { useHistory } from '../hooks/use-history';
import type { HistorySearch } from '../types/history-search';
import { groupHistory, monthStart } from '../utils/group-history';

const TITLE = 'History';
const DESCRIPTION = 'Every service, fuel fill and odometer reading across your garage.';
const EMPTY_VEHICLES: HistoryVehicle[] = [];

type HistoryPageProps = {
  searchState: HistorySearch;
  onSearchStateChange: (next: Partial<HistorySearch>) => void;
};

function LogServiceButton({
  vehicles,
  isLoading,
  label = 'Log service',
}: {
  vehicles: HistoryVehicle[];
  isLoading: boolean;
  label?: string;
}) {
  return (
    <VehiclePickerDialog
      buildLink={(vehicleId) => ({
        to: '/vehicles/$vehicleId/maintenance/new',
        params: { vehicleId },
      })}
      dialogDescription="Choose which vehicle this service is for."
      dialogTitle="Log service"
      isLoading={isLoading}
      triggerLabel={label}
      vehicles={vehicles}
    />
  );
}

function draftsNotice(count: number) {
  return count === 1
    ? '1 service is a draft. It is marked below and left out of the totals until it is confirmed.'
    : `${count} services are drafts. They are marked below and left out of the totals until they are confirmed.`;
}

/**
 * The garage's timeline, newest first: service records, fuel fills and
 * odometer readings, grouped by month with each month's spend in its header.
 * Filters live in the URL. Older months load on request, a page at a time.
 */
export function HistoryPage({ searchState, onSearchStateChange }: HistoryPageProps) {
  const vehiclesQuery = useVehicles();
  const vehicles = vehiclesQuery.data ?? EMPTY_VEHICLES;
  // A vehicle filter that no longer matches a vehicle (unshared, deleted) is dropped
  // rather than sent: the API would refuse it. So a filtered page waits for the list.
  const vehicleId = vehicles.some((vehicle) => vehicle.id === searchState.vehicle)
    ? searchState.vehicle
    : undefined;
  const kind = searchState.kind;
  const historyQuery = useHistory(
    { vehicleId, kind },
    { enabled: !searchState.vehicle || !vehiclesQuery.isPending },
  );

  const vehicleById = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [vehicles],
  );
  const groups = useMemo(() => groupHistory(historyQuery.data?.pages ?? []), [historyQuery.data]);
  const draftCount = historyQuery.data?.pages[0]?.draftCount ?? 0;
  const isFiltered = Boolean(vehicleId || kind);
  const showVehicle = vehicles.length > 1;
  const logService = <LogServiceButton isLoading={vehiclesQuery.isPending} vehicles={vehicles} />;

  if (historyQuery.isPending || vehiclesQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle description={DESCRIPTION} title={TITLE} />
        <LoadingState
          description="Loading what was done across your garage."
          title="Loading history"
        />
      </PageContainer>
    );
  }

  if (historyQuery.isError || vehiclesQuery.isError) {
    return (
      <PageContainer>
        <PageTitle description={DESCRIPTION} title={TITLE} />
        <ErrorState
          action={
            <Button
              onClick={() => {
                void historyQuery.refetch();
                void vehiclesQuery.refetch();
              }}
              variant="secondary"
            >
              Retry
            </Button>
          }
          description="We couldn't load your history. Try again in a moment."
          title="Unable to load history"
        />
      </PageContainer>
    );
  }

  if (vehicles.length === 0) {
    return (
      <PageContainer>
        <PageTitle description={DESCRIPTION} title={TITLE} />
        <EmptyState
          action={
            <Link className={buttonVariants()} to="/vehicles/new">
              Add your first vehicle
            </Link>
          }
          description="Services, fuel fills and odometer readings show up here once a vehicle is in your garage."
          icon={ClipboardList}
          title="No vehicles yet"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle actions={logService} description={DESCRIPTION} title={TITLE} />

      <HistoryFilters
        kind={kind}
        onKindChange={(next: HistoryKind | undefined) => onSearchStateChange({ kind: next })}
        onVehicleChange={(next) => onSearchStateChange({ vehicle: next })}
        vehicleId={vehicleId}
        vehicles={vehicles}
      />

      {draftCount > 0 ? (
        <p
          className="rounded-card border border-soon/30 bg-soon-tint/70 px-4 py-3 text-small text-soon"
          data-testid="history-drafts"
        >
          {draftsNotice(draftCount)}
        </p>
      ) : null}

      {groups.length === 0 ? (
        isFiltered ? (
          <EmptyState
            action={
              <Button
                onClick={() => onSearchStateChange({ vehicle: undefined, kind: undefined })}
                variant="secondary"
              >
                Clear filters
              </Button>
            }
            description="Nothing logged matches these filters. Try another vehicle or kind."
            icon={ClipboardList}
            title="Nothing here"
          />
        ) : (
          <EmptyState
            action={
              <LogServiceButton
                isLoading={vehiclesQuery.isPending}
                label="Log your first service"
                vehicles={vehicles}
              />
            }
            description="Log a service or a fuel fill, or update an odometer, and it shows up here."
            icon={ClipboardList}
            title="Nothing logged yet"
          />
        )
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          {groups.map((group) => {
            const headingId = `history-${group.month}`;

            return (
              <section
                aria-labelledby={headingId}
                className="border-t border-line-subtle first:border-t-0"
                data-testid="history-month"
                key={group.month}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line-subtle bg-page/60 px-4 py-2.5 sm:px-5">
                  <h2 className="font-display text-lead font-semibold text-fg" id={headingId}>
                    {format.date(monthStart(group.month), 'monthYearLong')}
                  </h2>
                  <p className="text-small text-fg-2" data-testid="history-month-total">
                    {group.total !== null ? (
                      <>
                        Spent <Money className="font-semibold text-fg" value={group.total} />
                      </>
                    ) : null}
                    {group.total !== null && group.draftCount > 0 ? ' · ' : null}
                    {group.draftCount > 0
                      ? `${group.draftCount} draft${group.draftCount === 1 ? '' : 's'} not counted`
                      : null}
                  </p>
                </div>
                <ul className="divide-y divide-line-subtle">
                  {group.entries.map((entry) => (
                    <HistoryRow
                      entry={entry}
                      key={`${entry.kind}:${entry.id}`}
                      showVehicle={showVehicle}
                      vehicle={vehicleById.get(entry.vehicleId)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
          {historyQuery.hasNextPage ? (
            <div className="flex justify-center border-t border-line-subtle px-4 py-4">
              <Button
                disabled={historyQuery.isFetchingNextPage}
                onClick={() => void historyQuery.fetchNextPage()}
                type="button"
                variant="outline"
              >
                {historyQuery.isFetchingNextPage ? 'Loading older entries…' : 'Show older entries'}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </PageContainer>
  );
}

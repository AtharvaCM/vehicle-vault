import { Link } from '@tanstack/react-router';
import { ClipboardList, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { HistoryKind, HistoryPage } from '@vehicle-vault/shared';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { Money } from '@/components/shared/money';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { VehiclePickerDialog } from '@/features/vehicles/components/vehicle-picker-dialog';
import { useVehicles } from '@/features/vehicles/hooks/use-vehicles';

import { HistoryFilters } from '../components/history-filters';
import type { HistoryVehicle } from '../components/history-row';
import { HistorySearchBox } from '../components/history-search-box';
import { HistoryTimeline, selectableServiceIds } from '../components/history-timeline';
import { useHistory } from '../hooks/use-history';
import type { HistorySearch } from '../types/history-search';

const TITLE = 'History';
const DESCRIPTION = 'Every service, fuel fill, odometer reading and accessory across your garage.';
const EMPTY_VEHICLES: HistoryVehicle[] = [];

type HistoryPageProps = {
  searchState: HistorySearch;
  onSearchStateChange: (next: Partial<HistorySearch>) => void;
};

function LogServiceButton({
  vehicles,
  isLoading,
  label = 'Log service',
  className,
}: {
  vehicles: HistoryVehicle[];
  isLoading: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <VehiclePickerDialog
      buildLink={(vehicleId) => ({
        to: '/vehicles/$vehicleId/maintenance/new',
        params: { vehicleId },
      })}
      dialogDescription="Choose which vehicle this service is for."
      className={className}
      dialogTitle="Log service"
      isLoading={isLoading}
      triggerLabel={label}
      vehicles={vehicles}
    />
  );
}

/**
 * The page's one summary line: "₹15,200 on 3 services in 2026 · 1 draft to
 * confirm", the drafts linked to the one waiting longest. Services only, and
 * only while the kind filter includes them; the month headers carry the rest.
 */
function HistorySummary({ page }: { page: HistoryPage | undefined }) {
  const year = page?.year;
  const drafts = page?.draftCount ?? 0;
  if (!year && drafts === 0) return DESCRIPTION;

  const services =
    year && year.serviceCount > 0 ? (
      <>
        <Money className="font-semibold text-fg" value={Number(year.serviceSpend)} /> on{' '}
        {year.serviceCount} service{year.serviceCount === 1 ? '' : 's'} in {year.year}
      </>
    ) : year ? (
      `No services logged in ${year.year}`
    ) : null;
  const draftWords = `${drafts} draft${drafts === 1 ? '' : 's'} to confirm`;

  return (
    <span data-testid="history-summary">
      {services}
      {services && drafts > 0 ? ' · ' : null}
      {drafts > 0 ? (
        page?.firstDraftId ? (
          <Link
            className="font-medium text-soon underline-offset-2 hover:underline"
            params={{ recordId: page.firstDraftId }}
            to="/maintenance-records/$recordId/edit"
          >
            {draftWords} →
          </Link>
        ) : (
          <span className="font-medium text-soon">{draftWords}</span>
        )
      ) : null}
    </span>
  );
}

/** The vehicle and kind filters, and how many are set, for the phone's Filters button. */
function activeFilterCount(search: HistorySearch) {
  return Number(Boolean(search.vehicle)) + Number(Boolean(search.kind));
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
  const search = searchState.search;
  const historyQuery = useHistory(
    { vehicleId, kind, search },
    { enabled: !searchState.vehicle || !vehiclesQuery.isPending },
  );
  const [isSelecting, setIsSelecting] = useState(false);

  const vehicleById = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [vehicles],
  );
  const pages = historyQuery.data?.pages;
  const hasEntries = Boolean(pages?.some((page) => page.entries.length > 0));
  const canSelect = useMemo(
    () => selectableServiceIds(pages ?? [], vehicleById).length > 0,
    [pages, vehicleById],
  );
  const firstPage = pages?.[0];
  const isFiltered = Boolean(vehicleId || kind || search);
  const showVehicle = vehicles.length > 1;
  // From md up in the header; below it, pinned above the bottom bar instead.
  const logService = (
    <div className="hidden md:block">
      <LogServiceButton isLoading={vehiclesQuery.isPending} vehicles={vehicles} />
    </div>
  );
  // Only while there is a service the user may delete on screen; viewers never see it.
  const selectButton =
    canSelect || isSelecting ? (
      <Button
        aria-pressed={isSelecting}
        onClick={() => setIsSelecting((current) => !current)}
        type="button"
        variant="outline"
      >
        {isSelecting ? 'Done' : 'Select'}
      </Button>
    ) : null;
  const filters = (
    <HistoryFilters
      kind={kind}
      onKindChange={(next: HistoryKind | undefined) => onSearchStateChange({ kind: next })}
      onVehicleChange={(next) => onSearchStateChange({ vehicle: next })}
      vehicleId={vehicleId}
      vehicles={vehicles}
    />
  );
  const filterCount = activeFilterCount({ vehicle: vehicleId, kind });

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
    <PageContainer className="pb-24 md:pb-10">
      <PageTitle
        actions={
          <>
            {selectButton}
            {logService}
          </>
        }
        description={<HistorySummary page={firstPage} />}
        title={TITLE}
      />

      <HistorySearchBox onChange={(next) => onSearchStateChange({ search: next })} value={search} />
      <div className="hidden md:block">{filters}</div>
      <Sheet>
        <SheetTrigger asChild>
          <Button className="w-full md:hidden" type="button" variant="outline">
            <SlidersHorizontal aria-hidden="true" />
            {filterCount > 0 ? `Filters (${filterCount})` : 'Filters'}
          </Button>
        </SheetTrigger>
        <SheetContent
          className="rounded-t-sheet px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          side="bottom"
        >
          <SheetHeader className="text-left">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Which vehicle, and which kind of entry.</SheetDescription>
          </SheetHeader>
          <div className="mt-3">{filters}</div>
        </SheetContent>
      </Sheet>

      {/* The phone's Log service: pinned above the bottom bar, full width. */}
      <div
        data-testid="history-log-service"
        className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur-md md:hidden"
      >
        <LogServiceButton
          className="w-full"
          isLoading={vehiclesQuery.isPending}
          vehicles={vehicles}
        />
      </div>

      {!hasEntries ? (
        isFiltered ? (
          <EmptyState
            action={
              <Button
                onClick={() =>
                  onSearchStateChange({ vehicle: undefined, kind: undefined, search: undefined })
                }
                variant="secondary"
              >
                Clear filters
              </Button>
            }
            description={
              search
                ? `Nothing logged matches “${search}”. Try other words, or clear the filters.`
                : 'Nothing logged matches these filters. Try another vehicle or kind.'
            }
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
        <HistoryTimeline
          onSelectingDone={() => setIsSelecting(false)}
          query={historyQuery}
          selecting={isSelecting}
          showVehicle={showVehicle}
          vehicleById={vehicleById}
        />
      )}
    </PageContainer>
  );
}

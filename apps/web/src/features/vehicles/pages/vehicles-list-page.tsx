import { Link } from '@tanstack/react-router';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';

import { useVehicles } from '../hooks/use-vehicles';
import { VehicleList } from '../components/vehicle-list';

export function VehiclesListPage() {
  const vehiclesQuery = useVehicles();

  return (
    <PageContainer>
      <PageTitle
        actions={
          <Link className={buttonVariants()} to="/vehicles/new">
            Add Vehicle
          </Link>
        }
        description="Manage the vehicles that anchor maintenance history, reminders, and receipts across the product."
        title="Vehicles"
      />

      {vehiclesQuery.isPending ? (
        <LoadingState
          description="Fetching vehicle records from the API."
          title="Loading vehicles"
        />
      ) : vehiclesQuery.isError ? (
        <ErrorState
          action={
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => vehiclesQuery.refetch()} variant="secondary">
                Retry
              </Button>
              <Link className={buttonVariants()} to="/vehicles/new">
                Add Vehicle
              </Link>
            </div>
          }
          description="The vehicle list could not be loaded. Make sure the API is running and reachable from the frontend."
          title="Unable to load vehicles"
        />
      ) : vehiclesQuery.data.length ? (
        <VehicleList vehicles={vehiclesQuery.data} />
      ) : (
        <EmptyState
          action={
            <Link className={buttonVariants()} to="/vehicles/new">
              Add your first vehicle
            </Link>
          }
          description="No vehicles exist yet. Create the first one to start the maintenance workflow."
          title="No vehicles yet"
        />
      )}
    </PageContainer>
  );
}

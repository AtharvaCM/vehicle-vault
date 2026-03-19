import { Link } from '@tanstack/react-router';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
        description="Use the vehicles feature to keep list, detail, and maintenance concerns grouped around the vehicle domain."
        title="Vehicles"
      />

      {vehiclesQuery.isPending ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading vehicles</CardTitle>
            <CardDescription>Fetching vehicle records from the API.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Please wait while the current vehicle list loads.
          </CardContent>
        </Card>
      ) : vehiclesQuery.isError ? (
        <EmptyState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles/new">
              Add vehicle anyway
            </Link>
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

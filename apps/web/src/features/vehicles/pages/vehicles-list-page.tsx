import { Link } from '@tanstack/react-router';
import { FuelType } from '@vehicle-vault/shared';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';

import { VehicleList } from '../components/vehicle-list';

const vehicles = [
  {
    id: 'vehicle-1',
    registrationNumber: 'MH12AB1234',
    make: 'Hyundai',
    model: 'Creta',
    variant: 'SX',
    year: 2022,
    fuelType: FuelType.Petrol,
    odometer: 18240,
    lastServiceDate: '2026-02-14',
  },
  {
    id: 'vehicle-2',
    registrationNumber: 'KA03CD4567',
    make: 'Tata',
    model: 'Nexon EV',
    variant: 'Empowered',
    year: 2024,
    fuelType: FuelType.Electric,
    odometer: 6240,
    lastServiceDate: '2026-01-20',
  },
];

export function VehiclesListPage() {
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

      {vehicles.length ? (
        <VehicleList vehicles={vehicles} />
      ) : (
        <EmptyState
          action={
            <Link className={buttonVariants()} to="/vehicles/new">
              Add your first vehicle
            </Link>
          }
          description="Vehicles will appear here once records are connected to the backend."
          title="No vehicles yet"
        />
      )}
    </PageContainer>
  );
}

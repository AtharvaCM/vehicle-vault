import { Link } from '@tanstack/react-router';
import { MaintenanceCategory } from '@vehicle-vault/shared';

import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { MaintenanceList } from '../components/maintenance-list';

type VehicleMaintenanceListPageProps = {
  vehicleId: string;
};

const maintenanceItems = [
  {
    id: 'maintenance-1',
    category: MaintenanceCategory.OilChange,
    serviceDate: '2026-02-14',
    workshopName: 'City Hyundai Service',
    totalCost: 7800,
    odometer: 17600,
  },
  {
    id: 'maintenance-2',
    category: MaintenanceCategory.Brakes,
    serviceDate: '2025-11-09',
    workshopName: 'Brake Point Garage',
    totalCost: 5400,
    odometer: 14800,
  },
];

export function VehicleMaintenanceListPage({ vehicleId }: VehicleMaintenanceListPageProps) {
  return (
    <PageContainer>
      <PageTitle
        actions={
          <Link
            className={buttonVariants()}
            params={{ vehicleId }}
            to="/vehicles/$vehicleId/maintenance/new"
          >
            Add Maintenance
          </Link>
        }
        description="Maintenance history belongs under the maintenance feature even when entered from a vehicle context."
        title="Maintenance"
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <MaintenanceList items={maintenanceItems} />

        <Card>
          <CardHeader>
            <CardTitle>Upcoming enhancements</CardTitle>
            <CardDescription>Suggested additions for the maintenance domain.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>Filter by category, date range, and odometer bands.</p>
            <p>Attach invoices or service documents to each record.</p>
            <p>Link reminders to maintenance recurrence rules.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

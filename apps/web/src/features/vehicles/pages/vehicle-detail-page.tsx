import { Link } from '@tanstack/react-router';
import { FuelType } from '@vehicle-vault/shared';

import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

type VehicleDetailPageProps = {
  vehicleId: string;
};

const recentActivity = [
  {
    id: 'activity-1',
    title: 'Periodic service logged',
    date: '2026-03-01',
    amount: 7800,
  },
  {
    id: 'activity-2',
    title: 'Insurance renewal reminder scheduled',
    date: '2026-02-10',
    amount: 0,
  },
];

export function VehicleDetailPage({ vehicleId }: VehicleDetailPageProps) {
  const vehicle = {
    id: vehicleId,
    registrationNumber: 'MH12AB1234',
    make: 'Hyundai',
    model: 'Creta',
    variant: 'SX',
    year: 2022,
    fuelType: FuelType.Petrol,
    odometer: 18240,
  };

  return (
    <PageContainer>
      <PageTitle
        actions={
          <Link
            className={buttonVariants({ variant: 'secondary' })}
            params={{ vehicleId }}
            to="/vehicles/$vehicleId/maintenance"
          >
            View Maintenance
          </Link>
        }
        description="Vehicle detail pages should become the entry point for documents, maintenance, reminders, and timeline activity tied to one vehicle."
        title={`${vehicle.make} ${vehicle.model}`}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle>Vehicle summary</CardTitle>
              <Badge tone="accent">{vehicle.fuelType}</Badge>
            </div>
            <CardDescription>
              {vehicle.registrationNumber} • {vehicle.variant} • {vehicle.year}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
            <p>Vehicle ID: {vehicle.id}</p>
            <p>Odometer: {vehicle.odometer.toLocaleString('en-IN')} km</p>
            <p>Next expansion: reminders and attachment counts</p>
            <p>Recommended relation: maintenance, reminders, attachments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Placeholder timeline content to show how domain sections fit the detail view.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.map((activity) => (
              <div
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                key={activity.id}
              >
                <p className="font-medium text-slate-900">{activity.title}</p>
                <p className="mt-1 text-slate-600">
                  {formatDate(activity.date)} •{' '}
                  {activity.amount ? formatCurrency(activity.amount) : 'No direct cost'}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

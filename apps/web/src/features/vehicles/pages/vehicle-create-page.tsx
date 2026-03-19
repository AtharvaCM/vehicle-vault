import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { VehicleForm } from '../components/vehicle-form';

export function VehicleCreatePage() {
  return (
    <PageContainer>
      <PageTitle
        description="Start with a lightweight form scaffold. Keep domain validation inside the vehicles feature and wire submission through feature-local mutations later."
        title="Add Vehicle"
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <VehicleForm />

        <Card>
          <CardHeader>
            <CardTitle>Implementation notes</CardTitle>
            <CardDescription>Recommended next steps for this form.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>
              Move submission into a vehicle creation mutation once the API contract stabilizes.
            </p>
            <p>
              Add registration uniqueness checks after the backend exposes validation endpoints.
            </p>
            <p>
              Attach shared enums or schemas only when the shape is truly shared across clients.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

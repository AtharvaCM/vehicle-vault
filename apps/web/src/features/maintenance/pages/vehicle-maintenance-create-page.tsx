import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { MaintenanceForm } from '../components/maintenance-form';

type VehicleMaintenanceCreatePageProps = {
  vehicleId: string;
};

export function VehicleMaintenanceCreatePage({ vehicleId }: VehicleMaintenanceCreatePageProps) {
  return (
    <PageContainer>
      <PageTitle
        description="Use a dedicated maintenance form component so create and edit flows can share validation, input rendering, and mutation wiring."
        title="Add Maintenance Record"
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <MaintenanceForm vehicleId={vehicleId} />

        <Card>
          <CardHeader>
            <CardTitle>Data model notes</CardTitle>
            <CardDescription>
              Keep this form focused on maintenance-specific concerns.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>Store attachments separately so invoice uploads do not bloat form state.</p>
            <p>
              Keep reminder creation optional and model it as a follow-up action once APIs exist.
            </p>
            <p>Normalize workshop entities later if cross-vehicle reporting matters.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

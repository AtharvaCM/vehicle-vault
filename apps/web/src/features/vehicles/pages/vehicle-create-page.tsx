import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ServiceSchedulePanel } from '@/features/reminders/components/service-schedule-panel';
import { useCatalogIntentPrefill } from '@/features/catalog-intent/hooks/use-catalog-intent-prefill';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

import { VehicleForm } from '../components/vehicle-form';
import { VehicleSetupPrompt } from '../components/vehicle-setup-prompt';
import { useCreateVehicle } from '../hooks/use-create-vehicle';
import { useVehicles } from '../hooks/use-vehicles';
import type { VehicleFormValues } from '../schemas/vehicle-form.schema';
import type { Vehicle } from '../types/vehicle';

export function VehicleCreatePage() {
  const navigate = useNavigate();
  const { catalog } = useSearch({ from: '/app/vehicles/new' });
  const catalogIntent = useCatalogIntentPrefill(catalog);
  const [isDirty, setIsDirty] = useState(false);
  // Set the moment the vehicle is saved: from then on the page shows the
  // papers step for it instead of the form, and there is nothing left to lose
  // by leaving, so the unsaved-changes guard below drops out.
  const [createdVehicle, setCreatedVehicle] = useState<Vehicle | null>(null);
  // After the papers, the suggested service schedule (#346).
  const [step, setStep] = useState<'papers' | 'schedule'>('papers');
  // The garage before this vehicle: an account's first vehicle ends its setup on
  // Home, where the checklist picks up; any later one opens its own page.
  const vehiclesQuery = useVehicles();
  const [isFirstVehicle, setIsFirstVehicle] = useState(false);
  const createVehicleMutation = useCreateVehicle();
  useUnsavedChangesGuard({
    when: isDirty && !createdVehicle,
    message: 'You have unsaved vehicle changes. Leave without saving?',
  });

  async function handleCreateVehicle(values: VehicleFormValues) {
    const prefill = catalogIntent.status === 'ready' ? catalogIntent.values : null;
    // Still the vehicle the intent named: re-picking the make or model makes it
    // a vehicle the visitor chose by hand.
    const fromCatalogIntent =
      prefill !== null && values.make === prefill.make && values.model === prefill.model;

    const firstVehicle = vehiclesQuery.data?.length === 0;
    try {
      const vehicle = await createVehicleMutation.mutateAsync({
        ...values,
        ...(fromCatalogIntent ? { fromCatalogIntent: true } : {}),
      });

      setIsFirstVehicle(firstVehicle);

      // `null` is a fresh vehicle, never answered or skipped. `undefined` is an
      // API that predates the prompt and cannot save an answer to it either,
      // so there is nothing to ask: on to the schedule.
      setStep(vehicle.setupPromptDismissedAt === null ? 'papers' : 'schedule');
      setCreatedVehicle(vehicle);
    } catch (error) {
      appToast.error({
        title: 'Unable to create vehicle',
        description: getApiErrorMessage(error, 'Unable to create the vehicle.'),
      });
      throw error;
    }
  }

  async function goToVehicle(vehicle: Vehicle) {
    try {
      await navigate({
        to: '/vehicles/$vehicleId',
        params: {
          vehicleId: vehicle.id,
        },
      });
    } catch (error) {
      appToast.error({
        title: 'Could not open the vehicle',
        description: getApiErrorMessage(error, 'Find it from Garage instead.'),
      });
    }
  }

  const submitError = createVehicleMutation.error
    ? getApiErrorMessage(createVehicleMutation.error, 'Unable to create the vehicle.')
    : null;

  if (createdVehicle && step === 'papers') {
    return (
      <PageContainer>
        <PageTitle
          description="Saved. Next, the two dates the reminders run on."
          title="Add vehicle"
        />
        <SetupSteps current="papers" />
        <div className="max-w-xl">
          <VehicleSetupPrompt
            dismissedAt={createdVehicle.setupPromptDismissedAt}
            fuelType={createdVehicle.fuelType}
            onDismissed={() => setStep('schedule')}
            vehicleId={createdVehicle.id}
          />
        </div>
      </PageContainer>
    );
  }

  if (createdVehicle) {
    return (
      <PageContainer>
        <PageTitle
          actions={
            // An account's first vehicle ends on Home, where its setup checklist
            // picks up; the vehicle's own page is always one tap away too.
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void goToVehicle(createdVehicle)}
                type="button"
                variant={isFirstVehicle ? 'outline' : 'default'}
              >
                Open the vehicle
              </Button>
              {isFirstVehicle ? (
                <Button onClick={() => void navigate({ to: '/home' })} type="button">
                  Go to Home
                  <ArrowRight aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          }
          description="Pick the services to be reminded about. You can change them any time."
          title="Add vehicle"
        />
        <SetupSteps current="schedule" />
        <div className="max-w-3xl">
          <ServiceSchedulePanel vehicleId={createdVehicle.id} />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle
        description="Add a car or bike so you can track its service, reminders, and documents."
        title="Add vehicle"
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {catalogIntent.status === 'resolving' ? (
          <LoadingState
            description="Filling in the vehicle you picked from the catalog."
            title="Loading vehicle"
          />
        ) : (
          <VehicleForm
            initialValues={catalogIntent.status === 'ready' ? catalogIntent.values : undefined}
            isSubmitting={createVehicleMutation.isPending}
            mode="create"
            onDirtyChange={setIsDirty}
            onSubmit={handleCreateVehicle}
            submitError={submitError}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>What to add first</CardTitle>
            <CardDescription>
              A few accurate basics make every later record easier to trust.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-ui leading-6 text-fg-2">
            <p>
              Start with the current odometer so future due dates and due kilometres stay realistic.
            </p>
            <p>Use a nickname if you manage similar vehicles or a family garage.</p>
            <p>
              Once saved, a short step asks for the insurance and PUC dates, then you&apos;re in.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

const STEPS = [
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'papers', label: 'Papers' },
  { id: 'schedule', label: 'Service schedule' },
] as const;

/** Where the add-vehicle flow is: vehicle, then papers, then the schedule. */
function SetupSteps({ current }: { current: 'papers' | 'schedule' }) {
  const currentIndex = STEPS.findIndex((item) => item.id === current);
  return (
    <ol aria-label="Steps" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-small">
      {STEPS.map((item, index) => (
        <li
          aria-current={index === currentIndex ? 'step' : undefined}
          className={
            index === currentIndex
              ? 'flex items-center gap-1.5 font-semibold text-fg'
              : 'flex items-center gap-1.5 text-fg-3'
          }
          key={item.id}
        >
          <span
            aria-hidden="true"
            className={
              index < currentIndex
                ? 'flex size-5 items-center justify-center rounded-full bg-ok text-surface'
                : 'flex size-5 items-center justify-center rounded-full border border-current text-caption'
            }
          >
            {index < currentIndex ? <Check className="size-3" /> : index + 1}
          </span>
          {item.label}
        </li>
      ))}
    </ol>
  );
}

import type { DashboardSummary } from '@vehicle-vault/shared';

export type SetupStepId = 'account' | 'vehicle' | 'papers' | 'service' | 'email';

export type SetupStep = { id: SetupStepId; done: boolean };

/**
 * How far a new account is from its first live reminder (#346), from what Home
 * already loads. Papers count as done once a vehicle has an insurance expiry
 * and, unless it is exempt, a PUC one; a service once any is logged.
 */
export function setupSteps(
  summary: Pick<DashboardSummary, 'totalVehicles' | 'totalMaintenanceRecords' | 'vehicles'>,
  emailVerified: boolean,
): SetupStep[] {
  const papers = summary.vehicles.some(
    (vehicle) =>
      vehicle.documents.insurance !== undefined &&
      vehicle.documents.insurance.state !== 'missing' &&
      vehicle.documents.puc?.state !== 'missing',
  );
  return [
    { id: 'account', done: true },
    { id: 'vehicle', done: summary.totalVehicles > 0 },
    { id: 'papers', done: papers },
    {
      id: 'service',
      done:
        summary.totalMaintenanceRecords > 0 ||
        summary.vehicles.some((vehicle) => vehicle.lastService !== null),
    },
    { id: 'email', done: emailVerified },
  ];
}

export function isSetupDone(steps: SetupStep[]) {
  return steps.every((step) => step.done);
}

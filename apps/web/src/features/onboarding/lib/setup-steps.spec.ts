import type { DashboardVehicleHealth } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { isSetupDone, setupSteps } from './setup-steps';

type Docs = DashboardVehicleHealth['documents'];

function vehicle(documents: Docs, lastService: DashboardVehicleHealth['lastService'] = null) {
  return { documents, lastService } as DashboardVehicleHealth;
}

const ACTIVE = { state: 'active' as const, endDate: '2027-01-01' };
const MISSING = { state: 'missing' as const, endDate: null };

function done(steps: ReturnType<typeof setupSteps>) {
  return Object.fromEntries(steps.map((step) => [step.id, step.done]));
}

describe('setupSteps', () => {
  it('has only the account done for a new, unverified account', () => {
    const steps = setupSteps({ totalVehicles: 0, totalMaintenanceRecords: 0, vehicles: [] }, false);

    expect(done(steps)).toEqual({
      account: true,
      vehicle: false,
      papers: false,
      service: false,
      email: false,
    });
    expect(isSetupDone(steps)).toBe(false);
  });

  it('counts papers once a vehicle has insurance and a PUC, or needs no PUC', () => {
    const noPuc = setupSteps(
      {
        totalVehicles: 1,
        totalMaintenanceRecords: 0,
        vehicles: [vehicle({ insurance: ACTIVE, puc: MISSING })],
      },
      true,
    );
    expect(done(noPuc).papers).toBe(false);

    const both = setupSteps(
      {
        totalVehicles: 1,
        totalMaintenanceRecords: 0,
        vehicles: [vehicle({ insurance: ACTIVE, puc: ACTIVE })],
      },
      true,
    );
    expect(done(both).papers).toBe(true);

    // An electric vehicle has no PUC row at all.
    const electric = setupSteps(
      { totalVehicles: 1, totalMaintenanceRecords: 0, vehicles: [vehicle({ insurance: ACTIVE })] },
      true,
    );
    expect(done(electric).papers).toBe(true);
  });

  it('is done once there is a vehicle, its papers, a service and a verified email', () => {
    const steps = setupSteps(
      {
        totalVehicles: 1,
        totalMaintenanceRecords: 1,
        vehicles: [vehicle({ insurance: ACTIVE, puc: ACTIVE })],
      },
      true,
    );

    expect(isSetupDone(steps)).toBe(true);
  });
});

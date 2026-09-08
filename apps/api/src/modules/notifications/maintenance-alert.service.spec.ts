import { TyrePosition, type TyreCondition } from '@vehicle-vault/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MaintenanceAlertService } from './maintenance-alert.service';
import type { VehicleTyreAlertState } from '../tyres/tyres.service';

const NOW = new Date('2026-09-08T06:00:00.000Z');

const VEHICLE = {
  id: 'v1',
  userId: 'u1',
  year: 2024,
  odometer: 40_000,
  maintenanceRecords: [],
};

function condition(overrides: Partial<TyreCondition>): TyreCondition {
  return {
    tyreId: 'tyre-1',
    position: TyrePosition.FrontLeft,
    level: 'healthy',
    reason: 'none',
    summary: '5.0 mm remaining.',
    treadDepthMm: 5,
    ageYears: 2,
    kmOnTyre: 8_000,
    estimatedKmRemaining: null,
    lastInspectedAt: null,
    ...overrides,
  };
}

describe('MaintenanceAlertService tyre checks', () => {
  let service: MaintenanceAlertService;

  const prisma = {
    vehicle: { findUnique: vi.fn() },
    reminder: { findMany: vi.fn() },
  };
  const insights = { getOdometerInsights: vi.fn() };
  const notify = { raise: vi.fn() };
  const documents = { findExpiring: vi.fn() };
  const intervals = { resolveForVehicle: vi.fn() };
  const accessories = { findExpiringWarranties: vi.fn() };
  const tyres = { getAlertState: vi.fn() };

  /** Only the tyre alerts, so an unrelated engine change cannot quietly pass these. */
  const tyreAlerts = () =>
    notify.raise.mock.calls
      .filter(([, , kind]) => String(kind).startsWith('tyre-'))
      .map(([, , kind, payload]) => ({ kind, payload }));

  const alertState = (overrides: Partial<VehicleTyreAlertState>): VehicleTyreAlertState => ({
    vehicleOdometer: 40_000,
    conditions: [],
    lastObservation: { at: new Date('2026-09-01T00:00:00.000Z'), odometer: 39_800 },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    prisma.vehicle.findUnique.mockResolvedValue(VEHICLE);
    prisma.reminder.findMany.mockResolvedValue([]);
    insights.getOdometerInsights.mockResolvedValue({ currentOdometerPredicted: 40_000 });
    // Emptied so the tyre assertions below are not entangled with service-interval maths.
    intervals.resolveForVehicle.mockResolvedValue({});
    documents.findExpiring.mockResolvedValue([]);
    accessories.findExpiringWarranties.mockResolvedValue([]);
    tyres.getAlertState.mockResolvedValue(alertState({}));

    service = new MaintenanceAlertService(
      prisma as never,
      insights as never,
      notify as never,
      documents as never,
      intervals as never,
      accessories as never,
      tyres as never,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('raises nothing while the tyres are healthy and recently measured', async () => {
    tyres.getAlertState.mockResolvedValue(alertState({ conditions: [condition({})] }));

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([]);
  });

  it('raises a worn tyre from the resolver’s verdict', async () => {
    tyres.getAlertState.mockResolvedValue(
      alertState({
        conditions: [
          condition({
            level: 'illegal',
            reason: 'tread',
            summary: '1.4 mm tread — below the 1.6 mm legal minimum. Not roadworthy.',
            treadDepthMm: 1.4,
          }),
        ],
      }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([
      {
        kind: 'tyre-worn',
        payload: expect.objectContaining({
          tyreId: 'tyre-1',
          level: 'illegal',
          treadDepthMm: 1.4,
        }),
      },
    ]);
  });

  it('raises an aged tyre that no odometer would ever flag', async () => {
    tyres.getAlertState.mockResolvedValue(
      alertState({
        conditions: [
          condition({
            level: 'replace',
            reason: 'age',
            ageYears: 6.4,
            summary: '6.4 years old — rubber degrades with age regardless of tread left.',
          }),
        ],
      }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([
      { kind: 'tyre-aged', payload: expect.objectContaining({ level: 'replace', ageYears: 6.4 }) },
    ]);
  });

  it('says nothing about a tyre nobody has measured', async () => {
    // `unknown` is the absence of a reading. Calling it worn would invent one;
    // the inspection prompt is the honest answer, and it fires below.
    tyres.getAlertState.mockResolvedValue(
      alertState({
        conditions: [condition({ level: 'unknown', reason: 'none' })],
        lastObservation: { at: new Date('2026-09-01T00:00:00.000Z'), odometer: 39_800 },
      }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([]);
  });

  it('asks a well-travelled vehicle with no tyre records to enter them', async () => {
    // The case that let a 40 000 km bike wear its tyres to the cords in silence.
    tyres.getAlertState.mockResolvedValue(alertState({ conditions: [], lastObservation: null }));

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([
      {
        kind: 'tyre-uninspected',
        payload: expect.objectContaining({ reason: 'untracked', odometer: 40_000 }),
      },
    ]);
  });

  it('leaves a young, barely used vehicle alone', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({ ...VEHICLE, odometer: 1_200 });
    tyres.getAlertState.mockResolvedValue(
      alertState({ vehicleOdometer: 1_200, conditions: [], lastObservation: null }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([]);
  });

  it('still asks an old low-mileage vehicle, because rubber ages while parked', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({ ...VEHICLE, year: 2015, odometer: 1_200 });
    tyres.getAlertState.mockResolvedValue(
      alertState({ vehicleOdometer: 1_200, conditions: [], lastObservation: null }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([
      { kind: 'tyre-uninspected', payload: expect.objectContaining({ reason: 'untracked' }) },
    ]);
  });

  it('asks for a fresh reading once the last one is too many kilometres old', async () => {
    tyres.getAlertState.mockResolvedValue(
      alertState({
        conditions: [condition({})],
        lastObservation: { at: new Date('2026-08-20T00:00:00.000Z'), odometer: 33_500 },
      }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([
      {
        kind: 'tyre-uninspected',
        payload: expect.objectContaining({
          reason: 'stale',
          kmSinceLastCheck: 6_500,
          daysSinceLastCheck: 19,
        }),
      },
    ]);
  });

  it('asks for a fresh reading on a vehicle that has barely moved but sat for months', async () => {
    // Distance alone would never catch this one, and a tyre degrades anyway.
    tyres.getAlertState.mockResolvedValue(
      alertState({
        conditions: [condition({})],
        lastObservation: { at: new Date('2025-11-01T00:00:00.000Z'), odometer: 39_950 },
      }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([
      {
        kind: 'tyre-uninspected',
        payload: expect.objectContaining({ reason: 'stale', kmSinceLastCheck: 50 }),
      },
    ]);
  });

  it('has nothing to ask of a vehicle carrying only a spare', async () => {
    // No road tyre means no distance to measure staleness against, and the
    // "untracked" wording would be a lie — tyres are recorded.
    tyres.getAlertState.mockResolvedValue(
      alertState({
        conditions: [condition({ position: TyrePosition.Spare })],
        lastObservation: null,
      }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([]);
  });
});

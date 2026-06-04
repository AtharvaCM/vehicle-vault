import { Prisma } from '@prisma/client';
import { FuelType, VehicleType, MaintenanceCategory } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResaleReportService } from './resale-report.service';

function makeVehicle(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'vehicle-1',
    userId: 'user-1',
    make: 'Hyundai',
    model: 'Creta',
    variant: 'SX',
    year: 2022,
    registrationNumber: 'MH12 AB 1234',
    fuelType: FuelType.Petrol,
    vehicleType: VehicleType.Car,
    odometer: 25000,
    nickname: null,
    purchaseDate: new Date('2022-01-15T00:00:00.000Z'),
    purchasePrice: new Prisma.Decimal('850000.00'),
    purchaseOdometer: 0,
    ...over,
  };
}

describe('ResaleReportService.buildPdf', () => {
  const prisma = {
    vehicle: { findFirst: vi.fn() },
    maintenanceRecord: { findMany: vi.fn() },
    fuelLog: { findMany: vi.fn() },
    insurancePolicy: { findMany: vi.fn() },
    claim: { findMany: vi.fn() },
    vehicleLoan: { findMany: vi.fn() },
    reminder: { findMany: vi.fn() },
  };

  let service: ResaleReportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ResaleReportService(prisma as never);
    prisma.maintenanceRecord.findMany.mockResolvedValue([]);
    prisma.fuelLog.findMany.mockResolvedValue([]);
    prisma.insurancePolicy.findMany.mockResolvedValue([]);
    prisma.claim.findMany.mockResolvedValue([]);
    prisma.vehicleLoan.findMany.mockResolvedValue([]);
    prisma.reminder.findMany.mockResolvedValue([]);
  });

  it('returns a PDF buffer named with the registration number', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(makeVehicle());
    prisma.maintenanceRecord.findMany.mockResolvedValue([
      {
        id: 'r1',
        vehicleId: 'vehicle-1',
        serviceDate: new Date('2024-06-12T00:00:00.000Z'),
        odometer: 18000,
        category: MaintenanceCategory.EngineOil,
        workshopName: 'Trusted Garage',
        totalCost: new Prisma.Decimal('2499.00'),
      },
    ]);

    const result = await service.buildPdf('user-1', 'vehicle-1');

    expect(result.buffer.slice(0, 5).toString()).toBe('%PDF-');
    expect(result.buffer.length).toBeGreaterThan(500);
    expect(result.fileName).toMatch(/^resale-report-MH12AB1234-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('throws NotFound when vehicle is not owned by user', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(null);
    await expect(service.buildPdf('user-1', 'v-missing')).rejects.toMatchObject({ status: 404 });
  });

  it('builds without error when an active loan exists', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(makeVehicle());
    prisma.vehicleLoan.findMany.mockResolvedValue([
      {
        id: 'loan-1',
        vehicleId: 'vehicle-1',
        lender: 'HDFC Bank',
        principal: new Prisma.Decimal('500000.00'),
        interestRate: new Prisma.Decimal('9.000'),
        tenureMonths: 60,
        startDate: new Date('2023-01-01T00:00:00.000Z'),
        emiAmount: new Prisma.Decimal('10379.00'),
        status: 'active',
        closedAt: null,
        prepayments: [],
      },
    ]);

    const result = await service.buildPdf('user-1', 'vehicle-1');
    expect(result.buffer.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('builds without error when a closed loan exists', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(makeVehicle());
    prisma.vehicleLoan.findMany.mockResolvedValue([
      {
        id: 'loan-1',
        vehicleId: 'vehicle-1',
        lender: 'HDFC Bank',
        principal: new Prisma.Decimal('500000.00'),
        interestRate: new Prisma.Decimal('9.000'),
        tenureMonths: 60,
        startDate: new Date('2020-01-01T00:00:00.000Z'),
        emiAmount: new Prisma.Decimal('10379.00'),
        status: 'closed',
        closedAt: new Date('2023-06-01T00:00:00.000Z'),
        prepayments: [],
      },
    ]);

    const result = await service.buildPdf('user-1', 'vehicle-1');
    expect(result.buffer.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('builds without error with overdue reminders', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(makeVehicle());
    prisma.reminder.findMany.mockResolvedValue([
      {
        id: 'rem-1',
        vehicleId: 'vehicle-1',
        title: 'Engine oil change',
        type: 'service',
        dueDate: new Date('2024-01-01T00:00:00.000Z'),
        dueOdometer: null,
        status: 'overdue',
      },
    ]);

    const result = await service.buildPdf('user-1', 'vehicle-1');
    expect(result.buffer.slice(0, 5).toString()).toBe('%PDF-');
  });
});

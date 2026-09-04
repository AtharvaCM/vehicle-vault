/**
 * Dev-only demo data: a signed-up user with a few vehicles across every
 * dashboard state (overdue, due today, expiring soon, all clear, an active
 * loan, a stale odometer) so the triage dashboard has something real to look
 * at locally instead of an empty garage. Every date is relative to "now", so
 * re-running the seed keeps the data fresh no matter when it's run.
 *
 * Safe to re-run: the demo user (and everything owned via cascade) is wiped
 * and recreated each time.
 *
 * Usage: pnpm --filter @vehicle-vault/api run prisma:seed:demo
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@vehiclevault.dev';
const DEMO_PASSWORD = 'DemoPass!234';
const PASSWORD_HASH_ROUNDS = 12;

function atNoonUtc(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(12, 0, 0, 0);
  return copy;
}

function daysFromNow(offsetDays: number): Date {
  const date = atNoonUtc(new Date());
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date;
}

/**
 * `offsetMonths` months from today, clamped to the target month's last day
 * when `dayOfMonth` doesn't exist there (e.g. the 31st into February).
 * Shifting via day 1 first avoids JS's own month-end rollover.
 */
function monthsFromNow(offsetMonths: number, dayOfMonth?: number): Date {
  const today = atNoonUtc(new Date());
  const targetDay = dayOfMonth ?? today.getUTCDate();
  const date = new Date(today);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offsetMonths);
  const daysInTargetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(targetDay, daysInTargetMonth));
  return date;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-demo.ts is dev-only; refusing to run with NODE_ENV=production.');
  }

  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const passwordHash = await hash(DEMO_PASSWORD, PASSWORD_HASH_ROUNDS);
  const today = atNoonUtc(new Date());
  // Lands the next EMI installment within ~1-7 days of today, so the loan
  // shows up in the attention queue regardless of which day this runs.
  const loanInstallmentDay = ((today.getUTCDate() + 1) % 28) + 1;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: 'Demo User',
        email: DEMO_EMAIL,
        passwordHash,
        emailVerified: true,
      },
    });

    // --- Vehicle 1: Family SUV — overdue reminder, document expiring this week, fresh odometer ---
    const suv = await tx.vehicle.create({
      data: {
        userId: user.id,
        registrationNumber: 'MH12DM0001',
        make: 'Hyundai',
        model: 'Creta',
        variant: 'SX',
        year: 2024,
        fuelType: 'petrol',
        vehicleType: 'suv',
        nickname: 'Family SUV',
        odometer: 18500,
        members: { create: { userId: user.id, role: 'owner' } },
      },
    });
    await tx.reminder.create({
      data: {
        vehicleId: suv.id,
        title: 'Insurance renewal',
        type: 'insurance',
        status: 'overdue',
        dueDate: daysFromNow(-3),
      },
    });
    await tx.reminder.create({
      data: {
        vehicleId: suv.id,
        title: 'Wheel alignment check',
        type: 'service',
        status: 'upcoming',
        dueDate: daysFromNow(4),
      },
    });
    await tx.insurancePolicy.create({
      data: {
        vehicleId: suv.id,
        provider: 'HDFC ERGO',
        policyNumber: 'HE-DEMO-001',
        startDate: monthsFromNow(-11),
        endDate: daysFromNow(5),
        premiumAmount: 14500,
        insuredValue: 1200000,
      },
    });
    await tx.complianceDocument.create({
      data: {
        vehicleId: suv.id,
        kind: 'puc',
        provider: 'RTO Authorized Center',
        startDate: monthsFromNow(-2),
        endDate: daysFromNow(200),
      },
    });
    await tx.fuelLog.create({
      data: {
        vehicleId: suv.id,
        date: daysFromNow(-40),
        odometer: 17800,
        quantity: 32,
        price: 105,
        totalCost: 3360,
      },
    });
    await tx.fuelLog.create({
      data: {
        vehicleId: suv.id,
        date: daysFromNow(-15),
        odometer: 18200,
        quantity: 30,
        price: 106,
        totalCost: 3180,
      },
    });
    await tx.fuelLog.create({
      data: {
        vehicleId: suv.id,
        date: today,
        odometer: 18500,
        quantity: 28,
        price: 107,
        totalCost: 2996,
      },
    });
    await tx.maintenanceRecord.create({
      data: {
        vehicleId: suv.id,
        serviceDate: daysFromNow(-60),
        odometer: 17500,
        category: 'engine_oil',
        workshopName: 'City Hyundai Service',
        totalCost: 4200,
      },
    });

    // --- Vehicle 2: Daily Hatch — due-today reminder, expired-but-off-queue warranty, stale odometer ---
    const hatch = await tx.vehicle.create({
      data: {
        userId: user.id,
        registrationNumber: 'MH12DM0002',
        make: 'Maruti Suzuki',
        model: 'Swift',
        variant: 'VXi',
        year: 2023,
        fuelType: 'petrol',
        vehicleType: 'car',
        nickname: 'Daily Hatch',
        odometer: 32000,
        members: { create: { userId: user.id, role: 'owner' } },
      },
    });
    await tx.reminder.create({
      data: {
        vehicleId: hatch.id,
        title: 'Oil change',
        type: 'service',
        status: 'due_today',
        dueDate: today,
      },
    });
    // Expired >90 days ago: falls off the attention queue but the vehicle
    // card should still report it as `expired`.
    await tx.warranty.create({
      data: {
        vehicleId: hatch.id,
        provider: 'Maruti Suzuki',
        type: 'manufacturer',
        startDate: monthsFromNow(-30),
        endDate: daysFromNow(-120),
      },
    });
    await tx.insurancePolicy.create({
      data: {
        vehicleId: hatch.id,
        provider: 'Bajaj Allianz',
        policyNumber: 'BA-DEMO-002',
        startDate: monthsFromNow(-5),
        endDate: monthsFromNow(7),
        premiumAmount: 6200,
      },
    });
    await tx.complianceDocument.create({
      data: {
        vehicleId: hatch.id,
        kind: 'puc',
        provider: 'RTO Authorized Center',
        startDate: monthsFromNow(-1),
        endDate: monthsFromNow(5),
      },
    });
    await tx.complianceDocument.create({
      data: {
        vehicleId: hatch.id,
        kind: 'road_tax',
        provider: 'RTO',
        startDate: monthsFromNow(-6),
        endDate: daysFromNow(600),
      },
    });
    await tx.fuelLog.create({
      data: {
        vehicleId: hatch.id,
        date: daysFromNow(-120),
        odometer: 31800,
        quantity: 25,
        price: 104,
        totalCost: 2600,
      },
    });
    // Backdate updatedAt directly: bumpVehicleOdometer only touches it when a
    // fuel log raises the odometer, and the create above didn't, so a normal
    // .update() would just stamp "now" via @updatedAt — the odometer nudge
    // needs this row to genuinely look untouched for months.
    await tx.$executeRaw`UPDATE "Vehicle" SET "updatedAt" = ${daysFromNow(-130)} WHERE id = ${hatch.id}::uuid`;

    // --- Vehicle 3: Weekend Bike — all clear except an active loan with an EMI due soon ---
    const bike = await tx.vehicle.create({
      data: {
        userId: user.id,
        registrationNumber: 'MH12DM0003',
        make: 'Royal Enfield',
        model: 'Classic 350',
        variant: 'Chrome',
        year: 2022,
        fuelType: 'petrol',
        vehicleType: 'motorcycle',
        nickname: 'Weekend Bike',
        odometer: 8500,
        members: { create: { userId: user.id, role: 'owner' } },
      },
    });
    await tx.insurancePolicy.create({
      data: {
        vehicleId: bike.id,
        provider: 'ICICI Lombard',
        policyNumber: 'IL-DEMO-001',
        startDate: monthsFromNow(-4),
        endDate: monthsFromNow(8),
        premiumAmount: 3200,
      },
    });
    await tx.complianceDocument.create({
      data: {
        vehicleId: bike.id,
        kind: 'puc',
        provider: 'RTO Authorized Center',
        startDate: monthsFromNow(-1),
        endDate: monthsFromNow(5),
      },
    });
    await tx.vehicleLoan.create({
      data: {
        vehicleId: bike.id,
        lender: 'HDFC Bank',
        principal: 150000,
        interestRate: 9.5,
        tenureMonths: 36,
        startDate: monthsFromNow(-6, loanInstallmentDay),
        emiAmount: 4800,
        status: 'active',
      },
    });
    await tx.fuelLog.create({
      data: {
        vehicleId: bike.id,
        date: daysFromNow(-10),
        odometer: 8500,
        quantity: 12,
        price: 108,
        totalCost: 1296,
      },
    });

    // --- Vehicle 4: Second Car — a coming-up reminder, service history for smart suggestions ---
    const secondCar = await tx.vehicle.create({
      data: {
        userId: user.id,
        registrationNumber: 'MH12DM0004',
        make: 'Tata',
        model: 'Nexon',
        variant: 'XZ+',
        year: 2021,
        fuelType: 'diesel',
        vehicleType: 'suv',
        nickname: 'Second Car',
        odometer: 45000,
        members: { create: { userId: user.id, role: 'owner' } },
      },
    });
    await tx.reminder.create({
      data: {
        vehicleId: secondCar.id,
        title: 'Timing belt check',
        type: 'service',
        status: 'upcoming',
        dueDate: daysFromNow(20),
      },
    });
    await tx.insurancePolicy.create({
      data: {
        vehicleId: secondCar.id,
        provider: 'Bajaj Allianz',
        policyNumber: 'BA-DEMO-001',
        startDate: monthsFromNow(-8),
        endDate: monthsFromNow(4),
        premiumAmount: 11800,
      },
    });
    await tx.complianceDocument.create({
      data: {
        vehicleId: secondCar.id,
        kind: 'puc',
        provider: 'RTO Authorized Center',
        startDate: monthsFromNow(-1),
        endDate: monthsFromNow(5),
      },
    });
    await tx.maintenanceRecord.create({
      data: {
        vehicleId: secondCar.id,
        serviceDate: monthsFromNow(-8),
        odometer: 40500,
        category: 'engine_oil',
        workshopName: 'Tata Motors Service Center',
        totalCost: 5400,
      },
    });
    await tx.maintenanceRecord.create({
      data: {
        vehicleId: secondCar.id,
        serviceDate: monthsFromNow(-2),
        odometer: 43200,
        category: 'engine_oil',
        workshopName: 'Tata Motors Service Center',
        totalCost: 5600,
      },
    });
  });

  console.log(
    `\nDemo data seeded — 4 vehicles across every dashboard state.\nSign in with:\n  email:    ${DEMO_EMAIL}\n  password: ${DEMO_PASSWORD}\n`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

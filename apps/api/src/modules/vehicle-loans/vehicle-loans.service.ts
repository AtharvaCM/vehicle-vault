import { AuditResourceType, Prisma } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LoanStatus, type LoanPrepayment, type VehicleLoan } from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { VehiclesService } from '../vehicles/vehicles.service';
import { computeEmi, summarize, type LoanParams, type Prepayment } from './amortization';
import type { CreateVehicleLoanDto } from './dto/create-vehicle-loan.dto';
import type { UpdateVehicleLoanDto } from './dto/update-vehicle-loan.dto';
import type { CreateLoanPrepaymentDto } from './dto/create-loan-prepayment.dto';
import type { ForecloseLoanDto } from './dto/foreclose-loan.dto';

const loanInclude = {
  prepayments: { orderBy: { date: 'asc' } },
} satisfies Prisma.VehicleLoanInclude;

type LoanRow = Prisma.VehicleLoanGetPayload<{ include: typeof loanInclude }>;

@Injectable()
export class VehicleLoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
    private readonly auditService: AuditService,
  ) {}

  async listForVehicle(userId: string, vehicleId: string): Promise<VehicleLoan[]> {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);
    const loans = await this.prisma.vehicleLoan.findMany({
      where: { vehicleId },
      include: loanInclude,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return loans.map((loan) => this.toVehicleLoan(loan));
  }

  async listForUser(userId: string): Promise<VehicleLoan[]> {
    const loans = await this.prisma.vehicleLoan.findMany({
      where: { vehicle: { members: { some: { userId, role: 'owner' } } } },
      include: loanInclude,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return loans.map((loan) => this.toVehicleLoan(loan));
  }

  async getById(userId: string, loanId: string): Promise<VehicleLoan> {
    return this.toVehicleLoan(await this.getOwnedLoan(userId, loanId));
  }

  async createForVehicle(
    userId: string,
    vehicleId: string,
    dto: CreateVehicleLoanDto,
  ): Promise<VehicleLoan> {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const principal = new Prisma.Decimal(dto.principal);
    const interestRate = new Prisma.Decimal(dto.interestRate);
    const emi = computeEmi({ principal, interestRate, tenureMonths: dto.tenureMonths });

    const loan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vehicleLoan.create({
        data: {
          vehicleId,
          lender: dto.lender,
          accountNumber: dto.accountNumber ?? null,
          principal,
          interestRate,
          tenureMonths: dto.tenureMonths,
          startDate: new Date(dto.startDate),
          emiAmount: emi,
          currencyCode: dto.currencyCode ?? 'INR',
          notes: dto.notes ?? null,
        },
        include: loanInclude,
      });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.loan.created,
        resourceType: AuditResourceType.vehicle_loan,
        resourceId: created.id,
        after: created as unknown as Record<string, unknown>,
      });
      return created;
    });

    return this.toVehicleLoan(loan);
  }

  async updateLoan(
    userId: string,
    loanId: string,
    dto: UpdateVehicleLoanDto,
  ): Promise<VehicleLoan> {
    const before = await this.getOwnedLoan(userId, loanId);
    if (!Object.keys(dto).length) {
      throw new BadRequestException('At least one loan field must be provided');
    }

    const nextPrincipal =
      dto.principal !== undefined ? new Prisma.Decimal(dto.principal) : before.principal;
    const nextRate =
      dto.interestRate !== undefined ? new Prisma.Decimal(dto.interestRate) : before.interestRate;
    const nextTenure = dto.tenureMonths ?? before.tenureMonths;
    const emi = computeEmi({
      principal: nextPrincipal,
      interestRate: nextRate,
      tenureMonths: nextTenure,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.vehicleLoan.update({
        where: { id: loanId },
        data: {
          lender: dto.lender,
          accountNumber: dto.accountNumber,
          principal: dto.principal !== undefined ? new Prisma.Decimal(dto.principal) : undefined,
          interestRate:
            dto.interestRate !== undefined ? new Prisma.Decimal(dto.interestRate) : undefined,
          tenureMonths: dto.tenureMonths,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          emiAmount: emi,
          currencyCode: dto.currencyCode,
          status: dto.status,
          closedAt:
            dto.closedAt === undefined
              ? undefined
              : dto.closedAt === null
              ? null
              : new Date(dto.closedAt),
          notes: dto.notes,
        },
        include: loanInclude,
      });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action:
          dto.status === LoanStatus.Closed && before.status !== LoanStatus.Closed
            ? AUDIT_ACTIONS.loan.closed
            : AUDIT_ACTIONS.loan.updated,
        resourceType: AuditResourceType.vehicle_loan,
        resourceId: loanId,
        before: before as unknown as Record<string, unknown>,
        after: next as unknown as Record<string, unknown>,
      });
      return next;
    });

    return this.toVehicleLoan(updated);
  }

  async deleteLoan(userId: string, loanId: string) {
    const loan = await this.getOwnedLoan(userId, loanId);
    await this.prisma.$transaction(async (tx) => {
      await tx.vehicleLoan.delete({ where: { id: loanId } });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.loan.deleted,
        resourceType: AuditResourceType.vehicle_loan,
        resourceId: loanId,
        before: loan as unknown as Record<string, unknown>,
      });
    });
    return { id: loanId, deleted: true };
  }

  async addPrepayment(
    userId: string,
    loanId: string,
    dto: CreateLoanPrepaymentDto,
  ): Promise<VehicleLoan> {
    const loan = await this.getOwnedLoan(userId, loanId);
    if (loan.status === LoanStatus.Closed) {
      throw new BadRequestException('Cannot add prepayment to a closed loan');
    }
    const date = new Date(dto.date);
    if (date.getTime() < loan.startDate.getTime()) {
      throw new BadRequestException('Prepayment cannot precede loan start date');
    }
    const amount = new Prisma.Decimal(dto.amount);

    const next = await this.prisma.$transaction(async (tx) => {
      const created = await tx.loanPrepayment.create({
        data: { loanId, date, amount, notes: dto.notes ?? null },
      });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.loan.prepaymentAdded,
        resourceType: AuditResourceType.loan_prepayment,
        resourceId: created.id,
        after: created as unknown as Record<string, unknown>,
      });
      return tx.vehicleLoan.findUniqueOrThrow({ where: { id: loanId }, include: loanInclude });
    });

    return this.toVehicleLoan(next);
  }

  async deletePrepayment(
    userId: string,
    loanId: string,
    prepaymentId: string,
  ): Promise<VehicleLoan> {
    const loan = await this.getOwnedLoan(userId, loanId);
    const prepayment = loan.prepayments.find((p) => p.id === prepaymentId);
    if (!prepayment) {
      throw new NotFoundException(`Prepayment ${prepaymentId} was not found on loan ${loanId}`);
    }

    const next = await this.prisma.$transaction(async (tx) => {
      await tx.loanPrepayment.delete({ where: { id: prepaymentId } });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.loan.prepaymentDeleted,
        resourceType: AuditResourceType.loan_prepayment,
        resourceId: prepaymentId,
        before: prepayment as unknown as Record<string, unknown>,
      });
      return tx.vehicleLoan.findUniqueOrThrow({ where: { id: loanId }, include: loanInclude });
    });

    return this.toVehicleLoan(next);
  }

  async forecloseLoan(
    userId: string,
    loanId: string,
    dto: ForecloseLoanDto,
  ): Promise<VehicleLoan> {
    const before = await this.getOwnedLoan(userId, loanId);
    if (before.status === LoanStatus.Closed) {
      throw new BadRequestException('Loan is already closed');
    }
    const closedAt = dto.closedAt ? new Date(dto.closedAt) : new Date();
    if (closedAt.getTime() < before.startDate.getTime()) {
      throw new BadRequestException('Foreclosure date cannot precede loan start date');
    }

    const next = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.vehicleLoan.update({
        where: { id: loanId },
        data: {
          status: LoanStatus.Closed,
          closedAt,
          notes: dto.notes ?? before.notes,
        },
        include: loanInclude,
      });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.loan.foreclosed,
        resourceType: AuditResourceType.vehicle_loan,
        resourceId: loanId,
        before: before as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    });

    return this.toVehicleLoan(next);
  }

  async getSchedule(userId: string, loanId: string) {
    const loan = await this.getOwnedLoan(userId, loanId);
    const params = this.toLoanParams(loan);
    const { buildSchedule } = await import('./amortization');
    const schedule = buildSchedule(params);
    return schedule.map((row) => ({
      period: `${row.date.getUTCFullYear()}-${String(row.date.getUTCMonth() + 1).padStart(2, '0')}`,
      emi: Number(row.emi.toFixed(2)),
      principal: Number(row.principal.toFixed(2)),
      interest: Number(row.interest.toFixed(2)),
      prepayment: Number(row.prepayment.toFixed(2)),
      balance: Number(row.balance.toFixed(2)),
    }));
  }

  private async getOwnedLoan(userId: string, loanId: string): Promise<LoanRow> {
    const loan = await this.prisma.vehicleLoan.findFirst({
      where: { id: loanId, vehicle: { members: { some: { userId, role: 'owner' } } } },
      include: loanInclude,
    });
    if (!loan) throw new NotFoundException(`Vehicle loan ${loanId} was not found`);
    return loan;
  }

  private toLoanParams(loan: LoanRow): LoanParams {
    const prepayments: Prepayment[] = loan.prepayments.map((p) => ({
      date: p.date,
      amount: p.amount,
    }));
    return {
      principal: loan.principal,
      interestRate: loan.interestRate,
      tenureMonths: loan.tenureMonths,
      startDate: loan.startDate,
      prepayments,
      closedAt: loan.closedAt,
    };
  }

  private toVehicleLoan(loan: LoanRow): VehicleLoan {
    const summary = summarize(this.toLoanParams(loan));
    const prepayments: LoanPrepayment[] = loan.prepayments.map((p) => ({
      id: p.id,
      loanId: p.loanId,
      date: p.date.toISOString(),
      amount: Number(p.amount),
      notes: p.notes ?? undefined,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
    return {
      id: loan.id,
      vehicleId: loan.vehicleId,
      lender: loan.lender,
      accountNumber: loan.accountNumber ?? undefined,
      principal: Number(loan.principal),
      interestRate: Number(loan.interestRate),
      tenureMonths: loan.tenureMonths,
      startDate: loan.startDate.toISOString(),
      emiAmount: Number(loan.emiAmount),
      currencyCode: loan.currencyCode,
      status: loan.status as LoanStatus,
      closedAt: loan.closedAt ? loan.closedAt.toISOString() : null,
      notes: loan.notes ?? undefined,
      createdAt: loan.createdAt.toISOString(),
      updatedAt: loan.updatedAt.toISOString(),
      totalInterest: Number(summary.totalInterest.toFixed(2)),
      totalPayable: Number(summary.totalPayable.toFixed(2)),
      monthsRemaining: summary.monthsRemaining,
      outstandingBalance: Number(summary.outstandingBalance.toFixed(2)),
      interestPaidToDate: Number(summary.interestPaidToDate.toFixed(2)),
      principalPaidToDate: Number(summary.principalPaidToDate.toFixed(2)),
      prepaidToDate: Number(summary.prepaidToDate.toFixed(2)),
      endDate: summary.endDate.toISOString(),
      prepayments,
    };
  }
}

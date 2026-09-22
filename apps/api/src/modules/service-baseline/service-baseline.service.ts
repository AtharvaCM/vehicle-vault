import { Injectable } from '@nestjs/common';
import { AuditResourceType, Prisma } from '@prisma/client';
import {
  MaintenanceCategory,
  MaintenanceRecordStatus,
  ServiceBaselineStatus,
  ServiceBaselineUpsertSchema,
  type ServiceBaseline,
  type ServiceBaselineSource,
  type ServiceBaselineUpsertInput,
  type VehicleServiceBaselineCoverage,
  type VehicleServiceBaselineEntry,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { MaintenanceIntervalResolver } from '../vehicles/maintenance-interval.resolver';
import { VehicleAccessService } from '../vehicles/vehicle-access.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import type { UpsertServiceBaselineDto } from './dto/upsert-service-baseline.dto';
import { unansweredCategories } from './service-history-coverage';

type ServiceBaselineRow = Prisma.ServiceBaselineGetPayload<Record<string, never>>;

/** The subset of a MaintenanceRecord that answers "when was this last done". */
type LastServiceRow = { category: string; odometer: number; serviceDate: Date };

@Injectable()
export class ServiceBaselineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
    private readonly access: VehicleAccessService,
    private readonly intervalResolver: MaintenanceIntervalResolver,
    private readonly auditService: AuditService,
  ) {}

  /**
   * What the app knows about this vehicle's service history, one entry per
   * category that actually applies to it.
   *
   * Deliberately reports `unset` rather than hiding it: that is the state in
   * which the alert engine falls back to measuring from the odometer at the
   * moment the vehicle was added, and a user cannot correct an assumption that
   * is never shown to them.
   */
  async getCoverage(userId: string, vehicleId: string): Promise<VehicleServiceBaselineCoverage> {
    const vehicle = await this.vehiclesService.getVehicleById(userId, vehicleId);
    const intervals = await this.intervalResolver.resolveForVehicle({
      catalogVariantId: vehicle.catalogVariantId,
      vehicleType: vehicle.vehicleType,
      fuelType: vehicle.fuelType,
    });

    const [baselines, records] = await Promise.all([
      this.prisma.serviceBaseline.findMany({ where: { vehicleId } }),
      // Ordered and filtered to match MaintenanceAlertService exactly — same
      // `status: confirmed`, same `odometer: desc`. If the engine would measure
      // from a row, this view has to show that row, or the screen explaining a
      // reminder disagrees with the reminder. Drafts are excluded on both sides
      // because an unconfirmed record is not evidence the service happened;
      // showing one here as `source: 'record'` would tell the owner their brake
      // pads are logged while the engine still counts them as never done.
      this.prisma.maintenanceRecord.findMany({
        where: { vehicleId, status: MaintenanceRecordStatus.Confirmed },
        select: { category: true, odometer: true, serviceDate: true },
        orderBy: { odometer: 'desc' },
      }),
    ]);

    const baselineByCategory = new Map(baselines.map((row) => [row.category, row]));
    const entries = Object.keys(intervals).map((key) =>
      this.toCoverageEntry(
        key as MaintenanceCategory,
        baselineByCategory.get(key as MaintenanceCategory) ?? null,
        (records as LastServiceRow[]).find((record) => record.category === key) ?? null,
      ),
    );

    return {
      vehicleId,
      entries,
      unansweredCount: unansweredCategories(intervals, records, baselines).length,
    };
  }

  /**
   * Upserts the categories named in the payload and leaves the rest alone.
   *
   * Onboarding answers arrive a screenful at a time and a history reconstructed
   * from memory is partial by nature, so answering three questions must not
   * retract the other seven.
   */
  async upsertForVehicle(
    userId: string,
    vehicleId: string,
    payload: UpsertServiceBaselineDto,
  ): Promise<ServiceBaseline[]> {
    await this.access.assertEditor(userId, vehicleId);
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const input: ServiceBaselineUpsertInput = ServiceBaselineUpsertSchema.parse(payload);

    const existing = await this.prisma.serviceBaseline.findMany({ where: { vehicleId } });
    const byCategory = new Map(existing.map((row) => [row.category, row]));

    const saved = await this.prisma.$transaction(async (tx) => {
      const rows: ServiceBaselineRow[] = [];

      for (const entry of input.entries) {
        const before = byCategory.get(entry.category) ?? null;
        const data = {
          status: entry.status,
          lastDoneOdometer: entry.lastDoneOdometer ?? null,
          lastDoneDate: entry.lastDoneDate ? new Date(entry.lastDoneDate) : null,
          notes: entry.notes ?? null,
        };

        const row = before
          ? await tx.serviceBaseline.update({ where: { id: before.id }, data })
          : await tx.serviceBaseline.create({
              data: { vehicleId, category: entry.category, ...data },
            });

        await this.auditService.track(tx, {
          actorUserId: userId,
          ownerUserId: userId,
          action: before
            ? AUDIT_ACTIONS.serviceBaseline.updated
            : AUDIT_ACTIONS.serviceBaseline.created,
          resourceType: AuditResourceType.service_baseline,
          resourceId: row.id,
          before: before as unknown as Record<string, unknown> | null,
          after: row as unknown as Record<string, unknown>,
        });

        rows.push(row);
      }

      return rows;
    });

    return saved.map((row) => this.toServiceBaseline(row));
  }

  private toCoverageEntry(
    category: MaintenanceCategory,
    baseline: ServiceBaselineRow | null,
    lastService: LastServiceRow | null,
  ): VehicleServiceBaselineEntry {
    // A logged service supersedes whatever was said at onboarding: it is a
    // measurement, and the baseline was a recollection.
    if (lastService) {
      return {
        category,
        source: 'record',
        lastDoneOdometer: lastService.odometer,
        lastDoneDate: lastService.serviceDate.toISOString(),
        baseline: baseline ? this.toServiceBaseline(baseline) : null,
      };
    }

    if (!baseline) {
      return {
        category,
        source: 'unset',
        lastDoneOdometer: null,
        lastDoneDate: null,
        baseline: null,
      };
    }

    const source: ServiceBaselineSource =
      baseline.status === ServiceBaselineStatus.Unknown ? 'declared-unknown' : 'baseline';

    return {
      category,
      source,
      lastDoneOdometer: baseline.lastDoneOdometer,
      lastDoneDate: baseline.lastDoneDate?.toISOString() ?? null,
      baseline: this.toServiceBaseline(baseline),
    };
  }

  private toServiceBaseline(row: ServiceBaselineRow): ServiceBaseline {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      category: row.category as MaintenanceCategory,
      status: row.status as ServiceBaselineStatus,
      lastDoneOdometer: row.lastDoneOdometer,
      lastDoneDate: row.lastDoneDate?.toISOString() ?? null,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditResourceType } from '@prisma/client';
import {
  CreateVehicleDocumentSchema,
  UpdateVehicleDocumentSchema,
  type CreateVehicleDocumentInput,
  type UpdateVehicleDocumentInput,
  type VehicleDocument,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { VehiclesService } from '../vehicles/vehicles.service';
import { VEHICLE_DOCUMENT_ADAPTERS, type VehicleDocumentAdapter } from './types';

const KIND_TO_RESOURCE_TYPE: Record<VehicleDocumentKind, AuditResourceType> = {
  insurance: AuditResourceType.insurance_policy,
  warranty: AuditResourceType.warranty,
};

const KIND_TO_AUDIT_NAMESPACE: Record<
  VehicleDocumentKind,
  { created: string; updated: string; deleted: string }
> = {
  insurance: AUDIT_ACTIONS.insurance,
  warranty: AUDIT_ACTIONS.warranty,
};

const NOT_FOUND_MESSAGE = 'Vehicle document not found';

@Injectable()
export class VehicleDocumentsService {
  private readonly adapterByKind: Map<VehicleDocumentKind, VehicleDocumentAdapter>;

  constructor(
    private readonly vehiclesService: VehiclesService,
    @Inject(VEHICLE_DOCUMENT_ADAPTERS)
    private readonly adapters: VehicleDocumentAdapter[],
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {
    this.adapterByKind = new Map(adapters.map((a) => [a.kind, a]));
  }

  async listForVehicle(
    userId: string,
    vehicleId: string,
    kind?: VehicleDocumentKind,
  ): Promise<VehicleDocument[]> {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);
    const targets = kind ? [this.requireAdapter(kind)] : this.adapters;
    const lists = await Promise.all(targets.map((a) => a.listForVehicle(vehicleId)));
    return lists.flat();
  }

  async create(
    userId: string,
    vehicleId: string,
    payload: CreateVehicleDocumentInput,
  ): Promise<VehicleDocument> {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);
    const input = CreateVehicleDocumentSchema.parse(payload);
    const adapter = this.requireAdapter(input.kind);
    // Adapter signatures are typed per-kind; the discriminated union runtime guarantees
    // the payload matches the adapter resolved by its `kind` literal.
    const created = await adapter.create(vehicleId, input as never);
    await this.auditService.track(this.prisma, {
      actorUserId: userId,
      ownerUserId: userId,
      action: KIND_TO_AUDIT_NAMESPACE[input.kind].created,
      resourceType: KIND_TO_RESOURCE_TYPE[input.kind],
      resourceId: created.id,
      after: created as unknown as Record<string, unknown>,
    });
    return created;
  }

  async update(
    userId: string,
    id: string,
    payload: UpdateVehicleDocumentInput,
  ): Promise<VehicleDocument> {
    const input = UpdateVehicleDocumentSchema.parse(payload);
    const owned = await this.findOwned(userId, id, input.kind);
    const adapter = this.requireAdapter(input.kind);
    const updated = await adapter.update(owned.id, input as never);
    await this.auditService.track(this.prisma, {
      actorUserId: userId,
      ownerUserId: userId,
      action: KIND_TO_AUDIT_NAMESPACE[input.kind].updated,
      resourceType: KIND_TO_RESOURCE_TYPE[input.kind],
      resourceId: owned.id,
      before: owned as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });
    return updated;
  }

  async remove(userId: string, kind: VehicleDocumentKind, id: string): Promise<void> {
    const owned = await this.findOwned(userId, id, kind);
    const adapter = this.requireAdapter(kind);
    await adapter.remove(owned.id);
    await this.auditService.track(this.prisma, {
      actorUserId: userId,
      ownerUserId: userId,
      action: KIND_TO_AUDIT_NAMESPACE[kind].deleted,
      resourceType: KIND_TO_RESOURCE_TYPE[kind],
      resourceId: owned.id,
      before: owned as unknown as Record<string, unknown>,
    });
  }

  /**
   * Return every document owned by the user whose validity window ends
   * within the next `withinDays`. The range starts at the current
   * day's midnight (caller-local) so a cron that fires at 06:00 produces
   * the same set of rows as one that fires at 23:59.
   *
   * Replaces the buggy single-day slice that previously lived inside
   * `MaintenanceAlertService.checkInsurancePolicies` — that query only
   * matched `endDate` on exactly one specific day, so a cron miss
   * silently dropped the alert. The range query is robust to cron drift.
   */
  async findExpiring(
    userId: string,
    withinDays: number,
    kind?: VehicleDocumentKind,
  ): Promise<VehicleDocument[]> {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const until = new Date(from);
    until.setDate(until.getDate() + withinDays);
    until.setHours(23, 59, 59, 999);

    const targets = kind ? [this.requireAdapter(kind)] : this.adapters;
    const lists = await Promise.all(
      targets.map((a) => a.findExpiringBetween(userId, from, until)),
    );
    return lists.flat();
  }

  async activeCoverageAt(
    userId: string,
    vehicleId: string,
    date: Date,
    kind?: VehicleDocumentKind,
  ): Promise<VehicleDocument[]> {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);
    const targets = kind ? [this.requireAdapter(kind)] : this.adapters;
    const lists = await Promise.all(targets.map((a) => a.activeAt(vehicleId, date)));
    return lists.flat();
  }

  private requireAdapter(kind: VehicleDocumentKind): VehicleDocumentAdapter {
    const adapter = this.adapterByKind.get(kind);
    if (!adapter) {
      throw new Error(`No VehicleDocumentAdapter registered for kind "${kind}"`);
    }
    return adapter;
  }

  private async findOwned(
    userId: string,
    id: string,
    kind: VehicleDocumentKind,
  ): Promise<VehicleDocument> {
    const adapter = this.requireAdapter(kind);
    const found = await adapter.findForOwnerCheck(id);
    if (!found || found.vehicleUserId !== userId) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return found.document;
  }
}

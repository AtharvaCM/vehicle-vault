import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateVehicleDocumentSchema,
  UpdateVehicleDocumentSchema,
  type CreateVehicleDocumentInput,
  type UpdateVehicleDocumentInput,
  type VehicleDocument,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';

import { VehiclesService } from '../vehicles/vehicles.service';
import { VEHICLE_DOCUMENT_ADAPTERS, type VehicleDocumentAdapter } from './types';

const NOT_FOUND_MESSAGE = 'Vehicle document not found';

@Injectable()
export class VehicleDocumentsService {
  private readonly adapterByKind: Map<VehicleDocumentKind, VehicleDocumentAdapter>;

  constructor(
    private readonly vehiclesService: VehiclesService,
    @Inject(VEHICLE_DOCUMENT_ADAPTERS)
    private readonly adapters: VehicleDocumentAdapter[],
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
    return adapter.create(vehicleId, input as never);
  }

  async update(
    userId: string,
    id: string,
    payload: UpdateVehicleDocumentInput,
  ): Promise<VehicleDocument> {
    const input = UpdateVehicleDocumentSchema.parse(payload);
    const owned = await this.findOwned(userId, id, input.kind);
    const adapter = this.requireAdapter(input.kind);
    return adapter.update(owned.id, input as never);
  }

  async remove(userId: string, kind: VehicleDocumentKind, id: string): Promise<void> {
    const owned = await this.findOwned(userId, id, kind);
    const adapter = this.requireAdapter(kind);
    await adapter.remove(owned.id);
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

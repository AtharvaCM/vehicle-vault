import type {
  CreateVehicleDocumentInput,
  UpdateVehicleDocumentInput,
  VehicleDocument,
  VehicleDocumentKind,
} from '@vehicle-vault/shared';

/**
 * Per-kind adapter behind {@link VehicleDocumentsService}. Each adapter owns
 * its persistence (Prisma table choice, query shapes) and its row → unified
 * {@link VehicleDocument} mapping. Adding a third kind (registration, PUC,
 * road tax) means writing one new adapter and registering it — zero service
 * edits.
 */
export interface VehicleDocumentAdapter {
  readonly kind: VehicleDocumentKind;

  listForVehicle(vehicleId: string): Promise<VehicleDocument[]>;

  /**
   * Returns the document and its owning user id so the service can enforce
   * the ownership invariant uniformly across kinds.
   */
  findForOwnerCheck(
    id: string,
  ): Promise<{ document: VehicleDocument; vehicleUserId: string } | null>;

  activeAt(vehicleId: string, date: Date): Promise<VehicleDocument[]>;

  create(
    vehicleId: string,
    input: Extract<CreateVehicleDocumentInput, { kind: VehicleDocumentKind }>,
  ): Promise<VehicleDocument>;

  update(
    id: string,
    input: Extract<UpdateVehicleDocumentInput, { kind: VehicleDocumentKind }>,
  ): Promise<VehicleDocument>;

  remove(id: string): Promise<void>;
}

export const VEHICLE_DOCUMENT_ADAPTERS = Symbol('VEHICLE_DOCUMENT_ADAPTERS');

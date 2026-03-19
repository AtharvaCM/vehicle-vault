import type {
  CreateMaintenanceRecordInput,
  MaintenanceRecord,
  UpdateMaintenanceRecordInput,
} from '@vehicle-vault/shared';

export type { CreateMaintenanceRecordInput, MaintenanceRecord, UpdateMaintenanceRecordInput };

export type CreateMaintenanceRecordBody = Omit<CreateMaintenanceRecordInput, 'vehicleId'>;

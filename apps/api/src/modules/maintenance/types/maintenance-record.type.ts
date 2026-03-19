import type { CreateMaintenanceRecordInput } from '@vehicle-vault/shared';

export type MaintenanceRecord = CreateMaintenanceRecordInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

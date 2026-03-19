import { MaintenanceCategory } from '@vehicle-vault/shared';

export type MaintenanceRecord = {
  id: string;
  category: MaintenanceCategory;
  serviceDate: string;
  workshopName: string;
  totalCost: number;
  odometer: number;
};

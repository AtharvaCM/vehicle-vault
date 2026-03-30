import type { MaintenanceCategory, ReminderStatus, ReminderType, VehicleType } from '../enums';

export type DashboardReminderCounts = {
  overdue: number;
  dueToday: number;
  upcoming: number;
  completed: number;
};

export type DashboardVehicleSummary = {
  id: string;
  displayName: string;
  registrationNumber: string;
  vehicleType: VehicleType;
  odometer: number;
  updatedAt: string;
};

export type DashboardMaintenanceSummary = {
  id: string;
  vehicleId: string;
  vehicleLabel: string;
  category: MaintenanceCategory;
  serviceDate: string;
  totalCost: number;
  workshopName?: string;
  attachmentCount: number;
};

export type DashboardReminderSummary = {
  id: string;
  vehicleId: string;
  vehicleLabel: string;
  title: string;
  type: ReminderType;
  status: ReminderStatus;
  dueDate?: string;
  dueOdometer?: number;
  updatedAt: string;
};

import type { MaintenanceSuggestion } from './maintenance';

export type DashboardSummary = {
  totalVehicles: number;
  totalMaintenanceRecords: number;
  totalAttachments: number;
  reminderCounts: DashboardReminderCounts;
  recentVehicles: DashboardVehicleSummary[];
  recentMaintenance: DashboardMaintenanceSummary[];
  upcomingReminders: DashboardReminderSummary[];
  overdueReminders: DashboardReminderSummary[];
  insights: MaintenanceSuggestion[];
};

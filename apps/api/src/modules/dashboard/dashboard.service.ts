import { Injectable } from '@nestjs/common';
import { ReminderStatus, type DashboardSummary } from '@vehicle-vault/shared';

import { AttachmentsService } from '../attachments/attachments.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { RemindersService } from '../reminders/reminders.service';
import { VehiclesService } from '../vehicles/vehicles.service';

const DASHBOARD_LIST_LIMIT = 5;

@Injectable()
export class DashboardService {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly maintenanceService: MaintenanceService,
    private readonly remindersService: RemindersService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  async getSummary(userId: string): Promise<DashboardSummary> {
    const [vehicles, maintenanceRecords, reminders, attachments] = await Promise.all([
      this.vehiclesService.getAllVehicles(userId),
      this.maintenanceService.getAllRecords(userId),
      this.remindersService.getAllReminders(userId),
      this.attachmentsService.listAllAttachments(userId),
    ]);

    const vehicleLabelById = Object.fromEntries(
      vehicles.map((vehicle) => [
        vehicle.id,
        `${vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`} • ${vehicle.registrationNumber}`,
      ]),
    );
    const attachmentCountByRecordId = attachments.reduce<Record<string, number>>(
      (counts, attachment) => {
        counts[attachment.maintenanceRecordId] = (counts[attachment.maintenanceRecordId] ?? 0) + 1;

        return counts;
      },
      {},
    );

    return {
      totalVehicles: vehicles.length,
      totalMaintenanceRecords: maintenanceRecords.length,
      totalAttachments: attachments.length,
      reminderCounts: {
        overdue: reminders.filter((reminder) => reminder.status === ReminderStatus.Overdue).length,
        dueToday: reminders.filter((reminder) => reminder.status === ReminderStatus.DueToday)
          .length,
        upcoming: reminders.filter((reminder) => reminder.status === ReminderStatus.Upcoming)
          .length,
        completed: reminders.filter((reminder) => reminder.status === ReminderStatus.Completed)
          .length,
      },
      recentVehicles: vehicles.slice(0, DASHBOARD_LIST_LIMIT).map((vehicle) => ({
        id: vehicle.id,
        displayName: vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`,
        registrationNumber: vehicle.registrationNumber,
        vehicleType: vehicle.vehicleType,
        odometer: vehicle.odometer,
        updatedAt: vehicle.updatedAt,
      })),
      recentMaintenance: maintenanceRecords.slice(0, DASHBOARD_LIST_LIMIT).map((record) => ({
        id: record.id,
        vehicleId: record.vehicleId,
        vehicleLabel: vehicleLabelById[record.vehicleId] ?? 'Unknown vehicle',
        category: record.category,
        serviceDate: record.serviceDate,
        totalCost: record.totalCost,
        workshopName: record.workshopName,
        attachmentCount: attachmentCountByRecordId[record.id] ?? 0,
      })),
      upcomingReminders: reminders
        .filter(
          (reminder) =>
            reminder.status === ReminderStatus.DueToday ||
            reminder.status === ReminderStatus.Upcoming,
        )
        .slice(0, DASHBOARD_LIST_LIMIT)
        .map((reminder) => ({
          id: reminder.id,
          vehicleId: reminder.vehicleId,
          vehicleLabel: vehicleLabelById[reminder.vehicleId] ?? 'Unknown vehicle',
          title: reminder.title,
          type: reminder.type,
          status: reminder.status,
          dueDate: reminder.dueDate,
          dueOdometer: reminder.dueOdometer,
          updatedAt: reminder.updatedAt,
        })),
      overdueReminders: reminders
        .filter((reminder) => reminder.status === ReminderStatus.Overdue)
        .slice(0, DASHBOARD_LIST_LIMIT)
        .map((reminder) => ({
          id: reminder.id,
          vehicleId: reminder.vehicleId,
          vehicleLabel: vehicleLabelById[reminder.vehicleId] ?? 'Unknown vehicle',
          title: reminder.title,
          type: reminder.type,
          status: reminder.status,
          dueDate: reminder.dueDate,
          dueOdometer: reminder.dueOdometer,
          updatedAt: reminder.updatedAt,
        })),
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import type { AccountExport, AccountExportMeta, User } from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { RemindersService } from '../reminders/reminders.service';
import { VehiclesService } from '../vehicles/vehicles.service';

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
    private readonly maintenanceService: MaintenanceService,
    private readonly remindersService: RemindersService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  async exportAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} was not found`);
    }

    const [vehicles, maintenanceRecords, reminders, attachments] = await Promise.all([
      this.vehiclesService.getAllVehicles(userId),
      this.maintenanceService.getAllRecords(userId),
      this.remindersService.getAllReminders(userId),
      this.attachmentsService.listAllAttachments(userId),
    ]);
    const exportedAt = new Date().toISOString();
    const fileDateStamp = exportedAt.slice(0, 10);

    return {
      data: {
        version: 1,
        exportedAt,
        user: this.toUser(user),
        vehicles,
        maintenanceRecords,
        reminders,
        attachments,
      } satisfies AccountExport,
      meta: {
        format: 'json',
        fileName: `vehicle-vault-export-${fileDateStamp}.json`,
      } satisfies AccountExportMeta,
    };
  }

  private toUser(user: {
    id: string;
    name: string;
    email: string;
    allowedCatalogSources: string[];
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      allowedCatalogSources: user.allowedCatalogSources,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

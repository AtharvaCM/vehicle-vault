import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditResourceType } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';

/**
 * Where uploads land, keyed by the uploader: maintenance and loan files under
 * `attachments/<userId>/…`, claim files under `claim-attachments/<userId>/…`.
 */
export const ATTACHMENT_STORAGE_ROOTS = ['attachments', 'claim-attachments'] as const;

export function storagePrefixesFor(userId: string): string[] {
  return ATTACHMENT_STORAGE_ROOTS.map((root) => `${root}/${userId}`);
}

export type AccountDeletionPlan = {
  userId: string;
  email: string;
  createdAt: Date;
  /** Vehicles whose owner column is this user: they go with the account. */
  ownedVehicles: { id: string; label: string; otherMembers: number }[];
  /** Files attached to anything on those vehicles. */
  attachmentFiles: string[];
  /** Everything stored under the user's upload prefixes, whether a row points at it or not. */
  storedObjects: string[];
  auditEvents: number;
  notifications: number;
  productEvents: number;
  /** Memberships of vehicles someone else owns; these end without touching the vehicle. */
  otherMemberships: number;
};

export type AccountDeletionResult = {
  userId: string;
  vehiclesDeleted: number;
  filesDeleted: number;
  filesAlreadyGone: number;
  /** Stored under the user's prefixes with no row pointing at them. */
  orphansDeleted: number;
  /** Paths storage refused to remove; the rows are gone either way. */
  storageFailures: string[];
};

/**
 * Deletes an account the way the rest of the app would expect it to go.
 *
 * The database does most of it: deleting the User cascades through its owned
 * vehicles (and every record, reminder, document and attachment row beneath
 * them), memberships, invites, notifications and preferences, while audit and
 * product-event rows are set to null. Two things a cascade cannot do happen here:
 * the audit trail is anonymised (ADR-0004), and the uploaded files are removed
 * from storage, which vehicle deletion alone only does for maintenance records.
 *
 * A vehicle shared with anyone else is refused rather than deleted from under
 * them; ownership has to move first.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storage: SupabaseStorageService,
  ) {}

  /** What deleting the account would remove. Reads only. */
  async plan(userId: string): Promise<AccountDeletionPlan> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, createdAt: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} was not found.`);
    }

    const vehicles = await this.prisma.vehicle.findMany({
      where: { userId },
      select: {
        id: true,
        make: true,
        model: true,
        nickname: true,
        members: { select: { userId: true } },
      },
    });
    const vehicleIds = vehicles.map((vehicle) => vehicle.id);

    const [attachments, auditEvents, notifications, productEvents, otherMemberships] =
      await Promise.all([
        vehicleIds.length === 0
          ? Promise.resolve([])
          : this.prisma.attachment.findMany({
              where: {
                OR: [
                  { maintenanceRecord: { vehicleId: { in: vehicleIds } } },
                  { insurancePolicy: { vehicleId: { in: vehicleIds } } },
                  { warranty: { vehicleId: { in: vehicleIds } } },
                  { claim: { insurancePolicy: { vehicleId: { in: vehicleIds } } } },
                  { vehicleLoan: { vehicleId: { in: vehicleIds } } },
                ],
              },
              select: { fileName: true },
            }),
        this.prisma.auditEvent.count({
          where: { OR: [{ actorUserId: userId }, { ownerUserId: userId }] },
        }),
        this.prisma.notification.count({ where: { userId } }),
        this.prisma.productEvent.count({ where: { userId } }),
        this.prisma.vehicleMember.count({
          where: { userId, vehicle: { userId: { not: userId } } },
        }),
      ]);

    const storedObjects = (
      await Promise.all(
        storagePrefixesFor(userId).map((prefix) => this.storage.listObjectPaths(prefix)),
      )
    ).flat();

    return {
      userId: user.id,
      email: user.email,
      createdAt: user.createdAt,
      ownedVehicles: vehicles.map((vehicle) => ({
        id: vehicle.id,
        label: vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`,
        otherMembers: vehicle.members.filter((member) => member.userId !== userId).length,
      })),
      attachmentFiles: attachments.map((attachment) => attachment.fileName),
      storedObjects,
      auditEvents,
      notifications,
      productEvents,
      otherMemberships,
    };
  }

  async deleteAccount(userId: string): Promise<AccountDeletionResult> {
    const plan = await this.plan(userId);

    const shared = plan.ownedVehicles.filter((vehicle) => vehicle.otherMembers > 0);
    if (shared.length > 0) {
      throw new ConflictException(
        `Account ${userId} owns ${shared.length} vehicle(s) shared with other members. Transfer ownership before deleting it.`,
      );
    }

    // Anonymising walks the user's audit rows one by one, which can outlast
    // Prisma's five-second default on a long-lived account.
    await this.prisma.$transaction(
      async (tx) => {
        await this.auditService.anonymiseForUser(userId, tx);
        await tx.user.delete({ where: { id: userId } });
        await this.auditService.track(tx, {
          actorUserId: null,
          ownerUserId: null,
          action: AUDIT_ACTIONS.auth.accountDeleted,
          resourceType: AuditResourceType.user,
          resourceId: userId,
          before: null,
          after: { vehiclesDeleted: plan.ownedVehicles.length },
        });
      },
      { timeout: 120_000, maxWait: 10_000 },
    );

    // Files go only after the rows have: a failure here leaves a file nobody can
    // reach, where the other order could leave a row pointing at nothing.
    const result: AccountDeletionResult = {
      userId,
      vehiclesDeleted: plan.ownedVehicles.length,
      filesDeleted: 0,
      filesAlreadyGone: 0,
      orphansDeleted: 0,
      storageFailures: [],
    };

    for (const path of plan.attachmentFiles) {
      const outcome = await this.removeObject(path, result);
      if (outcome === 'deleted') result.filesDeleted += 1;
      if (outcome === 'missing') result.filesAlreadyGone += 1;
    }

    // Anything still under their prefixes that no row points at: files from a
    // failed upload, or from a record deleted before cleanup existed. A file
    // they uploaded to someone else's vehicle still has its row, and stays.
    for (const path of await this.findOrphanedObjects(storagePrefixesFor(userId))) {
      if ((await this.removeObject(path, result)) === 'deleted') result.orphansDeleted += 1;
    }

    return result;
  }

  /** Stored objects under `prefixes` that no attachment row points at. */
  async findOrphanedObjects(prefixes: readonly string[]): Promise<string[]> {
    const stored = (
      await Promise.all(prefixes.map((prefix) => this.storage.listObjectPaths(prefix)))
    ).flat();

    if (stored.length === 0) return [];

    const referenced = new Set(
      (
        await this.prisma.attachment.findMany({
          where: { fileName: { in: stored } },
          select: { fileName: true },
        })
      ).map((attachment) => attachment.fileName),
    );

    return stored.filter((path) => !referenced.has(path));
  }

  private async removeObject(
    path: string,
    result: AccountDeletionResult,
  ): Promise<'deleted' | 'missing' | 'failed'> {
    try {
      return await this.storage.deleteObject(path);
    } catch (error) {
      this.logger.error(
        `Could not remove ${path} from storage`,
        error instanceof Error ? error.stack : undefined,
      );
      result.storageFailures.push(path);
      return 'failed';
    }
  }
}

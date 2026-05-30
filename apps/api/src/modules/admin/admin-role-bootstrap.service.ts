import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { AuditService } from '../audit/audit.service';
import { computeAdminRoleReconciliation } from './admin-role-reconciliation';

/**
 * Reconciles the admin role against the ADMIN_EMAILS allowlist on boot.
 * The env var is the only way to mint an admin — there is no self-serve
 * promotion path. Listed users are promoted; admins no longer listed are
 * demoted. Each change is recorded as a system-actor AuditEvent.
 */
@Injectable()
export class AdminRoleBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminRoleBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.reconcile();
    } catch (error) {
      this.logger.error('Admin role reconciliation failed on boot', error as Error);
    }
  }

  private async reconcile(): Promise<void> {
    const currentAdmins = await this.prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true, email: true },
    });

    const { promote, demote } = computeAdminRoleReconciliation({
      currentAdminEmails: currentAdmins.map((user) => user.email),
      desiredAdminEmails: this.appConfig.adminEmails,
    });

    if (promote.length === 0 && demote.length === 0) {
      return;
    }

    await this.applyRoleChange(promote, 'admin', 'admin.role_granted');
    await this.applyRoleChange(demote, 'user', 'admin.role_revoked');

    this.logger.log(
      `Admin reconciliation complete: promoted ${promote.length}, demoted ${demote.length}.`,
    );
  }

  private async applyRoleChange(
    emails: string[],
    nextRole: 'admin' | 'user',
    action: string,
  ): Promise<void> {
    if (emails.length === 0) {
      return;
    }

    const users = await this.prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true, role: true },
    });

    for (const user of users) {
      if (user.role === nextRole) {
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { role: nextRole } });
        await this.audit.track(tx, {
          actorUserId: null,
          ownerUserId: user.id,
          action,
          resourceType: 'user',
          resourceId: user.id,
          before: { role: user.role },
          after: { role: nextRole },
        });
      });
    }
  }
}

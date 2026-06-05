import { AuditResourceType, Prisma } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminForceLogoutResponse,
  AdminUserListResponse,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';

export interface ListUsersOptions {
  search?: string;
  page?: number;
  limit?: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listUsers(options: ListUsersOptions = {}): Promise<AdminUserListResponse> {
    const page = Math.max(1, options.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, options.limit ?? DEFAULT_LIMIT));
    const search = options.search?.trim() || undefined;

    const where: Prisma.UserWhereInput | undefined = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailVerified: true,
          allowedCatalogSources: true,
          createdAt: true,
          _count: { select: { vehicles: true } },
        },
      }),
    ]);

    return {
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        allowedCatalogSources: user.allowedCatalogSources,
        vehicleCount: user._count.vehicles,
        createdAt: user.createdAt.toISOString(),
      })),
      meta: { page, limit, total, search },
    };
  }

  async forceLogout(
    actorUserId: string,
    targetUserId: string,
  ): Promise<AdminForceLogoutResponse> {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, refreshTokenHash: true },
    });
    if (!target) {
      throw new NotFoundException(`User ${targetUserId} was not found`);
    }

    const wasLoggedIn = target.refreshTokenHash != null;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: { refreshTokenHash: null },
      });
      await this.auditService.track(tx, {
        actorUserId,
        ownerUserId: targetUserId,
        action: AUDIT_ACTIONS.admin.forceLogout,
        resourceType: AuditResourceType.user,
        resourceId: targetUserId,
        before: { refreshTokenPresent: wasLoggedIn },
        after: { refreshTokenPresent: false },
      });
    });

    return { userId: targetUserId, refreshTokenCleared: wasLoggedIn };
  }
}

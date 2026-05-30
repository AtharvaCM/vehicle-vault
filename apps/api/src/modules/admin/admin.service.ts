import { Injectable } from '@nestjs/common';
import type { AdminUserListResponse } from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(): Promise<AdminUserListResponse> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
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
    });

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
    };
  }
}

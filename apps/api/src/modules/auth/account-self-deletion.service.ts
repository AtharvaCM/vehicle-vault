import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AccountDeletionCheckSchema,
  AccountDeletionSchema,
  type AccountDeletionCheck,
} from '@vehicle-vault/shared';
import { compare } from 'bcryptjs';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountDeletionService } from '../users/account-deletion.service';
import type { AccountDeletionDto } from './dto/account-deletion.dto';

/** How recent a sign-in has to be for an account with no password to confirm with it. */
export const FRESH_SIGN_IN_MINUTES = 15;

/**
 * An owner deleting their own account (#317): immediately, after a password
 * check (or, with no password, a sign-in in the last few minutes), and never
 * while a vehicle they own is shared with someone else. The deletion itself is
 * the purge's: rows cascade, the audit trail is anonymised, files are removed,
 * and every session goes with the user row.
 */
@Injectable()
export class AccountSelfDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountDeletion: AccountDeletionService,
  ) {}

  async check(userId: string, sessionId: string | null): Promise<AccountDeletionCheck> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('Invalid authentication token.');

    const plan = await this.accountDeletion.plan(userId);
    const hasPassword = Boolean(user.passwordHash);

    return AccountDeletionCheckSchema.parse({
      hasPassword,
      needsFreshSignIn: !hasPassword && !(await this.isFresh(sessionId)),
      vehicleCount: plan.ownedVehicles.length,
      fileCount: plan.attachmentFiles.length,
      sharedVehicles: plan.ownedVehicles
        .filter((vehicle) => vehicle.otherMembers > 0)
        .map(({ id, label, otherMembers }) => ({ id, label, otherMembers })),
    });
  }

  async delete(userId: string, sessionId: string | null, payload: AccountDeletionDto) {
    const input = AccountDeletionSchema.parse(payload);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('Invalid authentication token.');

    if (user.passwordHash) {
      // 400, not 401: a wrong password must not read as a dead session.
      if (!input.password || !(await compare(input.password, user.passwordHash))) {
        throw new BadRequestException('Your password is not right.');
      }
    } else if (!(await this.isFresh(sessionId))) {
      throw new ForbiddenException(
        `Sign in again to confirm: it has to be within the last ${FRESH_SIGN_IN_MINUTES} minutes.`,
      );
    }

    try {
      const result = await this.accountDeletion.deleteAccount(userId);
      return { deleted: true as const, vehiclesDeleted: result.vehiclesDeleted };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(
          'Hand over or stop sharing the vehicles other people use before deleting your account.',
        );
      }
      throw error;
    }
  }

  /** The current session began with a sign-in in the last few minutes. */
  private async isFresh(sessionId: string | null) {
    if (!sessionId) return false;
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      select: { createdAt: true },
    });
    return Boolean(
      session && Date.now() - session.createdAt.getTime() <= FRESH_SIGN_IN_MINUTES * 60_000,
    );
  }
}

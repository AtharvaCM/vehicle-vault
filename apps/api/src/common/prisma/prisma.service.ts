import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import {
  AuditCoverageScope,
  shouldEnableSafetyNet,
  wrapTransactionForAudit,
} from './audit-coverage';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly auditSafetyNet = shouldEnableSafetyNet(process.env.NODE_ENV);

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Dev/CI audit safety net (ADR-0004): for interactive transactions, every
   * mutation on an audited model must be accompanied by an AuditEvent write in
   * the same transaction. A violation throws (rolling the tx back) so forgotten
   * `auditService.track` call sites surface immediately. Disabled in production
   * and for the array (batch) form, which is read-only in this codebase.
   */
  $transaction<P extends Prisma.PrismaPromise<unknown>[]>(
    arg: [...P],
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<{
    [K in keyof P]: P[K] extends Prisma.PrismaPromise<infer T> ? T : never;
  }>;
  $transaction<R>(
    fn: (tx: Prisma.TransactionClient) => Promise<R>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<R>;
  $transaction(arg: unknown, options?: unknown): Promise<unknown> {
    if (!this.auditSafetyNet || typeof arg !== 'function') {
      return super.$transaction(arg as never, options as never);
    }

    const fn = arg as (tx: Prisma.TransactionClient) => Promise<unknown>;
    return super.$transaction(async (tx) => {
      const scope = new AuditCoverageScope();
      const result = await fn(wrapTransactionForAudit(tx, scope));
      scope.throwIfViolations();
      return result;
    }, options as never);
  }
}

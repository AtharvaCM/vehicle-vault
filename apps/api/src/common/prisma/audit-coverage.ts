const MUTATION_OPS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

export function isMutationOp(operation: string): boolean {
  return MUTATION_OPS.has(operation);
}

/**
 * The safety net is a dev/CI guard only — it must never block production writes.
 * See ADR-0004.
 */
export function shouldEnableSafetyNet(nodeEnv: string | undefined): boolean {
  return nodeEnv !== 'production';
}

/** Thrown (in dev/CI) when a transaction mutated audited models but emitted no AuditEvent. */
export class AuditCoverageError extends Error {
  constructor(readonly models: string[]) {
    super(
      `Transaction mutated audited model(s) [${models.join(', ')}] without emitting an AuditEvent. ` +
        `Call auditService.track(tx, ...) inside the same transaction, or add the model to DEFAULT_EXEMPT_MODELS if it is system/reference data. See ADR-0004.`,
    );
    this.name = 'AuditCoverageError';
  }
}

/**
 * Models whose mutations do not require an accompanying AuditEvent: the audit
 * table itself, system-ingested catalog/reference data, generated notifications,
 * auth bookkeeping (login timestamps, token rotation, OAuth linkage tracked at
 * the action level), and child/sub-artifact rows that ride their parent's audit.
 * See ADR-0004 for why the safety net exists.
 */
export const DEFAULT_EXEMPT_MODELS = new Set<string>([
  'AuditEvent',
  'VehicleCatalogMake',
  'VehicleCatalogModel',
  'VehicleCatalogGeneration',
  'VehicleCatalogVariant',
  'VehicleCatalogVariantSpec',
  'VehicleCatalogMakeAlias',
  'VehicleCatalogModelAlias',
  'VehicleCatalogGenerationAlias',
  'VehicleCatalogVariantAlias',
  'VehicleCatalogVariantOffering',
  'VehicleCatalogVariantOfferingOverride',
  'VehicleCatalogImportRun',
  'VehicleCatalogImportSnapshot',
  'User',
  'OAuthAccount',
  'Notification',
  'ServiceInterval',
  'AttachmentExtraction',
  'MaintenanceLineItem',
]);

export class AuditCoverageScope {
  private readonly mutatedModels = new Set<string>();
  private auditWritten = false;

  constructor(
    private readonly exemptModels: ReadonlySet<string> = DEFAULT_EXEMPT_MODELS,
  ) {}

  recordOperation(model: string, operation: string): void {
    if (!isMutationOp(operation)) {
      return;
    }
    if (model === 'AuditEvent') {
      this.auditWritten = true;
      return;
    }
    if (this.exemptModels.has(model)) {
      return;
    }
    this.mutatedModels.add(model);
  }

  violations(): string[] {
    if (this.auditWritten) {
      return [];
    }
    return [...this.mutatedModels];
  }

  throwIfViolations(): void {
    const models = this.violations();
    if (models.length > 0) {
      throw new AuditCoverageError(models);
    }
  }
}

function toModelName(delegateKey: string): string {
  return delegateKey.charAt(0).toUpperCase() + delegateKey.slice(1);
}

/**
 * Wraps a Prisma transaction client so every model operation it performs is
 * reported to the given scope before delegating to the real client. Client-level
 * members (`$queryRaw`, `$executeRaw`, symbols, etc.) pass through untouched —
 * only model delegates (object-valued string keys) are instrumented.
 */
export function wrapTransactionForAudit<T extends object>(
  tx: T,
  scope: AuditCoverageScope,
): T {
  return new Proxy(tx, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (
        typeof prop !== 'string' ||
        prop.startsWith('$') ||
        typeof value !== 'object' ||
        value === null
      ) {
        return value;
      }
      const model = toModelName(prop);
      return new Proxy(value, {
        get(delegate, op, delegateReceiver) {
          const member = Reflect.get(delegate, op, delegateReceiver);
          if (typeof op !== 'string' || typeof member !== 'function') {
            return member;
          }
          return (...args: unknown[]) => {
            scope.recordOperation(model, op);
            return (member as (...a: unknown[]) => unknown).apply(delegate, args);
          };
        },
      });
    },
  });
}

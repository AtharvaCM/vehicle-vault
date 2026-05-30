import { Injectable, Logger } from '@nestjs/common';
import type { ExtractionKind } from '@vehicle-vault/shared';

import type { AnyExtractionSpec, ExtractionSpec } from './types';

/**
 * Imperative registry of per-kind extraction specs. Consumer modules
 * call `register(spec)` from their `onModuleInit` to wire their kind
 * into the engine. Keeps the `extraction/` module free of domain imports.
 */
@Injectable()
export class ExtractionRegistry {
  private readonly logger = new Logger(ExtractionRegistry.name);
  private readonly specs = new Map<ExtractionKind, AnyExtractionSpec>();

  register(spec: AnyExtractionSpec): void {
    if (this.specs.has(spec.kind)) {
      this.logger.warn(
        `ExtractionSpec for kind "${spec.kind}" was registered twice; later registration wins.`,
      );
    }
    this.specs.set(spec.kind, spec);
  }

  get<T>(kind: ExtractionKind): ExtractionSpec<T> | undefined {
    return this.specs.get(kind) as ExtractionSpec<T> | undefined;
  }

  has(kind: ExtractionKind): boolean {
    return this.specs.has(kind);
  }
}

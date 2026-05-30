import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ExtractionKind, ExtractionResult } from '@vehicle-vault/shared';

import { ExtractionRegistry } from './extraction-registry.service';
import {
  EXTRACTION_PROVIDER,
  type ExtractionContext,
  type ExtractionFile,
  type ExtractionProvider,
} from './types';

@Injectable()
export class ExtractionService {
  constructor(
    @Inject(EXTRACTION_PROVIDER) private readonly provider: ExtractionProvider,
    private readonly registry: ExtractionRegistry,
  ) {}

  get isAvailable(): boolean {
    return this.provider.isAvailable;
  }

  hasKind(kind: ExtractionKind): boolean {
    return this.registry.has(kind);
  }

  async extract<T>(
    kind: ExtractionKind,
    files: ExtractionFile[],
    context?: ExtractionContext,
  ): Promise<ExtractionResult<T>> {
    const spec = this.registry.get<T>(kind);
    if (!spec) {
      throw new NotFoundException(
        `No ExtractionSpec registered for kind "${kind}".`,
      );
    }

    const prompt = spec.buildPrompt(files, context);
    const { raw } = await this.provider.generate({
      responseSchema: spec.responseSchema,
      prompt,
      files,
    });

    const data = spec.normalize(raw);
    const confidence = extractConfidence(raw);

    return {
      provider: this.provider.name,
      extractedAt: new Date().toISOString(),
      confidence,
      data,
    };
  }
}

function extractConfidence(raw: unknown): number | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const value = (raw as { confidence?: unknown }).confidence;
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return Math.min(1, Math.max(0, value));
}

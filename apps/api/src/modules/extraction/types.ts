import type { ExtractionKind, ExtractionResult } from '@vehicle-vault/shared';

/**
 * One uploaded file the extraction engine should reason over. Multiple
 * files in a single call are treated as ordered pages of one logical
 * document by the provider.
 */
export interface ExtractionFile {
  buffer: Buffer;
  mimeType: string;
  name?: string;
}

/**
 * Free-form hints handed to the prompt — e.g. the vehicle registration
 * number when scanning an insurance policy that might list multiple
 * vehicles. Spec decides how to incorporate these.
 */
export type ExtractionContext = Record<string, unknown>;

/**
 * One extraction kind's domain knowledge. Lives in the consumer module
 * that owns the target resource; registered with the engine via the
 * EXTRACTION_SPECS DI multi-provider token.
 *
 * `responseSchema` is provider-shaped (Gemini SchemaType today). When a
 * second provider lands, introduce a JSON-schema → provider-native
 * converter rather than threading the format through the engine.
 */
export interface ExtractionSpec<T> {
  readonly kind: ExtractionKind;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly responseSchema: any;
  buildPrompt(files: ExtractionFile[], context?: ExtractionContext): string;
  normalize(raw: unknown): T;
}

/**
 * Provider abstraction. One concrete impl lives at a time (DI-bound).
 * The engine never calls a provider SDK directly.
 */
export interface ExtractionProvider {
  readonly name: 'gemini';
  readonly isAvailable: boolean;
  generate(args: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responseSchema: any;
    prompt: string;
    files: ExtractionFile[];
  }): Promise<{ raw: unknown }>;
}

export const EXTRACTION_PROVIDER = Symbol('EXTRACTION_PROVIDER');

export type AnyExtractionSpec = ExtractionSpec<unknown>;
export type AnyExtractionResult = ExtractionResult<unknown>;

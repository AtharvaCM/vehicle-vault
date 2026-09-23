import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';

/**
 * Validates a bare (non-DTO) `:id`-style route param as a UUID and 404s on
 * anything malformed — matching the 404 a well-formed but unknown id already
 * gets, instead of a generic 400 or the 500 Postgres throws on an invalid
 * `uuid` literal. Use directly on scalar params: `@Param('id', new
 * UuidRouteParamPipe())`. For DTO-shaped params (`@Param() params: XyzDto`),
 * use `@IsUuidRouteParam()` on the DTO field instead — this pipe only runs
 * per-argument and can't see whole-object params.
 */
export class UuidRouteParamPipe extends ParseUUIDPipe {
  constructor() {
    // No `version` pin: the schema's `uuid` columns accept any version, and a
    // row minted with v1/v5/v7 (a future seed, import, or DB default) must
    // resolve the same as any other id, not 404 on every route that reads it.
    super({ exceptionFactory: () => new NotFoundException('Not found') });
  }
}

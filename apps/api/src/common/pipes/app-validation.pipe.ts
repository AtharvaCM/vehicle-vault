import { Injectable, NotFoundException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';

/**
 * The app's global `ValidationPipe`. Behaves exactly like the stock pipe,
 * except: a DTO field validated with `@IsUuidRouteParam()` (see
 * `common/validators/is-uuid-route-param.validator.ts`) that fails *only*
 * that check — nothing else wrong with the request — 404s instead of 400s.
 * That is how a malformed `:id`-style route param (`GET /vehicles/not-a-uuid`)
 * gets the same 404 a well-formed but unknown id already gets, without
 * changing 400 behaviour for ordinary body/query validation, including other
 * fields on the same DTO (e.g. an invalid `kind` beside a malformed
 * `documentId` still 400s).
 */
@Injectable()
export class AppValidationPipe extends ValidationPipe {
  override createExceptionFactory() {
    const defaultExceptionFactory = super.createExceptionFactory();

    return (validationErrors: ValidationError[] = []) => {
      if (isMalformedUuidRouteParam(validationErrors)) {
        return new NotFoundException('Not found');
      }
      return defaultExceptionFactory(validationErrors);
    };
  }
}

function isMalformedUuidRouteParam(errors: ValidationError[]): boolean {
  return (
    errors.length > 0 &&
    errors.every((error) => {
      const constraintKeys = Object.keys(error.constraints ?? {});
      return constraintKeys.length === 1 && constraintKeys[0] === 'isUuidRouteParam';
    })
  );
}

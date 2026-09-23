import { isUUID, registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Marks a route-param DTO field as a UUID primary key whose malformed value
 * should 404, not 400 — the counterpart to `UuidRouteParamPipe` for the
 * `@Param() params: XyzDto` shape, where a per-argument pipe can't see one
 * field of the object. `AppValidationPipe` (see `app-validation.pipe.ts`)
 * recognises the `isUuidRouteParam` constraint name and remaps it to 404;
 * every other validation failure (including a mixed failure alongside a
 * non-id field on the same DTO) still 400s as usual.
 *
 * Only use this on a DTO field that is exclusively bound via `@Param()` —
 * never on a `@Body()`/`@Query()` DTO field, where a malformed value should
 * stay a 400.
 */
export function IsUuidRouteParam(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isUuidRouteParam',
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isUUID(value, '4');
        },
        defaultMessage(): string {
          return 'Not found';
        },
      },
    });
  };
}

import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

type SchemaValidationResult =
  | {
      success: true;
      data: unknown;
    }
  | {
      success: false;
      error: {
        flatten: () => unknown;
      };
    };

type SchemaValidator = {
  safeParse: (value: unknown) => SchemaValidationResult;
};

@Injectable()
export class ZodSchemaValidationPipe implements PipeTransform {
  constructor(private readonly schema: SchemaValidator) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Schema validation failed',
        details: result.error.flatten(),
      });
    }

    return result.data;
  }
}

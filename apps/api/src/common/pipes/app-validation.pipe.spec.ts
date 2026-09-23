import { BadRequestException, NotFoundException, type ArgumentMetadata } from '@nestjs/common';
import { IsIn, IsString, MinLength } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { IsUuidRouteParam } from '../validators/is-uuid-route-param.validator';
import { AppValidationPipe } from './app-validation.pipe';

class VehicleIdParamFixture {
  @IsUuidRouteParam()
  vehicleId!: string;
}

class DocumentAttachmentsParamFixture {
  @IsIn(['insurance', 'warranty'])
  kind!: string;

  @IsUuidRouteParam()
  documentId!: string;
}

class CreateVehicleBodyFixture {
  @IsString()
  @MinLength(1)
  make!: string;
}

function paramMetadata(metatype: unknown): ArgumentMetadata {
  return { type: 'param', metatype: metatype as ArgumentMetadata['metatype'], data: undefined };
}

function bodyMetadata(metatype: unknown): ArgumentMetadata {
  return { type: 'body', metatype: metatype as ArgumentMetadata['metatype'], data: undefined };
}

describe('AppValidationPipe', () => {
  const pipe = new AppValidationPipe({ transform: true, whitelist: true });

  it('404s a malformed :id-style route param', async () => {
    await expect(
      pipe.transform({ vehicleId: 'not-a-uuid' }, paramMetadata(VehicleIdParamFixture)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('passes a well-formed route param id through', async () => {
    const id = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    const result = await pipe.transform({ vehicleId: id }, paramMetadata(VehicleIdParamFixture));

    expect(result.vehicleId).toBe(id);
  });

  it('still 400s an ordinary body validation failure, unrelated to any id', async () => {
    await expect(
      pipe.transform({ make: '' }, bodyMetadata(CreateVehicleBodyFixture)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s when only the id-shaped field is malformed on a mixed DTO', async () => {
    await expect(
      pipe.transform(
        { kind: 'insurance', documentId: 'not-a-uuid' },
        paramMetadata(DocumentAttachmentsParamFixture),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('400s a mixed DTO when a non-id field is also invalid, even if the id is malformed too', async () => {
    await expect(
      pipe.transform(
        { kind: 'not-a-real-kind', documentId: 'not-a-uuid' },
        paramMetadata(DocumentAttachmentsParamFixture),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

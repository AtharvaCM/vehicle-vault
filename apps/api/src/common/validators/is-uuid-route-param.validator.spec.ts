import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { IsUuidRouteParam } from './is-uuid-route-param.validator';

class FixtureDto {
  @IsUuidRouteParam()
  vehicleId!: string;
}

describe('IsUuidRouteParam', () => {
  it('passes a well-formed v4 UUID', async () => {
    const dto = new FixtureDto();
    dto.vehicleId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails a malformed id with only the isUuidRouteParam constraint', async () => {
    const dto = new FixtureDto();
    dto.vehicleId = 'not-a-uuid';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(Object.keys(errors[0].constraints ?? {})).toEqual(['isUuidRouteParam']);
  });

  it('fails a non-v4 UUID', async () => {
    const dto = new FixtureDto();
    dto.vehicleId = 'a8098c1a-f86e-11da-bd1a-00112444be1e';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(Object.keys(errors[0].constraints ?? {})).toEqual(['isUuidRouteParam']);
  });
});

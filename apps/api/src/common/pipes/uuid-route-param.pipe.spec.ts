import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { UuidRouteParamPipe } from './uuid-route-param.pipe';

describe('UuidRouteParamPipe', () => {
  const pipe = new UuidRouteParamPipe();
  const metadata = { type: 'param', data: 'id' } as const;

  it('passes a well-formed UUID through unchanged', async () => {
    const id = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    await expect(pipe.transform(id, metadata)).resolves.toBe(id);
  });

  it('404s a malformed id instead of 400ing or throwing raw', async () => {
    await expect(pipe.transform('not-a-uuid', metadata)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s an empty id', async () => {
    await expect(pipe.transform('', metadata)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('accepts a well-formed UUID of a version other than v4', async () => {
    // Every id column is generated as v4 today, but the schema's `uuid` type
    // accepts any version, and a v1/v7 id (a future seed, import, or DB
    // default) must resolve like any other, not 404 on every route.
    const v1 = 'a8098c1a-f86e-11da-bd1a-00112444be1e';
    const v7 = '01890a5d-ac96-774b-bcce-b302099a8057';

    await expect(pipe.transform(v1, metadata)).resolves.toBe(v1);
    await expect(pipe.transform(v7, metadata)).resolves.toBe(v7);
  });
});

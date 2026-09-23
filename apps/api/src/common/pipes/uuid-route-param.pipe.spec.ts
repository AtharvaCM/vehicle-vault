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

  it('404s a well-formed but wrong-version UUID (v1)', async () => {
    // ParseUUIDPipe defaults to accepting any version; this pipe is pinned to v4,
    // the version every id column in the schema is generated with.
    await expect(
      pipe.transform('a8098c1a-f86e-11da-bd1a-00112444be1e', metadata),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

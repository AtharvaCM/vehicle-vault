import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { RegisterDto } from './register.dto';

/** Mirrors the global pipe configured in `main.ts`. */
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

const metadata = { type: 'body' as const, metatype: RegisterDto };

const transform = (body: unknown) => pipe.transform(body, metadata);

const account = {
  name: 'Aarav',
  email: 'aarav@example.test',
  password: 'password123',
};

describe('RegisterDto catalogModel', () => {
  it('accepts a sign-up without it', async () => {
    expect((await transform(account)).catalogModel).toBeUndefined();
  });

  it.each(['city', 'xuv-3xo', 'model-3'])('accepts the slug %j', async (slug) => {
    await expect(transform({ ...account, catalogModel: slug })).resolves.toMatchObject({
      catalogModel: slug,
    });
  });

  // It lands in product telemetry, which holds flat non-personal values only.
  it.each(['', 'City', 'someone@example.test', 'two words', '-city', 'city--x', 'a'.repeat(121)])(
    'rejects %j',
    async (value) => {
      await expect(transform({ ...account, catalogModel: value })).rejects.toThrow();
    },
  );

  it('still refuses fields it does not know', async () => {
    await expect(transform({ ...account, source: 'catalog' })).rejects.toThrow();
  });
});

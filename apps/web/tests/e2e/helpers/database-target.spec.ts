import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveE2eDatabaseUrl } from './database-target';

const LOCAL = 'postgresql://postgres:postgres@127.0.0.1:5432/vehicle_vault?schema=public';

/**
 * A remote database URL with a password in it, on a reserved `.test` host.
 * Assembled through the URL API rather than written as one literal: the
 * credentials are made up, but a secret scanner cannot tell, and a public
 * repository should not carry anything shaped like a real connection string.
 */
const FAKE_USER = 'app_user';
const FAKE_PASSWORD = 'not-a-real-password';
const HOSTED = (() => {
  const url = new URL('postgresql://db.example.test:6543/postgres');
  url.username = FAKE_USER;
  url.password = FAKE_PASSWORD;
  return url.toString();
})();

describe('resolveE2eDatabaseUrl', () => {
  let dir: string;
  let envFile: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-db-'));
    envFile = path.join(dir, '.env');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('accepts a local database from the environment', () => {
    expect(resolveE2eDatabaseUrl({ DATABASE_URL: LOCAL }, envFile)).toBe(LOCAL);
  });

  it('accepts every spelling of this machine', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      const url = `postgresql://postgres:postgres@${host}:5432/db`;
      expect(resolveE2eDatabaseUrl({ DATABASE_URL: url }, envFile)).toBe(url);
    }
  });

  it('falls back to the API env file when the variable is unset, as local runs do', () => {
    fs.writeFileSync(envFile, `# comment\nPORT=3001\nDATABASE_URL=${LOCAL}\n`);

    expect(resolveE2eDatabaseUrl({}, envFile)).toBe(LOCAL);
  });

  it('prefers the variable over the file, as CI relies on', () => {
    fs.writeFileSync(envFile, `DATABASE_URL=${HOSTED}\n`);

    expect(resolveE2eDatabaseUrl({ DATABASE_URL: LOCAL }, envFile)).toBe(LOCAL);
  });

  it('refuses a remote database reached through the API env file — the setup that filled prod', () => {
    fs.writeFileSync(envFile, `DATABASE_URL=${HOSTED}\n`);

    expect(() => resolveE2eDatabaseUrl({}, envFile)).toThrow(
      /Refusing to let the e2e suite write to a remote database \(db\.example\.test, from DATABASE_URL in .*\.env\)[\s\S]*E2E_ALLOW_REMOTE_DATABASE=1/,
    );
  });

  it('never puts the password in the refusal', () => {
    let message = '';
    try {
      resolveE2eDatabaseUrl({ DATABASE_URL: HOSTED }, envFile);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('db.example.test');
    expect(message).not.toContain(FAKE_PASSWORD);
    expect(message).not.toContain(FAKE_USER);
  });

  it('allows a remote database only with the explicit override', () => {
    expect(
      resolveE2eDatabaseUrl({ DATABASE_URL: HOSTED, E2E_ALLOW_REMOTE_DATABASE: '1' }, envFile),
    ).toBe(HOSTED);

    for (const value of ['', '0', 'false', 'nope']) {
      expect(() =>
        resolveE2eDatabaseUrl({ DATABASE_URL: HOSTED, E2E_ALLOW_REMOTE_DATABASE: value }, envFile),
      ).toThrow(/remote database/);
    }
  });

  it('explains a missing env file instead of surfacing ENOENT', () => {
    expect(() => resolveE2eDatabaseUrl({}, envFile)).toThrow(
      /DATABASE_URL is not set and .* does not exist/,
    );
  });

  it('does not echo an unparsable value, which may hold a password', () => {
    let message = '';
    try {
      resolveE2eDatabaseUrl({ DATABASE_URL: `not a url ${FAKE_PASSWORD}` }, envFile);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toBe('DATABASE_URL could not be parsed as a URL.');
  });
});

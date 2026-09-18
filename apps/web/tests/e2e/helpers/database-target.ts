import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The database the e2e suite writes to directly, and the guard that keeps it
 * local.
 *
 * Verification links only arrive by email, so the specs mark new users
 * verified straight in the database (`test-db.ts`). That makes this a second
 * way into production independent of the API proxy: `apps/api/.env` is read by
 * `pnpm dev:api` and by this suite alike, so if it points at a hosted database,
 * a run against the "local" API writes every test account there anyway.
 *
 * Any non-local host is refused rather than only production's, because this
 * repository is public and naming the production database here would publish
 * it — and a remote database receiving test accounts is worth a second look
 * whichever one it is.
 */

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Where the API keeps its env, and where local runs usually find the database.
 * A function rather than a constant: `import.meta.url` is only a `file:` URL
 * under Node, and the unit tests pass an explicit path from a jsdom runtime.
 */
function defaultApiEnvPath(): string {
  return fileURLToPath(new URL('../../../../api/.env', import.meta.url));
}

type Env = Record<string, string | undefined>;

export function resolveE2eDatabaseUrl(env: Env, apiEnvPath = defaultApiEnvPath()): string {
  // CI exports DATABASE_URL from the workflow and never writes apps/api/.env;
  // local runs have the file and usually not the variable.
  const fromEnv = env.DATABASE_URL?.trim();
  const url = fromEnv || readEnvValue(apiEnvPath, 'DATABASE_URL');
  const source = fromEnv ? 'DATABASE_URL' : `DATABASE_URL in ${apiEnvPath}`;

  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    // Deliberately not echoing the value: it carries the database password.
    throw new Error(`${source} could not be parsed as a URL.`);
  }

  if (!LOCAL_DATABASE_HOSTS.has(host) && !isSet(env.E2E_ALLOW_REMOTE_DATABASE)) {
    throw new Error(
      [
        `Refusing to let the e2e suite write to a remote database (${host}, from ${source}).`,
        'The specs register users and mark them verified directly in that database, so every run would leave accounts there.',
        'Run the API and the suite against a local Postgres — see "End-to-end tests" in the README.',
        'If you really mean a remote database, set E2E_ALLOW_REMOTE_DATABASE=1 as well.',
      ].join('\n'),
    );
  }

  return url;
}

function readEnvValue(filePath: string, key: string): string {
  let contents: string;
  try {
    contents = fs.readFileSync(filePath, 'utf8');
  } catch {
    throw new Error(
      `${key} is not set and ${filePath} does not exist. Set ${key} to a local Postgres, or create apps/api/.env from apps/api/.env.example.`,
    );
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;
    if (line.slice(0, separatorIndex).trim() !== key) continue;

    return line.slice(separatorIndex + 1).trim();
  }

  throw new Error(`Missing ${key} in ${filePath}`);
}

function isSet(value: string | undefined): boolean {
  return ['1', 'true', 'yes'].includes(value?.trim().toLowerCase() ?? '');
}

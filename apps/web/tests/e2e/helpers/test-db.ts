import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiWorkspacePath = path.resolve(__dirname, '../../../../api');
const apiEnvPath = path.join(apiWorkspacePath, '.env');
const requireFromApi = createRequire(import.meta.url);
const { PrismaClient } = requireFromApi(path.join(apiWorkspacePath, 'node_modules/@prisma/client'));

// CI exports DATABASE_URL from the workflow and never writes apps/api/.env;
// local runs have the file and usually not the variable.
function resolveDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || readEnvValue(apiEnvPath, 'DATABASE_URL');
}

function readEnvValue(filePath: string, key: string) {
  const contents = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const currentKey = line.slice(0, separatorIndex).trim();

    if (currentKey !== key) {
      continue;
    }

    return line.slice(separatorIndex + 1).trim();
  }

  throw new Error(`Missing ${key} in ${filePath}`);
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: resolveDatabaseUrl(),
    },
  },
});

/**
 * Email verification is mandatory, and the verification link only arrives by
 * email — which the e2e environment deliberately cannot receive. Flip the flag
 * straight in the database instead.
 */
export async function markUserEmailVerified(email: string) {
  await prisma.user.update({
    where: {
      email: email.toLowerCase(),
    },
    data: {
      emailVerified: true,
      emailVerificationTokenHash: null,
    },
  });
}

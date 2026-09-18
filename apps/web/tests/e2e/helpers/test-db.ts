import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveE2eDatabaseUrl } from './database-target';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiWorkspacePath = path.resolve(__dirname, '../../../../api');
const requireFromApi = createRequire(import.meta.url);
const { PrismaClient } = requireFromApi(path.join(apiWorkspacePath, 'node_modules/@prisma/client'));

export const prisma = new PrismaClient({
  datasources: {
    db: {
      // Same resolution and guard the Playwright config already ran at load;
      // repeated here so importing this module on its own is just as safe.
      url: resolveE2eDatabaseUrl(process.env),
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

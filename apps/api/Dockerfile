FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json

RUN pnpm install --frozen-lockfile

COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm --filter @vehicle-vault/shared build
RUN pnpm --filter @vehicle-vault/api exec prisma generate --schema prisma/schema.prisma
RUN pnpm --filter @vehicle-vault/api build
RUN pnpm --filter @vehicle-vault/api deploy --legacy --prod /prod/api
RUN cd /prod/api && node_modules/.bin/prisma generate --schema prisma/schema.prisma

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=build /prod/api ./

EXPOSE 3001

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma && node dist/main.js"]

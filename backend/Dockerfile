# Build context is ./backend.
#
# Debian rather than Alpine: Prisma ships a query engine per libc, and the glibc
# build is the one with the fewest surprises.

# --- dependencies ----------------------------------------------------------
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# @prisma/client's postinstall would try to generate before the TypeScript that
# reads prisma.config.ts is guaranteed to be installed. Generation happens
# explicitly in the next stage instead.
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

COPY package.json package-lock.json ./

RUN npm ci

# --- build -----------------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate && npm run build

# Drop devDependencies from the tree that ships, then regenerate the client,
# because pruning removes the engine `prisma generate` just produced.
RUN npm prune --omit=dev \
  && npx prisma generate --schema src/database/schema.prisma

# --- runtime ---------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# OpenSSL is what the Prisma query engine links against; the slim image omits it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl wget \
  && rm -rf /var/lib/apt/lists/*

# Owned by `node`, not root: `prisma migrate deploy` verifies its engines on
# startup and needs to write under node_modules/@prisma to do it.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json

# The migration runner reads the schema and the .sql files from source, so those
# two ship alongside the compiled output. prisma.config.ts deliberately does not:
# it is TypeScript, and the runtime image has no TypeScript. Commands that need
# the schema pass --schema instead.
COPY --from=build --chown=node:node /app/src/database/schema.prisma ./src/database/schema.prisma
COPY --from=build --chown=node:node /app/src/database/migrations ./src/database/migrations

# The base image ships an unprivileged `node` user; nothing here wants root.
USER node

EXPOSE 4000

# Hits /health, which checks the database rather than just the event loop, so
# compose does not call an API ready when it cannot serve a request.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:4000/health || exit 1

CMD ["node", "dist/src/main.js"]

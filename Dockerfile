# Multi-stage Dockerfile for Ban4Life
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install native build tools for better-sqlite3 and git for git-hosted dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Stage 1: Build packages and apps
FROM base AS builder
WORKDIR /app

COPY pnpm-workspace.yaml package.json turbo.json pnpm-lock.yaml .npmrc ./
COPY patches ./patches
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile=false
RUN pnpm approve-builds --all

COPY packages ./packages
COPY apps ./apps

RUN pnpm --filter @ban4life/types build
RUN pnpm --filter @ban4life/web build
RUN pnpm --filter @ban4life/api build

# Stage 2: Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/turbo.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/types ./packages/types
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Persistent data directory for SQLite database and Baileys auth tokens
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]

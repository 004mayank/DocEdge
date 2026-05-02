# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps

# Monorepo deps (keep this layer stable for caching)
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages

RUN pnpm -w install --frozen-lockfile

# Also install app-local node_modules (some tooling expects this layout)
RUN pnpm -C apps/api install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .

# Build the API (main) + worker entry
RUN pnpm -C apps/api build
RUN pnpm -C apps/api build:worker

FROM node:20-alpine AS runtime
WORKDIR /app

RUN corepack enable

ENV NODE_ENV=production

# Minimal files needed to install runtime deps + run compiled output
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages ./packages

# Install production deps for the API.
# We use shameful hoisting to guarantee classic Node resolution inside the container
# (e.g. "require('@nestjs/core')").
RUN pnpm -C apps/api install --prod --frozen-lockfile --shamefully-hoist

COPY --from=build /app/apps/api/dist ./dist

# SQL migrations live outside the compiled TS output.
COPY apps/api/drizzle ./drizzle

EXPOSE 3001
CMD ["node", "dist/main"]

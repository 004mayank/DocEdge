# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages
RUN pnpm -w install --frozen-lockfile

# Ensure app-local node_modules exist (Next build expects deps in apps/web/node_modules)
RUN pnpm -C apps/web install --frozen-lockfile

FROM base AS build

# Next.js needs NEXT_PUBLIC_* at build time for the browser bundle.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

# Build Next.js
RUN pnpm -C apps/web build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Ensure pnpm is available for the runtime CMD ("pnpm start").
RUN corepack enable

# Next.js runtime needs a correct node_modules layout (pnpm in build stage may be non-hoisted).
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages ./packages
RUN pnpm -C apps/web install --prod --frozen-lockfile --shamefully-hoist

COPY --from=build /app/apps/web/.next ./.next
COPY --from=build /app/apps/web/public ./public
COPY --from=build /app/apps/web/package.json ./package.json
# Keep the runtime node_modules we just installed (do not overwrite from build stage)
COPY --from=build /app/apps/web/next.config.mjs ./next.config.mjs

EXPOSE 3000
CMD ["pnpm", "start"]

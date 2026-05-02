# DocEdge – Docker Compose (full stack)

This repo includes a full local/dev stack:

- **Web (Next.js)**
- **API (NestJS)**
- **Worker (NestJS background jobs)**
- **Postgres**
- **Redis**
- **MinIO (S3-compatible storage)** + one-shot bucket init

## Prerequisites

- Docker Desktop (or Docker Engine + Compose v2)

## Quick start

From repo root:

```bash
docker compose --env-file .env -f infra/docker-compose.full.yml up -d --build
```

If you don’t have a `.env` yet, copy the example:

```bash
cp .env.example .env
```

## URLs

- Web: http://localhost:3000
- API: http://localhost:3002
  - Health check: http://localhost:3002/health
- MinIO:
  - S3 endpoint: http://localhost:9000
  - Console: http://localhost:9001
- Redis: redis://localhost:6379

> Postgres is **not exposed** to the host by default (to avoid port conflicts). It’s reachable from other containers at `postgres:5432`.

## Default credentials (dev)

- Postgres
  - user: `docedge`
  - password: `docedge`
  - db: `docedge`
- MinIO
  - access key: `minio`
  - secret key: `minio123456`
  - bucket: `docedge` (created by `minio-init`)

## Common commands

```bash
# View running services
docker compose -f infra/docker-compose.full.yml ps

# Tail logs
docker compose -f infra/docker-compose.full.yml logs -f --tail=200

# Rebuild + restart
docker compose -f infra/docker-compose.full.yml up -d --build

# Stop
docker compose -f infra/docker-compose.full.yml down

# Stop + delete volumes (DANGEROUS: wipes DB + MinIO data)
docker compose -f infra/docker-compose.full.yml down -v
```

## Configuration

See `.env.example` for required keys:

- `JWT_SECRET` (required)
- `OPENAI_API_KEY` (if using OpenAI)
- `DEEPGRAM_API_KEY` (if using Deepgram STT)
- `NEXT_PUBLIC_API_BASE_URL` (web → api base URL)

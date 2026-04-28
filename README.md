# DocEdge

Production-ready, scalable **clinical intelligence** platform (not a copilot) for clinics.

**DocEdge** is an AI-powered clinical platform that helps doctors **capture, understand, and act on patient data in real time**.

## MVP (this repo scaffolds)
- Doctor auth (JWT) + clinic multi-tenancy
- Patient profiles + timeline
- Consultation sessions + audio upload
- Async processing: STT → AI SOAP note → persist
- Manual document upload (S3/MinIO)
- Web UI (Next.js) for doctor + patient link

## Monorepo layout
```
apps/
  api/   NestJS API + background worker (BullMQ)
  web/   Next.js (doctor dashboard + patient link)
infra/
  docker-compose.yml (postgres, redis, minio)
```

## Local dev
1) Copy env
```bash
cp .env.example .env
```

2) Start infra
```bash
pnpm infra:up
```

3) Run API
```bash
cd apps/api
pnpm dev
```

4) Run Web
```bash
cd apps/web
pnpm dev
```

## Notes
- **STT provider** default is `deepgram` (highest accuracy in many noisy clinical settings). Configure `DEEPGRAM_API_KEY`.
- **AI provider** default is `openai`. You can later switch `AI_PROVIDER=internal` and plug your model.

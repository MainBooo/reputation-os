# Reputation OS / Reputation Inbox

B2B SaaS for:
- review monitoring
- mention monitoring
- web mentions/articles
- ratings aggregation
- AI-ready reply drafts
- notification-ready architecture
- VK monitoring

## Monorepo structure

- `apps/frontend`
- `apps/api`
- `apps/worker`
- `packages/shared`
- `packages/config`
- `prisma`

## Local requirements

- Node.js 20+
- pnpm 8+
- Docker / Docker Compose
- PostgreSQL 16
- Redis 7

## Local startup

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/frontend/.env.example apps/frontend/.env
cp apps/worker/.env.example apps/worker/.env

docker compose up -d
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm --filter api dev
pnpm --filter worker dev
pnpm --filter frontend dev
```

Frontend:
- `http://localhost:3001`

API:
- `http://localhost:3000/api`

## Prisma

Generate client:

```bash
pnpm prisma:generate
```

Run migrations:

```bash
pnpm prisma:migrate
```

Seed demo data:

```bash
pnpm prisma:seed
```

## Seed/demo coverage

Seed includes:
- demo user
- workspace
- 2 companies
- aliases
- sources
- source targets
- mentions/reviews
- rating snapshots
- AIReplyDraft example
- NotificationRule example
- JobLog examples
- VK search profiles
- VK tracked communities
- VK tracked posts
- VK post mention
- VK comment mention

This makes:
- dashboard non-empty
- inbox non-empty
- ratings non-empty
- analytics non-empty
- VK page non-empty

## PM2

Production ecosystem file:

- `infra/pm2/ecosystem.config.js`

Typical usage:

```bash
pnpm --filter api build
pnpm --filter worker build
pnpm --filter frontend build

pm2 start infra/pm2/ecosystem.config.js
pm2 save
```

## nginx

Example config:
- `infra/nginx/reputation.example.conf`

Map:
- `reputation.example.com` -> frontend on `3001`
- `api.reputation.example.com` -> api on `3000`

## VK monitoring modes

### BRAND_SEARCH
- uses `VkSearchProfile`
- discovers posts by brand queries
- then comments for relevant posts
- then relevance scoring
- persists only relevant mentions/comments

### PRIORITY_COMMUNITIES
- uses `VkTrackedCommunity` with mode `PRIORITY_COMMUNITY`
- scans only configured communities
- fetches posts
- then comments for relevant posts
- then persists relevant mentions

### OWNED_COMMUNITY
- uses `VkTrackedCommunity` with mode `OWNED_COMMUNITY`
- frequent incremental sync
- callback-ready / event-ready architecture
- comments/posts are persisted with higher monitoring priority

## Current mock / stub areas

Real-world integrations may need API keys, rate limits, or anti-bot handling.

Current hybrid implementation:
- Yandex / Google / 2GIS adapters: demo/mock-backed
- Web monitor: demo-safe Playwright-ready structure
- VK adapter: real architecture, demo/mock data path, replaceable with real VK API integration later
- AI replies: stub reply generator
- notifications sending: placeholder processor

## Replacing stubs later

### VK
Replace `apps/worker/src/adapters/vk.adapter.ts` with:
- real VK API client
- pagination cursors
- access token handling
- comment sync windows
- callback ingestion later

### External review platforms
Replace:
- `YandexAdapter`
- `GoogleAdapter`
- `TwoGisAdapter`
- `WebMentionAdapter`

with:
- official APIs where possible
- authenticated scraping pipelines if needed
- proxy / anti-bot strategy

## VPS deployment notes

Typical layout:

```bash
/opt/reputation-os
```

Run:
- api on `3000`
- frontend on `3001`
- worker as background process
- nginx in front

## Health endpoints

API:
- `GET /api/health`

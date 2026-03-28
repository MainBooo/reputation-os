# First-run checklist

## Files
- [ ] unpack all 6 archives into the same root
- [ ] verify folders:
  - apps/api
  - apps/frontend
  - apps/worker
  - packages/shared
  - packages/config
  - prisma

## Env
- [ ] copy root `.env.example` to `.env`
- [ ] copy `apps/api/.env.example` to `apps/api/.env`
- [ ] copy `apps/frontend/.env.example` to `apps/frontend/.env`
- [ ] copy `apps/worker/.env.example` to `apps/worker/.env`

## Services
- [ ] run `docker compose up -d`
- [ ] confirm postgres on 5432
- [ ] confirm redis on 6379

## Prisma
- [ ] run `pnpm install`
- [ ] run `pnpm prisma:generate`
- [ ] run `pnpm prisma:migrate`
- [ ] run `pnpm prisma:seed`

## Run apps
- [ ] run `pnpm --filter api dev`
- [ ] run `pnpm --filter worker dev`
- [ ] run `pnpm --filter frontend dev`

## Smoke test
- [ ] open `http://localhost:3001/login`
- [ ] login with:
  - email: `demo@reputation.local`
  - password: `demo123`
- [ ] check dashboard is non-empty
- [ ] check companies list is non-empty
- [ ] check company inbox is non-empty
- [ ] check ratings page has data
- [ ] check analytics page has data
- [ ] check VK page has:
  - profiles
  - communities
  - tracked posts
  - relevant VK mentions/comments

# Troubleshooting

## 1. Prisma client not generated
Symptom:
- imports from `@prisma/client` fail
Fix:
```bash
pnpm prisma:generate
```

## 2. Seed fails on missing columns
Symptom:
- prisma seed references fields not in database yet
Fix:
```bash
pnpm prisma:migrate
pnpm prisma:generate
pnpm prisma:seed
```

## 3. API starts but frontend gets 404 from backend
Check:
- frontend uses `NEXT_PUBLIC_API_URL=http://localhost:3000`
- backend global prefix is `/api`

Expected:
- frontend requests `http://localhost:3000/api/...`

## 4. Login fails
Use seeded credentials:
- email: `demo@reputation.local`
- password: `demo123`

If still failing:
- rerun seed
- confirm database is the same one from env

## 5. Worker has no effect
Check:
- redis is running
- worker env has correct `REDIS_URL`
- seed data exists
- scheduler registered companies after startup

## 6. VK page empty
Check:
- seed completed successfully
- seeded:
  - VkSearchProfile
  - VkTrackedCommunity
  - VkTrackedPost
  - VK Mention entries

## 7. PM2 cannot start production apps
Check:
- builds exist:
  - apps/api/dist
  - apps/worker/dist
  - apps/frontend/.next
- pm2 paths in `infra/pm2/ecosystem.config.js` match VPS folder layout

## 8. nginx reverse proxy returns 502
Check:
- frontend process on `3001`
- api process on `3000`
- nginx config uses `127.0.0.1`

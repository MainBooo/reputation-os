# Deployment

Основной проверенный runbook находится в `sale-package/DEPLOYMENT_GUIDE.md`. Этот файл оставляет короткий безопасный production-порядок и больше не является старым Telegram-bot patch scaffold.

```bash
cd /opt/reputation-os
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma migrate deploy
pnpm build
```

После успешной сборки перезапустите только процессы ReputationOS через фактический PM2-конфиг окружения и проверьте `/api/health`, worker heartbeat, Redis и статус интеграций в admin UI.

Перед первым запуском:

- создать production `.env` из `.env.example` и заменить каждый placeholder;
- задать сильные `JWT_SECRET` и `INTERNAL_JOBS_SECRET`;
- для реальных платежей задать `BILLING_PROVIDER=yookassa` и credentials ЮKassa;
- применить только `prisma migrate deploy`, не `prisma db push`;
- отдельно создать Telegram Bot API credentials и MTProto Scout session, если эти функции включаются;
- ограничить PostgreSQL/Redis приватной сетью или localhost;
- проверить backup и провести тестовый restore на отдельной БД.

Не выполнять production seed по cron. Seed допустим только как осознанный bootstrap после чтения `prisma/seed.ts`.

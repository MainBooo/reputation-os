# ReputationOS

ReputationOS — multi-tenant платформа мониторинга репутации: отзывы Яндекс Карт и 2ГИС, WEB-страницы, Telegram Scout, Inbox, аналитика, AI-черновики ответов, уведомления и биллинг ЮKassa.

## Структура

- `apps/api` — NestJS REST API, auth, workspace ACL, billing, companies, mentions, analytics.
- `apps/worker` — BullMQ processors, scheduler, source adapters, WEB monitoring, Telegram Scout.
- `apps/frontend` — Next.js кабинет.
- `apps/landing` — Next.js лендинг.
- `apps/bot` — отдельный Telegram-бот уведомлений; это не MTProto Scout.
- `prisma` — schema, production migrations и seed.
- `sale-package` — buyer/deployment/due-diligence документы.

## Локальный запуск

Требуются Node.js, pnpm, PostgreSQL и Redis. Скопируйте `.env.example` в локальный `.env`, замените все placeholder-значения и не коммитьте секреты.

```bash
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma migrate deploy
pnpm dev
```

## Проверка

```bash
pnpm --filter api test
pnpm --filter worker test
pnpm --filter frontend test:e2e
pnpm build
```

ESLint scripts в части приложений исторически существуют без совместимого root-конфига; актуальный статус всех validation-команд фиксируется в `sale-package/LOGIC_AUDIT_FIX_REPORT.md`.

## Важные runtime-правила

- Backend/worker — источник истины для entitlement и tenant isolation; frontend gates не являются защитой.
- Billing управляет только `OWNER`, checkout всегда принимает явный `workspaceId`.
- Worker перечитывает entitlement и active/sync flags перед каждым внешним запросом; stale BullMQ payload не даёт права на sync.
- Аналитика периодов использует `Mention.publishedAt`; записи без `publishedAt` не входят в периодные KPI.
- Rating trend строится только по `RatingSnapshot`, без синтетических значений.
- Пользовательские URL проходят SSRF-проверку, включая DNS и redirect chain.

Подробный production deployment: `sale-package/DEPLOYMENT_GUIDE.md`. Фактическая модель Telegram: `TELEGRAM_MONITORING.md`.

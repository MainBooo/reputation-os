# ReputationOS — Billing/Admin Enforcement State

Дата: 2026-06-28

## Текущий статус

В проекте реализована SaaS-админка и ручной workspace-level billing.

Админка:
- `/admin` превращена в полноценную SaaS-админку владельца платформы.
- Вкладки: Обзор, Пользователи, Workspace, Биллинг, Система, Логи.
- Admin endpoints доступны только SUPER_ADMIN.
- Ручное изменение billing работает через admin panel.
- AuditLog пишет изменения ролей, статусов, workspace и billing.

Реальные тарифы:
- FREE — Бесплатный — 0 ₽
- START — Старт — 990 ₽
- PRO — Про — 1 990 ₽
- AGENCY — Агентство — 3 990 ₽

Старые выдуманные тарифы:
- STARTER
- BUSINESS
- ENTERPRISE
- CUSTOM

Они могли остаться в PostgreSQL enum, но больше не должны использоваться в UI/backend validation. Удалять enum values сейчас не надо.

## Правильная модель billing

- Plan — базовые лимиты тарифа.
- Subscription — выбранный тариф + status + manual overrides.
- EntitlementsService — единый источник итоговых прав workspace.
- Backend обязан реально защищать лимиты.
- Frontend только отображает ограничения.
- Worker/bot не должны обходить backend billing model.

Активные subscription statuses:
- TRIAL
- ACTIVE
- MANUAL

Неактивные:
- PAUSED
- PAST_DUE
- CANCELED
- EXPIRED

## Сделанные коммиты

Ключевые коммиты:

- `7caadb6` — `feat(admin): add SaaS admin panel with billing, health and audit logs`
- `0f957c6` — `fix(admin): use real plans in manual billing`
- `82e1607` — `fix(billing): enforce subscription entitlements for push, telegram, members, web source`
- `e2507e5` — `fix(billing): enforce active subscription in worker and sources`

## Что закрыто

Backend/API:
- `GET /admin/plans` берёт реальные тарифы из Plan.
- `PATCH /admin/workspaces/:id/billing` валидирует тариф через Plan.
- Нельзя поставить несуществующий STARTER через billing.
- Создание компании проверяет maxCompanies.
- AI replies проверяют maxAiRepliesPerMonth.
- Push subscribe проверяет pushNotificationsEnabled.
- Telegram linking проверяет telegramNotificationsEnabled.
- WEB source проверяет allowedPlatforms и webMonitoringEnabled.
- maxMembers проверяется через entitlements.maxMembers.
- maxSources проверяется при создании источника.
- updateSourceTarget проверяет allowedPlatforms/webMonitoringEnabled.
- Workspace.isActive учитывается в опасных write operations.

Worker:
- push/telegram delivery больше не идёт только по plan.limits.
- Worker учитывает Workspace.isActive.
- Worker учитывает subscription.status.
- Для CANCELED/PAUSED/PAST_DUE/EXPIRED delivery должен быть skip.
- Worker не должен падать, только skip + log.

Billing webhook:
- Webhook защищён `BILLING_WEBHOOK_SECRET`.
- Без секрета webhook возвращает 403.
- Неверный секрет возвращает 403.
- Секрет хранится в `.env`, не коммитится.

Build/deploy:
- PM2 запускает compiled JS из `dist/main.js`.
- После TypeScript-изменений обязательно делать build.
- Для API: `cd apps/api && npm run build`
- Для worker: `cd apps/worker && npm run build`
- Для bot: `cd apps/bot && npm run build`, если bot затронут.
- После build перезапускать PM2:
  - `pm2 restart reputation-api --update-env`
  - `pm2 restart reputation-worker --update-env`
  - `pm2 restart reputation-bot --update-env`, если bot затронут.

## Проверки, которые уже проходили

- `npx prisma validate`
- `npx prisma generate`
- `npx tsc --noEmit -p apps/api/tsconfig.json`
- `npx tsc --noEmit -p apps/worker/tsconfig.json`
- `npm run build` для API
- `npm run build` для worker
- PM2 online
- webhook без секрета → 403
- push subscribe без JWT → 401
- FREE maxSources в DB → 1
- FREE maxMembers в DB → 1

## Known limitations / next phase

Не закрыто намеренно:

1. `maxWebPages`
   - нет полноценного счётчика watched pages;
   - отложено до отдельной архитектуры page watcher.

2. Bot FeatureOverrides
   - bot частично читает `plan.limits` напрямую;
   - может не учитывать subscription overrides;
   - next phase: привести bot к EntitlementsService или общему entitlement helper.

3. `user.isActive` при login
   - сейчас не является главным P0;
   - next phase: добавить проверку заблокированного пользователя при авторизации.

4. Full global workspace guard
   - пока не нужен большой middleware/refactor;
   - критичные write operations уже закрыты точечно.

5. maxSources race condition
   - проверка количества источников без транзакции;
   - для MVP допустимо;
   - при росте нагрузки можно закрыть транзакцией/DB constraint.

## Правила для будущих задач

- Не переписывать проект целиком.
- Делать маленькие патчи.
- Не ломать demo mode.
- Не ломать workspace logic.
- Backend enforcement важнее frontend.
- Frontend не считать защитой.
- Любые изменения billing/roles/status/subscription писать в AuditLog, если действие административное.
- Не писать секреты в логи, CLAUDE.md, docs или git.
- После изменения TypeScript в API/worker/bot обязательно делать build, потому что PM2 запускает dist.

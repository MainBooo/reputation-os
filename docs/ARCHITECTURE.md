# Архитектура ReputationOS

## Состав системы

Четыре приложения в одном монорепо (Turborepo + pnpm), общая БД PostgreSQL, Redis для очередей.

```
                 ┌──────────────┐
  пользователь → │   frontend    │ ←─ Next.js 14, порт 4011
                 │  (Next.js)    │     проксирует /api/* на API
                 └──────┬───────┘
                        │ REST
                 ┌──────▼───────┐      ┌──────────────┐
                 │     api      │ ←──→ │  PostgreSQL  │
                 │   (NestJS)   │      │   (Prisma)   │
                 └──────┬───────┘      └──────▲───────┘
                        │ BullMQ (Redis)      │
                 ┌──────▼───────┐             │
                 │    worker    │─────────────┘
                 │  (адаптеры)  │ → Яндекс Карты, 2ГИС, Yandex Search API
                 └──────────────┘

                 ┌──────────────┐
   посетитель →  │   landing    │ ←─ Next.js 14, порт 4012, статика
                 └──────────────┘
```

## Поток данных (мониторинг)

1. **Планирование.** Worker по расписанию ставит задачи синхронизации в очереди BullMQ (имена очередей и задач — в `packages/shared/src/constants`).
2. **Сбор.** Задача берёт `CompanySourceTarget` (привязка компании к источнику: ID места на Яндекс Картах, URL и т.д.) и вызывает адаптер платформы. Адаптеры лежат в `apps/worker/src/adapters` и реализуют общий интерфейс `source-adapter.interface.ts`; выбор — через `source-adapter.factory.ts`:
   - `yandex.adapter.ts` — отзывы и рейтинги Яндекс Карт (основной источник);
   - `twogis.adapter.ts` — отзывы 2ГИС;
   - `webmention.adapter.ts` — упоминания бренда в вебе через Yandex Search API, с фильтрацией мусорных доменов;
   - `empty.adapter.ts` — заглушка для CUSTOM-источников.
3. **Нормализация и дедупликация.** Контент нормализуется, считается хэш; по паре `(companyId, hash)` и `(companyId, platform, externalMentionId)` стоят уникальные индексы. Дубликаты связываются через `duplicateOfId`.
4. **Тональность.** Упоминанию присваивается `sentiment` (POSITIVE / NEUTRAL / NEGATIVE / MIXED / UNKNOWN).
5. **Уведомления.** Срабатывают `NotificationRule` (фильтры по платформе, типу, тональности, рейтингу) → создаются `Notification` (in-app) и пуши по `WebPushSubscription`.
6. **AI-ответ.** По запросу из UI API генерирует черновик ответа на упоминание (`AIReplyDraft`) через YandexGPT или OpenAI (`AI_PROVIDER`).
7. **Журналирование.** Каждый прогон пишется в `JobLog` (статус, счётчики discovered/created/updated/deduped, ошибки) — виден в UI на странице sync-history.

## Модели БД (prisma/schema.prisma)

| Группа | Модели | Назначение |
|---|---|---|
| Идентичность | `User`, `Workspace`, `WorkspaceMember`, `WorkspaceInvite` | пользователи, воркспейсы, роли (OWNER/ADMIN/MEMBER), инвайты по токену |
| Мониторинг | `Company`, `CompanyAlias`, `Source`, `CompanySourceTarget` | компании, алиасы для поиска упоминаний, источники по платформам, привязки компания↔источник |
| Данные | `Mention`, `RatingSnapshot` | упоминания/отзывы с тональностью и статусом, снапшоты рейтингов во времени |
| AI | `AIReplyDraft` | черновики ответов на упоминания |
| Уведомления | `NotificationRule`, `Notification`, `WebPushSubscription` | правила, in-app уведомления, web push подписки |
| Операции | `JobLog` | журнал фоновых задач |

Все enum'ы (Platform, SourceType, MentionType, Sentiment и др.) продублированы в `packages/shared/src/enums` для использования на фронте без Prisma-клиента.

## API-модули (apps/api/src/modules)

`auth` (JWT access+refresh), `workspaces`, `companies`, `mentions`, `ratings`, `analytics`, `ai-reply-drafts`, `notifications`, `push` (web push), `sync` (ручной запуск синхронизаций), `admin` (SUPER_ADMIN), `health`.

## Frontend (apps/frontend/app)

Публичные роуты: `/login`, `/register`, `/accept-invite`. Приложение (группа `(app)`): `/dashboard`, `/companies` + карточка компании с вкладками analytics / inbox / report / sync-history / web, `/settings`, `/team`, `/admin`. API проксируется через `/api/[...path]`.

## Лендинг

Отдельное Next.js-приложение, полностью статическое. Особенность: `globals.css` содержит скомпилированный дамп Tailwind вместо `@tailwind`-директив — новые utility-классы не генерируются, в новых компонентах использовать только классы из дампа (детали в docs/DEPLOY.md → Known issues).

# Обзор архитектуры

Проверено напрямую 2026-07-28: PM2-процессы, nginx-конфиги, `docker-compose.yml`, Prisma-схема. Значения секретов нигде в этом документе не приводятся — только имена переменных и назначение сервисов.

---

## Схема системы

```
                              ┌───────────────────────────┐
                     Browser  │   nginx (TLS termination)  │
                        │     └──────────────┬─────────────┘
                        │                     │
                        │      ┌──────────────┼───────────────────┐
                        │      │              │                   │
                        ▼      ▼              ▼                   ▼
                  apps/landing        apps/frontend          apps/api /api/*
                  :4012 (Next.js,     :4011 (Next.js,        :4010 (NestJS)
                  публичный сайт)     личный кабинет)              │
                                            │                      │
                                            │ REST (Bearer JWT)    │
                                            └──────────────────────┤
                                                                    │
                                        ┌───────────────────────────┼────────────────────┐
                                        │                           │                    │
                                        ▼                           ▼                    ▼
                              PostgreSQL 16 (Docker,        Redis :6380 (api        Внешние API:
                              127.0.0.1:5543, Prisma ORM)   очереди/энтитлменты)    ЮKassa, Yandex ID
                                        ▲                           │                OAuth, YandexGPT
                                        │                           │
                                        │                    Redis :6379 (worker
                                        │                    BullMQ очереди)
                                        │                           │
                                        │                           ▼
                                        │                    apps/worker (BullMQ consumer)
                                        │                    ├─ sync: Яндекс Карты / 2ГИС / WEB
                                        │                    │  (Playwright + cheerio)
                                        └────────────────────┤─ telegram-scout (MTProto,
                                                              │  отдельный процесс/сессия)
                                                              ├─ AI-классификация и sentiment
                                                              │  (YandexGPT)
                                                              ├─ alerts (Telegram push + Web Push)
                                                              └─ scheduler (cron repeatable jobs)
                                                                     │
                                                                     ▼
                                                              apps/bot (Telegraf)
                                                              ──▶ Telegram Bot API
                                                                  (уведомления пользователю,
                                                                   long polling, без входящего порта)
```

## Компоненты

| Приложение | Назначение | Точка входа | Порт | Стек |
|---|---|---|---|---|
| `apps/api` | REST API: auth, billing, companies, mentions, analytics, admin и др. | `src/main.ts` | 4010 | NestJS 10, Prisma, Passport-JWT, BullMQ-producer |
| `apps/frontend` | Личный кабинет | `app/layout.tsx` | 4011 | Next.js 14 (App Router), React 18, Recharts |
| `apps/worker` | Фоновые задания: синк источников, Telegram Scout, AI-классификация, алерты | `src/main.ts` | — (BullMQ consumer, нет входящего порта) | NestJS, BullMQ, Playwright, MTProto-клиент |
| `apps/landing` | Маркетинговый сайт | `app/page.tsx` | 4012 | Next.js 14, framer-motion, статический CSS-дамп Tailwind |
| `apps/bot` | Telegram-бот уведомлений (не Scout) | `src/main.ts` | — (long polling) | NestJS + Telegraf |
| `packages/shared`, `packages/config` | Общие типы, конфиги eslint/tailwind/ts | — | — | — |

## PostgreSQL

- Версия 16, в Docker (`docker-compose.yml`), слушает `127.0.0.1:5543` (проброшен на нестандартный порт, чтобы не конфликтовать с другими проектами на VPS).
- ORM — Prisma. Схема — `prisma/schema.prisma`, 25 миграций.
- Основные группы моделей: идентичность (User/Workspace/WorkspaceMember/WorkspaceInvite), мониторинг (Company/CompanyAlias/Source/CompanySourceTarget), данные (Mention/RatingSnapshot), AI (AIReplyDraft), уведомления (NotificationRule/Notification/WebPushSubscription), биллинг (Plan/Subscription), операции (JobLog).
- Бэкап: ежедневный `pg_dump` через cron (`infra/scripts/backup-postgres.sh`, 03:15, ротация 7 дней). Restore-процедура **не протестирована на практике** — см. `KNOWN_LIMITATIONS.md`.

## Redis / очереди

Два независимых инстанса Redis на одном хосте:
- `:6380` — используется API (энтитлменты, вспомогательные очереди).
- `:6379` — нативный Redis для worker (BullMQ-очереди), **также используется другими, не относящимися к ReputationOS процессами на этом VPS** — при разделении инфраструктуры потребуется отдельный инстанс.

BullMQ-очереди (worker): sync источников (Яндекс Карты/2ГИС/WEB), Telegram Scout (discovery + watchlist), AI-классификация/sentiment, alerts (Telegram + Web Push), scheduler для повторяющихся cron-джобов. Redis работает без аутентификации (bind на localhost) — известное ограничение, см. `KNOWN_LIMITATIONS.md`.

## Внешние интеграции

| Интеграция | Назначение | Тип |
|---|---|---|
| ЮKassa | Приём платежей за подписку | Платёжный провайдер, webhook верифицируется прямой перепроверкой статуса платежа через API ЮKassa (не доверяет телу webhook-запроса) |
| Yandex GPT (Yandex Cloud AI Studio) | Генерация AI-черновиков ответов, классификация упоминаний | LLM API, модель `yandexgpt-lite` (настраивается) |
| Yandex ID OAuth | Вход через Яндекс | OAuth2, code flow |
| Telegram Bot API | Уведомления пользователям в Telegram | Bot API, long polling |
| Telegram MTProto (Scout) | Автопоиск упоминаний в Telegram-каналах/чатах | User-session based, единственный аккаунт на все компании платформы (см. `KNOWN_LIMITATIONS.md`) |
| Google Analytics, Яндекс.Метрика, Microsoft Clarity | Веб-аналитика лендинга/фронтенда | Опциональные, через `NEXT_PUBLIC_*` |
| WEB-источники | Мониторинг произвольных сайтов-отзовиков | Собственный скрапер + LLM-классификация страницы, с защитой от SSRF (валидация схемы + блокировка приватных/loopback/link-local IP) |

Отсутствует: email-провайдер (SMTP/SendGrid и т.п.) — приглашения в воркспейс доставляются вручную копированием ссылки; error-tracking (Sentry и аналоги) не подключён.

## Порты и взаимодействие

| Порт | Сервис | Доступ |
|---|---|---|
| 4010 | `apps/api` | Через nginx, `/api/` |
| 4011 | `apps/frontend` | Через nginx, `/` |
| 4012 | `apps/landing` | Через отдельный домен/nginx-location |
| 5543 | PostgreSQL (Docker) | `127.0.0.1` only, не публичный |
| 6379 | Redis (worker, нативный) | `127.0.0.1` only |
| 6380 | Redis (api, Docker) | `127.0.0.1` only |
| — | `apps/bot`, `apps/worker` | Без входящих портов, работают как фоновые процессы через PM2 |

## Процессы PM2 в проде (на 2026-07-28)

На сервере запущено 8 PM2-процессов, из них **5 относятся к ReputationOS**: `reputation-api`, `reputation-frontend`, `reputation-worker`, `reputation-landing`, `reputation-bot`. Остальные 3 (`generationweb`, `growth-engine-web`, `growth-engine-worker`) — не относящиеся к продукту проекты того же владельца на этом же сервере (подробнее — `ASSETS_INCLUDED.md`, `KNOWN_LIMITATIONS.md`).

## Важное архитектурное ограничение

Telegram Scout принципиально single-instance: Redis-лок MTProto-сессии + `concurrency:1` в BullMQ — осознанный «safety net» от параллельных конфликтов сессии, а не горизонтально масштабируемая архитектура. При росте числа клиентов это станет узким местом раньше, чем API/БД (см. таблицу поведения при росте нагрузки в `REPUTATIONOS_SALE_AUDIT.md`, раздел 6).

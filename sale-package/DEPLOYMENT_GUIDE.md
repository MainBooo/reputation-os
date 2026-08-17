# Инструкция развёртывания на новом VPS

Составлено на основе фактического прод-окружения на 2026-07-28. Это инструкция «с нуля» (чистый сервер) — не инструкция миграции существующих данных (для этого потребуется дополнительно `pg_dump`/`pg_restore` и перенос файлового хранилища, что в этом документе не описывается и не выполнялось).

Инструкция не проверялась сухим прогоном на чистой VM в рамках подготовки этого пакета — рекомендуется протестировать перед реальной передачей покупателю.

---

## 1. Системные требования

Взято из фактически работающего прод-сервера:

- Ubuntu 24.04 (или совместимый Linux)
- Node.js **20.x** (прод-сервер: v20.20.0)
- pnpm **9.x** (прод-сервер: 9.15.0), указан явно в `package.json` → `packageManager: "pnpm@9.15.0"`
- Docker + Docker Compose (для PostgreSQL и Redis)
- nginx
- certbot (для TLS, если разворачивается публично)
- PM2 (глобально: `npm i -g pm2`)
- Минимум по факту текущего прода: ~5 ГБ RAM, для комфортного запаса (Playwright-браузеры, сборка) рекомендуется от 8 ГБ и от 30 ГБ диска — текущий прод-VPS (4.8 ГБ RAM, 29 ГБ диска) занят на 87%, что уже создаёт риск нехватки места

## 2. Зависимости

```bash
git clone <адрес репозитория покупателя>
cd reputation-os
pnpm install
pnpm playwright:install:worker-browser
```

`pnpm install` устанавливает пакет Playwright, но **не** загружает браузер Chromium. Команда `pnpm playwright:install:worker-browser` обязательна до первого запуска worker и после обновления Playwright: без неё адаптеры Яндекс Карт и 2ГИС не смогут запустить браузер. Первая загрузка занимает примерно 300 МБ диска.

## 3. ENV-переменные (только имена, без значений)

Шесть файлов: корень + 5 приложений. Реальные шаблоны — в `.env.example` рядом с каждым `.env`.

### Корень (`/.env.example`) — используется api и worker для Telegram Scout
```
DATABASE_URL, REDIS_URL, JWT_SECRET, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_DEMO_MODE, DEMO_MODE,
TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION_PATH, TELEGRAM_SCOUT_ENABLED,
TELEGRAM_SCOUT_MAX_QUERIES_PER_COMPANY, TELEGRAM_SCOUT_MAX_STRONG_QUERIES,
TELEGRAM_SCOUT_MAX_MEDIUM_QUERIES, TELEGRAM_SCOUT_MAX_WEAK_QUERIES,
TELEGRAM_SCOUT_MAX_PAGES_PER_QUERY, TELEGRAM_SCOUT_MAX_MESSAGES_PER_RUN,
TELEGRAM_SCOUT_MAX_NEW_SOURCES_PER_RUN, TELEGRAM_SCOUT_MAX_RUNTIME_MS,
TELEGRAM_SCOUT_DISCOVERY_INTERVAL_HOURS, TELEGRAM_SCOUT_NOISE_THRESHOLD,
TELEGRAM_SCOUT_ENABLE_HASHTAG_POST_SEARCH,
TELEGRAM_WATCHLIST_MAX_MESSAGES_PER_CHANNEL, TELEGRAM_WATCHLIST_DISPATCHER_INTERVAL_MIN,
TELEGRAM_SEARCH_RESULTS_LIMIT, TELEGRAM_SEARCH_DELAY_MS, TELEGRAM_SEARCH_RETRY_ATTEMPTS,
TELEGRAM_LOCK_RETRY_DELAY_MS, TELEGRAM_LOCK_MAX_SELF_REQUEUES,
TELEGRAM_AI_REVIEW_THRESHOLD, TELEGRAM_AI_HIDE_THRESHOLD
```

### `apps/api/.env.example`
```
DATABASE_URL, JWT_SECRET, REDIS_URL, PORT, DEMO_MODE,
BILLING_PROVIDER, YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY, YOOKASSA_RETURN_URL,
YANDEX_CLIENT_ID, YANDEX_CLIENT_SECRET, YANDEX_REDIRECT_URI,
YANDEX_GPT_API_KEY, YANDEX_GPT_FOLDER_ID, YANDEX_GPT_MODEL,
INTERNAL_JOBS_SECRET,
RATE_LIMIT_LOGIN_MAX, RATE_LIMIT_LOGIN_TTL_MS, RATE_LIMIT_REGISTER_MAX, RATE_LIMIT_REGISTER_TTL_MS,
RATE_LIMIT_CREATE_COMPANY_MAX, RATE_LIMIT_CREATE_COMPANY_TTL_MS,
RATE_LIMIT_DISCOVER_SOURCES_MAX, RATE_LIMIT_DISCOVER_SOURCES_TTL_MS,
RATE_LIMIT_BILLING_CHECKOUT_MAX, RATE_LIMIT_BILLING_CHECKOUT_TTL_MS,
RATE_LIMIT_BILLING_WEBHOOK_MAX, RATE_LIMIT_BILLING_WEBHOOK_TTL_MS,
RATE_LIMIT_INTERNAL_JOBS_MAX, RATE_LIMIT_INTERNAL_JOBS_TTL_MS
```
**Важно**: `YANDEX_GPT_API_KEY`/`YANDEX_GPT_FOLDER_ID`/`YANDEX_GPT_MODEL` должны совпадать со значениями в `apps/worker/.env` — иначе AI-ответы работают в воркере, но падают в API (это реальный баг, который случился в этом проекте и был исправлен вручную).

### `apps/worker/.env.example`
```
DATABASE_URL, REDIS_URL, DEMO_MODE,
YANDEX_GPT_API_KEY, YANDEX_GPT_FOLDER_ID, YANDEX_GPT_MODEL,
TELEGRAM_AI_REVIEW_THRESHOLD, TELEGRAM_AI_HIDE_THRESHOLD
```

### `apps/bot/.env.example`
```
TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, DATABASE_URL, REDIS_URL, API_INTERNAL_URL, NODE_ENV
```

### `apps/frontend/.env.example`
```
NEXT_PUBLIC_API_URL, NEXT_PUBLIC_DEMO_MODE, NEXT_PUBLIC_GA_MEASUREMENT_ID,
NEXT_PUBLIC_YANDEX_METRIKA_ID, NEXT_PUBLIC_CLARITY_ID, NEXT_PUBLIC_SUPPORT_TELEGRAM_URL
```

### `apps/landing/.env.example`
```
NEXT_PUBLIC_GA_MEASUREMENT_ID, NEXT_PUBLIC_YANDEX_METRIKA_ID, NEXT_PUBLIC_CLARITY_ID
```

### Откуда брать значения внешних ключей

| Переменная | Где получить |
|---|---|
| `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` | Личный кабинет ЮKassa (требуется одобрение магазина — время ожидания не контролируется разработчиком) |
| `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET` | oauth.yandex.ru/client/new |
| `YANDEX_GPT_API_KEY`, `YANDEX_GPT_FOLDER_ID` | Yandex Cloud AI Studio, сервисный аккаунт |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | @BotFather в Telegram |
| `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` | my.telegram.org, требуется реальный номер телефона (интерактивный логин с 2FA при первом запуске Scout) |
| `JWT_SECRET`, `INTERNAL_JOBS_SECRET` | Сгенерировать самостоятельно: `openssl rand -hex 32` |
| `DATABASE_URL`, `REDIS_URL` | Задаются при разворачивании Docker-сервисов (шаг 4) |

## 4. База данных

```bash
docker compose up -d          # поднимает postgres:16 (127.0.0.1:5543) и redis:7 (127.0.0.1:6380)
```

Worker использует отдельный нативный (не Docker) Redis на порту 6379 в текущем проде — на чистом сервере для worker-очередей можно использовать тот же Docker Redis, если конфиг `REDIS_URL` в `apps/worker/.env` указывает на правильный порт. В текущей инсталляции разделение на два Redis исторически сложилось из-за совместного использования сервера с другими проектами — на выделенном сервере под покупателя это разделение не обязательно, но нужно явно решить при развёртывании.

## 5. Redis

Поднимается вместе с Postgres через `docker compose up -d` (см. выше). Без аутентификации, bind на `127.0.0.1` — не выставлять наружу без пароля.

## 6. Миграции

```bash
npx prisma migrate deploy
npx prisma generate
```

25 миграций на момент подготовки пакета. `prisma migrate status` должен показать «up to date» — если нет, разбираться с расхождением до продолжения.

Опционально — сид демо-данных (создаёт SUPER_ADMIN и т.п., смотреть `prisma/seed.ts` перед запуском на проде с реальными пользователями):
```bash
pnpm prisma:seed
```

## 7. Сборка

```bash
pnpm --filter api build
pnpm --filter worker build
pnpm --filter frontend build
pnpm --filter landing build
pnpm --filter reputation-bot build
```

Известный, но некритичный на чистой установке нюанс: в текущем проде однажды возникал стухший pnpm-симлинк для `apps/landing` при смене peer-зависимости `next` (из-за добавления `@playwright/test` в frontend) — на полностью свежей установке `pnpm install` эта проблема не должна воспроизводиться, но если сборка `landing` падает с `Cannot find module .../next/dist/bin/next`, решение — `pnpm install` заново (без изменения lockfile).

## 8. PM2

```bash
pm2 start infra/pm2/ecosystem.config.js   # либо ecosystem.worker.config.js — сверить актуальное имя файла в репозитории перед запуском
pm2 save
pm2 startup
```

Пять процессов должны подняться: `reputation-api`, `reputation-worker`, `reputation-frontend`, `reputation-landing`, `reputation-bot`.

## 9. nginx

Настроить проксирование:
- `/api/socket.io/` → `127.0.0.1:4010` с WebSocket upgrade
- `/api/` и `/` (кабинет) → `127.0.0.1:4011`. Next.js route handler `/api/[...path]` передаёт REST в API и хранит JWT только в HttpOnly cookie.
- Отдельный домен/location для лендинга → `127.0.0.1:4012`

Обратить внимание: в текущем проде конфиг лендинга находится внутри чужого nginx-файла (`generationweb`), что не является образцом для копирования — на новом сервере лендинг должен иметь собственный чистый server-блок.

Затем:
```bash
nginx -t && systemctl reload nginx
certbot --nginx -d <домен>
```

## 10. Первичная настройка

- Создать первого SUPER_ADMIN (через seed или напрямую в БД — механизм смотреть в `prisma/seed.ts`).
- Первичный логин Telegram Scout — интерактивный скрипт с вводом кода/2FA от аккаунта, привязанного к `TELEGRAM_API_ID`/`TELEGRAM_API_HASH`. Не автоматизируется, требует живого участия человека с доступом к телефону.
- Настроить crontab по образцу текущего прода:
```
15 3 * * * /opt/reputation-os/infra/scripts/backup-postgres.sh
*/5 * * * * /opt/reputation-os/infra/scripts/healthcheck.sh >> logs/healthcheck.log 2>&1
```

## 11. Проверка работоспособности

- `curl https://<домен>/api/health` → `{"status":"ok"}`
- Открыть лендинг и кабинет в браузере, зарегистрировать тестовый аккаунт → должен появиться 7-дневный PRO-триал.
- Добавить компанию → источник Яндекс Карты → дождаться первого синка → упоминание должно появиться в Inbox.
- Сгенерировать AI-черновик ответа — если падает ошибкой, первым делом проверить, что `YANDEX_GPT_*` заданы одинаково в `apps/api/.env` и `apps/worker/.env` (см. раздел 3).
- Зайти в админ-панель под SUPER_ADMIN → `system-health` — должен честно показывать статус каждой интеграции (в частности, `AI: misconfigured`, если ключи не заданы, а не фейковый «зелёный» статус).
- Полный сквозной сценарий для демонстрации — см. `DEMO_SCRIPT.md`.

## Известные несоответствия документации

`docs/DEPLOY.md` — черновик, устарел и ориентирован в основном на интеграцию Telegram-бота, не на общий деплой; часть переменных (`AI_PROVIDER`) упомянута там, но отсутствует в фактических `.env.example` — не добавлять её без проверки, реально ли она используется в коде (на момент аудита не использовалась нигде — 0 вхождений).

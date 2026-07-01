# Развёртывание ReputationOS

## Требования

- Node.js 20+, pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- PostgreSQL 14+
- Redis 6+
- PM2 (`npm i -g pm2`), nginx с TLS (certbot)

## Установка с нуля

```bash
git clone git@github.com:MainBooo/reputation-os.git /opt/reputation-os
cd /opt/reputation-os
pnpm install
cp .env.example .env   # заполнить по таблице ниже
pnpm exec prisma migrate deploy   # схема БД одной командой (baseline 0_init)
pnpm exec prisma db seed          # демо-данные (опционально)
pnpm run build                    # turbo собирает все 4 приложения
```

## Переменные окружения (.env в корне)

| Переменная | Назначение |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | порт API (NestJS) |
| `DATABASE_URL` | строка подключения PostgreSQL |
| `REDIS_URL` / `REDIS_HOST` / `REDIS_PORT` | Redis для очередей BullMQ |
| `JWT_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | секреты JWT (сгенерировать: `openssl rand -hex 32`) |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | время жизни токенов (напр. `15m`, `30d`) |
| `APP_BASE_URL`, `FRONTEND_URL` | публичный URL приложения |
| `API_BASE_URL` | URL API (для фронтового прокси) |
| `AI_PROVIDER` | `yandex` или `openai` — провайдер генерации ответов |
| `OPENAI_API_KEY` | ключ OpenAI (если `AI_PROVIDER=openai`) |
| `YANDEX_GPT_API_KEY`, `YANDEX_GPT_FOLDER_ID`, `YANDEX_GPT_MODEL` | YandexGPT (если `AI_PROVIDER=yandex`) |
| `YANDEX_SEARCH_API_KEY`, `YANDEX_SEARCH_FOLDER_ID`, `YANDEX_SEARCH_API_ENABLED` | Yandex Search API для веб-упоминаний |
| `WEB_PUSH_SUBJECT` | subject для Web Push (mailto: или URL) |

У frontend есть свой `apps/frontend/.env.local` (публичные переменные Next.js).

## PM2

Четыре процесса (имена соответствуют текущему проду):

```bash
cd /opt/reputation-os
pm2 start apps/api/dist/main.js          --name reputation-api      --cwd apps/api
pm2 start apps/frontend/.next/standalone/apps/frontend/server.js \
                                          --name reputation-frontend --cwd apps/frontend -- -p 4011
pm2 start apps/landing/.next/standalone/apps/landing/server.js \
                                          --name reputation-landing  --cwd apps/landing  -- -p 4012
pm2 start apps/worker/dist/index.js       --name reputation-worker   --cwd apps/worker
pm2 save && pm2 startup
```

Точные команды запуска текущих процессов можно посмотреть на действующем сервере: `pm2 describe <name>`.

## nginx (схема)

- `reputation.<домен>` → `proxy_pass http://127.0.0.1:4011` (приложение)
- `reputationos.<домен>` → `proxy_pass http://127.0.0.1:4012` (лендинг)
- API доступен фронту через внутренний прокси Next.js (`/api/[...path]` → `API_BASE_URL`), наружу отдельный домен не обязателен.

## Обновление

```bash
cd /opt/reputation-os
git pull
pnpm install
pnpm exec prisma migrate deploy
pnpm run build
pm2 restart reputation-api reputation-frontend reputation-landing reputation-worker --update-env
```

## Бэкапы

БД: `pg_dump "$DATABASE_URL" | gzip > backup_$(date +%F).sql.gz` (рекомендуется в cron ежедневно). Код — в git.

## Демо-аккаунт

`demo@reputation.local` / `demo123`, создаётся сидом (`prisma/seed.ts`), опубликован на лендинге. Внимание: юзер имеет роль OWNER в демо-воркспейсе и может удалять данные. Рекомендация: ежедневный пересев по cron (`pnpm exec prisma db seed` идемпотентен) либо перевод демо на read-only роль.

## Known issues

1. **Лендинг, `apps/landing/app/globals.css`** — вместо `@tailwind`-директив в файл вставлен скомпилированный CSS-дамп. Сборка работает, но новые utility-классы Tailwind не генерируются; в новых компонентах использовать только классы, уже присутствующие в дампе. Восстановление директив — известная задача (рядом лежит бэкап-кандидат `globals.css.bak.*`).
2. **Веб-упоминания**: периодический 403 от Yandex Search API в worker — требует проверки ключа/квот (`YANDEX_SEARCH_*`).
3. Уведомления в Telegram заложены в схему (`NotificationChannel.TELEGRAM`), но отправка не реализована — быстрая фича для развития продукта.

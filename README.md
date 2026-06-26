# Telegram Bot — Scaffold для ReputationOS

## Файлы в этом архиве

```
prisma/
  SCHEMA_PATCH.txt                            — что добавить в schema.prisma
  migrations/20240614000000_add_telegram_bot/
    migration.sql                             — SQL для ручного применения (fallback)

apps/bot/
  package.json
  tsconfig.json
  nest-cli.json
  .env.example
  src/
    main.ts                                   — long polling bootstrap
    app.module.ts
    bot.module.ts                             — TelegrafModule.forRootAsync
    common/
      prisma/{prisma.service.ts, prisma.module.ts}
      guards/{telegram-auth.guard.ts, workspace-role.guard.ts, plan-feature.guard.ts}
      decorators/tg-user.decorator.ts
      utils/date.util.ts
    modules/
      auth/{auth.module.ts, auth.service.ts, auth.update.ts}
      companies/{companies.module.ts, companies.service.ts, companies.update.ts}
      settings/{settings.module.ts, settings.service.ts, settings.update.ts}

apps/api/src/telegram/
  telegram.controller.ts                      — POST/DELETE/GET /api/telegram/*
  telegram.service.ts
  telegram.module.ts                          — добавить в app.module.ts

apps/worker/src/telegram/
  telegram-notifications.service.ts          — HTTP-клиент к Telegram Bot API
  telegram-notifications.module.ts
  WORKER_PATCH.txt                           — как встроить в notifications.processor

apps/frontend/src/components/settings/
  TelegramConnectSection.tsx                 — React-компонент для страницы профиля

DEPLOY.md                                    — порядок деплоя
```

## Чеклист интеграции

- [ ] Добавить поля в `schema.prisma` (см. `prisma/SCHEMA_PATCH.txt`)
- [ ] `npx prisma migrate dev --name add_telegram_bot`
- [ ] `npx prisma generate`
- [ ] Скопировать `apps/bot/` → в монорепо
- [ ] Скопировать `apps/api/src/telegram/` → в монорепо, добавить `TelegramApiModule` в `app.module.ts`
- [ ] Скопировать `apps/worker/src/telegram/` → в монорепо, применить `WORKER_PATCH.txt`
- [ ] Добавить `TelegramConnectSection` в страницу профиля
- [ ] Создать `apps/bot/.env` с `TELEGRAM_BOT_TOKEN` и `TELEGRAM_BOT_USERNAME`
- [ ] Добавить `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` в `apps/api/.env`
- [ ] Добавить `TELEGRAM_BOT_TOKEN` в `apps/worker/.env`
- [ ] `pnpm --filter reputation-bot build`
- [ ] Добавить `reputation-bot` в `ecosystem.config.js` (см. `DEPLOY.md`)
- [ ] `pm2 start ecosystem.config.js --only reputation-bot && pm2 save`
- [ ] `pm2 restart reputation-api reputation-worker`

// ============================================================
// PATCH: ecosystem.config.js — добавить в массив apps:
// ============================================================

{
  name: 'reputation-bot',
  script: 'apps/bot/dist/main.js',
  cwd: '/opt/reputation-os',
  env_file: '/opt/reputation-os/apps/bot/.env',
  env: {
    NODE_ENV: 'production',
  },
  restart_delay: 5000,
  max_restarts: 10,
  watch: false,
}

// ============================================================
// Команды деплоя:
//
// cd /opt/reputation-os
//
// # 1. Применить миграцию
// npx prisma migrate deploy
// npx prisma generate
//
// # 2. Создать .env для бота
// cp apps/bot/.env.example apps/bot/.env
// nano apps/bot/.env   # вписать TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_USERNAME
//
// # 3. Добавить TELEGRAM_BOT_TOKEN в apps/api/.env и apps/worker/.env
//
// # 4. Добавить TELEGRAM_BOT_USERNAME в apps/api/.env
//
// # 5. Собрать бота
// pnpm --filter reputation-bot build
//
// # 6. Запустить PM2
// pm2 start ecosystem.config.js --only reputation-bot
// pm2 save
//
// # 7. Перезапустить API и worker (новый модуль)
// pm2 restart reputation-api reputation-worker
// ============================================================

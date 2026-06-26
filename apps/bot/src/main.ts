import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const logger = new Logger('Bootstrap')
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] })
  await app.init()

  // Регистрируем команды бота (persistent menu)
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (token) {
    const commands = [
      { command: 'companies', description: '📋 Мои компании' },
      { command: 'me',        description: '👤 Мой профиль' },
      { command: 'settings',  description: '⚙️ Настройки уведомлений' },
      { command: 'help',      description: '❓ Помощь' },
    ]
    const res = await fetch(
      `https://api.telegram.org/bot${token}/setMyCommands`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands }),
      },
    )
    const json = await res.json() as any
    if (json.ok) {
      logger.log('Bot menu commands registered')
    } else {
      logger.warn('setMyCommands failed: ' + JSON.stringify(json))
    }
  } else {
    logger.warn('TELEGRAM_BOT_TOKEN not set — skipping setMyCommands')
  }

  logger.log('Reputation Bot запущен (long polling)')
}

bootstrap().catch((err) => {
  console.error('Ошибка запуска бота:', err)
  process.exit(1)
})

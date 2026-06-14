import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const logger = new Logger('Bootstrap')
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] })
  await app.init()
  logger.log('Reputation Bot запущен (long polling)')
}

bootstrap().catch((err) => {
  console.error('Ошибка запуска бота:', err)
  process.exit(1)
})

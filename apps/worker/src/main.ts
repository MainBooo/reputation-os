import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  process.on('unhandledRejection', (reason) => {
    console.error('[Worker] unhandledRejection', reason)
  })
  process.on('uncaughtException', (err) => {
    console.error('[Worker] uncaughtException', err)
    process.exit(1)
  })

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn']
  })

  const shutdown = async () => {
    await app.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Keep process alive for BullMQ workers
  await new Promise(() => {})
}

bootstrap()

import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // За nginx один hop прокси (см. /etc/nginx/sites-available/reputation) —
  // trust proxy: 1 берёт IP клиента из X-Forwarded-For/X-Real-IP, не доверяя
  // хопам дальше первого. Без этого req.ip == 127.0.0.1 и rate limiting/логи
  // считают всех пользователей одним IP.
  app.set('trust proxy', 1)

  app.setGlobalPrefix('api')

  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:4011')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  app.enableCors({
    origin: allowedOrigins,
    credentials: true
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  )

  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalInterceptors(new LoggingInterceptor())

  await app.listen(Number(process.env.PORT || 4010))
}

bootstrap()

import { ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler'
import { RATE_LIMIT_MESSAGE } from './rate-limit.config'

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly rateLimitLogger = new Logger('RateLimit')

  protected async throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    const req = context.switchToHttp().getRequest()
    // Только IP и маршрут — никаких паролей/токенов/email в логах.
    this.rateLimitLogger.warn(
      `blocked ${req.method} ${req.route?.path ?? req.url} ip=${req.ip} limit=${detail.limit}/${detail.ttl}ms`
    )

    throw new HttpException(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: RATE_LIMIT_MESSAGE, error: 'Too Many Requests' },
      HttpStatus.TOO_MANY_REQUESTS
    )
  }
}

import { Global, Module } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'
import { AppThrottlerGuard } from './app-throttler.guard'

// Redis-backed rate limiting — лимиты переживают рестарт pm2 и общие для всех
// инстансов api. Каждый защищённый роут задаёт свой limit/ttl/tracker через
// @Throttle({ default: {...} }), это лишь общая инфраструктура + fallback.
@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [{ name: 'default', limit: 60, ttl: 60_000 }],
        storage: new ThrottlerStorageRedisService(process.env.REDIS_URL || 'redis://127.0.0.1:6379')
      })
    })
  ],
  providers: [AppThrottlerGuard],
  exports: [AppThrottlerGuard]
})
export class RateLimitModule {}

import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { SyncService } from './sync.service'
import { AppThrottlerGuard } from '../../common/rate-limit/app-throttler.guard'
import { RATE_LIMITS } from '../../common/rate-limit/rate-limit.config'
import { userAndCompanyTracker } from '../../common/rate-limit/rate-limit-trackers'

@Controller()
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @UseGuards(JwtAuthGuard, AppThrottlerGuard)
  @Throttle({ default: { ...RATE_LIMITS.discoverSources, getTracker: userAndCompanyTracker } })
  @Post('companies/:id/discover-sources')
  discoverSources(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.syncService.discoverSources(user.id, companyId)
  }

  @UseGuards(JwtAuthGuard)
  @Post('companies/:id/start-sync')
  startSync(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.syncService.startSync(user.id, companyId)
  }

  @UseGuards(JwtAuthGuard)
  @Post('companies/:id/start-web-sync')
  startWebSync(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.syncService.startWebSync(user.id, companyId)
  }

  @UseGuards(JwtAuthGuard)
  @Get('companies/:id/sync-status')
  getSyncStatus(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.syncService.getSyncStatus(user.id, companyId)
  }

  @Post('internal/jobs/tick')
  tick() {
    return this.syncService.tick()
  }

  @Post('internal/jobs/reconcile')
  reconcile() {
    return this.syncService.reconcile()
  }
}

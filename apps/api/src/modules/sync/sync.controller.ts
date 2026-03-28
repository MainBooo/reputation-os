import { Controller, Param, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { SyncService } from './sync.service'

@Controller()
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @UseGuards(JwtAuthGuard)
  @Post('companies/:id/discover-sources')
  discoverSources(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.syncService.discoverSources(user.id, companyId)
  }

  @UseGuards(JwtAuthGuard)
  @Post('companies/:id/start-sync')
  startSync(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.syncService.startSync(user.id, companyId)
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

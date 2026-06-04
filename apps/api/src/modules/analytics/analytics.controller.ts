import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { AnalyticsService } from './analytics.service'

@UseGuards(JwtAuthGuard)
@Controller('companies/:id/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  overview(
    @CurrentUser() user: AuthUser,
    @Param('id') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.analyticsService.overview(user.id, companyId, from, to)
  }

  @Get('sentiment')
  sentiment(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.analyticsService.sentiment(user.id, companyId)
  }

  @Get('platforms')
  platforms(
    @CurrentUser() user: AuthUser,
    @Param('id') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.analyticsService.platforms(user.id, companyId, from, to)
  }
}

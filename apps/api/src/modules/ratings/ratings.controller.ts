import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RatingsService } from './ratings.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'

@UseGuards(JwtAuthGuard)
@Controller('companies/:id/ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get('history')
  history(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.ratingsService.history(user.id, companyId)
  }

  @Get('overview')
  overview(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.ratingsService.overview(user.id, companyId)
  }
}

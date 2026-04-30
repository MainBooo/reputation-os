import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { PushService } from './push.service'
import { SubscribePushDto } from './dto/subscribe-push.dto'
import { UnsubscribePushDto } from './dto/unsubscribe-push.dto'
import { TestPushDto } from './dto/test-push.dto'

@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('public-key')
  getPublicKey() {
    return this.pushService.getPublicKey()
  }

  @Get('subscriptions')
  listSubscriptions(@CurrentUser() user: AuthUser) {
    return this.pushService.listSubscriptions(user.id)
  }

  @Post('subscribe')
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribePushDto) {
    return this.pushService.subscribe(user.id, dto)
  }

  @Delete('unsubscribe')
  unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: UnsubscribePushDto) {
    return this.pushService.unsubscribe(user.id, dto)
  }

  @Post('test')
  sendTest(@CurrentUser() user: AuthUser, @Body() dto: TestPushDto) {
    return this.pushService.sendTest(user.id, dto)
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { TelegramChannelsService } from './telegram-channels.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { DemoProtectionGuard } from '../../common/guards/demo-protection.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { CreateTelegramChannelDto } from './dto/create-telegram-channel.dto'
import { UpdateTelegramChannelDto } from './dto/update-telegram-channel.dto'

@UseGuards(JwtAuthGuard)
@Controller('companies/:id')
export class TelegramChannelsController {
  constructor(private readonly telegramChannelsService: TelegramChannelsService) {}

  @Get('telegram-channels')
  list(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.telegramChannelsService.list(user.id, companyId)
  }

  @UseGuards(DemoProtectionGuard)
  @Post('telegram-channels')
  create(@CurrentUser() user: AuthUser, @Param('id') companyId: string, @Body() dto: CreateTelegramChannelDto) {
    return this.telegramChannelsService.create(user.id, companyId, dto)
  }

  @UseGuards(DemoProtectionGuard)
  @Patch('telegram-channels/:channelId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') companyId: string,
    @Param('channelId') channelId: string,
    @Body() dto: UpdateTelegramChannelDto
  ) {
    return this.telegramChannelsService.update(user.id, companyId, channelId, dto)
  }

  @UseGuards(DemoProtectionGuard)
  @Delete('telegram-channels/:channelId')
  remove(@CurrentUser() user: AuthUser, @Param('id') companyId: string, @Param('channelId') channelId: string) {
    return this.telegramChannelsService.remove(user.id, companyId, channelId)
  }

  @UseGuards(DemoProtectionGuard)
  @Post('telegram-channels/:channelId/check')
  checkNow(@CurrentUser() user: AuthUser, @Param('id') companyId: string, @Param('channelId') channelId: string) {
    return this.telegramChannelsService.checkNow(user.id, companyId, channelId)
  }

  @UseGuards(DemoProtectionGuard)
  @Post('start-telegram-sync')
  startTelegramSync(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.telegramChannelsService.startTelegramSync(user.id, companyId)
  }

  @Get('telegram-scout/status')
  getScoutStatus(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.telegramChannelsService.getScoutStatus(user.id, companyId)
  }
}

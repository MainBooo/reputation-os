import { Module } from '@nestjs/common'
import { TelegramChannelsController } from './telegram-channels.controller'
import { TelegramChannelsService } from './telegram-channels.service'
import { BillingModule } from '../billing/billing.module'

@Module({
  imports: [BillingModule],
  controllers: [TelegramChannelsController],
  providers: [TelegramChannelsService]
})
export class TelegramChannelsModule {}

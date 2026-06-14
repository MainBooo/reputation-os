import { Module } from '@nestjs/common'
import { TelegramNotificationsService } from './telegram-notifications.service'

@Module({
  providers: [TelegramNotificationsService],
  exports: [TelegramNotificationsService],
})
export class TelegramNotificationsModule {}


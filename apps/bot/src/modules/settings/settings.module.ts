import { Module } from '@nestjs/common'
import { SettingsUpdate } from './settings.update'
import { SettingsService } from './settings.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  providers: [SettingsUpdate, SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

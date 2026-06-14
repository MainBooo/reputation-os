import { Module } from '@nestjs/common'
import { TelegrafModule } from 'nestjs-telegraf'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthModule } from './modules/auth/auth.module'
import { CompaniesModule } from './modules/companies/companies.module'
import { SettingsModule } from './modules/settings/settings.module'

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN'),
        // long polling — никаких webhookDomain
        include: [AuthModule, CompaniesModule, SettingsModule],
      }),
      inject: [ConfigService],
    }),
  ],
})
export class BotModule {}

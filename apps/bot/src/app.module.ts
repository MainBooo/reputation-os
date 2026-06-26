import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { BotModule } from './bot.module'
import { PrismaModule } from './common/prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { CompaniesModule } from './modules/companies/companies.module'
import { SettingsModule } from './modules/settings/settings.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    BotModule,
    AuthModule,
    CompaniesModule,
    SettingsModule,
  ],
})
export class AppModule {}

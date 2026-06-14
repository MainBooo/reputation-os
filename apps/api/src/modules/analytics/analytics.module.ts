import { Module } from '@nestjs/common'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'
import { EntitlementsService } from '../billing/entitlements.service'

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, EntitlementsService]
})
export class AnalyticsModule {}

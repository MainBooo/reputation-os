import { Module } from '@nestjs/common'
import { ConfigModule } from './config/config.module'
import { PrismaModule } from './common/prisma/prisma.module'
import { BullmqModule } from './common/queues/bullmq.module'
import { HealthModule } from './modules/health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { WorkspacesModule } from './modules/workspaces/workspaces.module'
import { CompaniesModule } from './modules/companies/companies.module'
import { MentionsModule } from './modules/mentions/mentions.module'
import { RatingsModule } from './modules/ratings/ratings.module'
import { AnalyticsModule } from './modules/analytics/analytics.module'
import { AiReplyDraftsModule } from './modules/ai-reply-drafts/ai-reply-drafts.module'
import { VkModule } from './modules/vk/vk.module'
import { SyncModule } from './modules/sync/sync.module'

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullmqModule,
    HealthModule,
    AuthModule,
    WorkspacesModule,
    CompaniesModule,
    MentionsModule,
    RatingsModule,
    AnalyticsModule,
    AiReplyDraftsModule,
    VkModule,
    SyncModule
  ]
})
export class AppModule {}

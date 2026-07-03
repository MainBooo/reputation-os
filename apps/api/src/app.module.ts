import { Module } from '@nestjs/common'
import { ConfigModule } from './config/config.module'
import { PrismaModule } from './common/prisma/prisma.module'
import { BullmqModule } from './common/queues/bullmq.module'
import { HealthModule } from './modules/health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { WorkspacesModule } from './modules/workspaces/workspaces.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { AdminModule } from './modules/admin/admin.module'
import { CompaniesModule } from './modules/companies/companies.module'
import { MentionsModule } from './modules/mentions/mentions.module'
import { RatingsModule } from './modules/ratings/ratings.module'
import { AnalyticsModule } from './modules/analytics/analytics.module'
import { AiReplyDraftsModule } from './modules/ai-reply-drafts/ai-reply-drafts.module'
import { SyncModule } from './modules/sync/sync.module'
import { PushModule } from './modules/push/push.module'
import { TelegramApiModule } from "./telegram/telegram.module"
import { BillingModule } from './modules/billing/billing.module'
import { ChatModule } from './modules/chat/chat.module'
import { RateLimitModule } from './common/rate-limit/rate-limit.module'

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullmqModule,
    RateLimitModule,
    HealthModule,
    AuthModule,
    WorkspacesModule,
    NotificationsModule,
    AdminModule,
    CompaniesModule,
    MentionsModule,
    RatingsModule,
    AnalyticsModule,
    AiReplyDraftsModule,
    SyncModule,
    PushModule,
    BillingModule,
    TelegramApiModule,
    ChatModule
  ]
})
export class AppModule {}

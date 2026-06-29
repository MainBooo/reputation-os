import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './common/prisma/prisma.module'
import { BullmqModule } from './queues/bullmq.module'
import { SchedulerService } from './scheduler/scheduler.service'
import { DedupService } from './services/dedup.service'
import { MentionService } from './services/mention.service'
import { RatingService } from './services/rating.service'
import { JobLogService } from './services/job-log.service'
import { AlertsService } from './services/alerts.service'
import { SourceDiscoveryProcessor } from './processors/source-discovery.processor'
import { ReviewsSyncProcessor } from './processors/reviews-sync.processor'
import { MentionsSyncProcessor } from './processors/mentions-sync.processor'
import { RatingRefreshProcessor } from './processors/rating-refresh.processor'
import { ReconcileProcessor } from './processors/reconcile.processor'
import { NotificationsProcessor } from './processors/notifications.processor'
import { AlertsCheckProcessor } from './processors/alerts-check.processor'
import { TelegramNotificationsModule } from './telegram/telegram-notifications.module'
import { PageWatchProcessor } from './processors/page-watch.processor'
import { PageWatchDispatcherProcessor } from './processors/page-watch-dispatcher.processor'
import { SubscriptionReminderProcessor } from './processors/subscription-reminder.processor'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['apps/worker/.env', '.env'] }), PrismaModule, BullmqModule, TelegramNotificationsModule],
  providers: [
    SchedulerService,
    DedupService,
    MentionService,
    RatingService,
    JobLogService,
    AlertsService,
    SourceDiscoveryProcessor,
    ReviewsSyncProcessor,
    MentionsSyncProcessor,
    RatingRefreshProcessor,
    ReconcileProcessor,
    NotificationsProcessor,
    AlertsCheckProcessor,
    PageWatchProcessor,
    PageWatchDispatcherProcessor,
    SubscriptionReminderProcessor
  ]
})
export class AppModule {}

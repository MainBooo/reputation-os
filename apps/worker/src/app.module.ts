import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './common/prisma/prisma.module'
import { BullmqModule } from './queues/bullmq.module'
import { SchedulerService } from './scheduler/scheduler.service'
import { DedupService } from './services/dedup.service'
import { MentionService } from './services/mention.service'
import { RatingService } from './services/rating.service'
import { VkService } from './services/vk/vk.service'
import { VkBrandSearchService } from './services/vk/vk-brand-search.service'
import { VkCommunitySyncService } from './services/vk/vk-community-sync.service'
import { VkCommunityService } from './services/vk/vk-community.service'
import { VkCommentsService } from './services/vk/vk-comments.service'
import { SourceDiscoveryProcessor } from './processors/source-discovery.processor'
import { ReviewsSyncProcessor } from './processors/reviews-sync.processor'
import { MentionsSyncProcessor } from './processors/mentions-sync.processor'
import { RatingRefreshProcessor } from './processors/rating-refresh.processor'
import { ReconcileProcessor } from './processors/reconcile.processor'
import { NotificationsProcessor } from './processors/notifications.processor'
import { VkBrandSearchProcessor } from './processors/vk/vk-brand-search.processor'
import { VkPriorityCommunitiesProcessor } from './processors/vk/vk-priority-communities.processor'
import { VkOwnedCommunityProcessor } from './processors/vk/vk-owned-community.processor'
import { VkCommentsProcessor } from './processors/vk/vk-comments.processor'
import { VkBrandMatchProcessor } from './processors/vk/vk-brand-match.processor'
import { VkReconcileProcessor } from './processors/vk/vk-reconcile.processor'
import { VkAdapter } from './adapters/vk.adapter'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, BullmqModule],
  providers: [
    VkAdapter,
    SchedulerService,
    DedupService,
    MentionService,
    RatingService,
    VkService,
    VkBrandSearchService,
    VkCommunitySyncService,
    VkCommunityService,
    VkCommentsService,
    SourceDiscoveryProcessor,
    ReviewsSyncProcessor,
    MentionsSyncProcessor,
    RatingRefreshProcessor,
    ReconcileProcessor,
    NotificationsProcessor,
    VkBrandSearchProcessor,
    VkPriorityCommunitiesProcessor,
    VkOwnedCommunityProcessor,
    VkCommentsProcessor,
    VkBrandMatchProcessor,
    VkReconcileProcessor
  ]
})
export class AppModule {}

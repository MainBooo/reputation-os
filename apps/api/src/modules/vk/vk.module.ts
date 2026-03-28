import { Module } from '@nestjs/common'
import { VkController } from './vk.controller'
import { VkService } from './vk.service'
import { BullmqModule } from '../../common/queues/bullmq.module'
import { QUEUES } from '../../common/queues/queue.names'

@Module({
  imports: [
    BullmqModule.register([
      QUEUES.VK_BRAND_SEARCH_DISCOVERY,
      QUEUES.VK_PRIORITY_COMMUNITIES_SYNC,
      QUEUES.VK_OWNED_COMMUNITY_SYNC
    ])
  ],
  controllers: [VkController],
  providers: [VkService],
  exports: [VkService]
})
export class VkModule {}

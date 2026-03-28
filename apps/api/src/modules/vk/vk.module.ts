import { Module } from '@nestjs/common'
import { VkController } from './vk.controller'
import { VkService } from './vk.service'
import { BullmqModule } from '../../common/queues/bullmq.module'

@Module({
  imports: [BullmqModule],
  controllers: [VkController],
  providers: [VkService],
  exports: [VkService]
})
export class VkModule {}

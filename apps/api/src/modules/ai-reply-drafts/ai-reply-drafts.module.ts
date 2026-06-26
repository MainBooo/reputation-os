import { Module } from '@nestjs/common'
import { AiReplyDraftsController } from './ai-reply-drafts.controller'
import { AiReplyDraftsService } from './ai-reply-drafts.service'
import { BillingModule } from '../billing/billing.module'

@Module({
  imports: [BillingModule],
  controllers: [AiReplyDraftsController],
  providers: [AiReplyDraftsService]
})
export class AiReplyDraftsModule {}

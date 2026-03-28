import { Module } from '@nestjs/common'
import { AiReplyDraftsController } from './ai-reply-drafts.controller'
import { AiReplyDraftsService } from './ai-reply-drafts.service'

@Module({
  controllers: [AiReplyDraftsController],
  providers: [AiReplyDraftsService]
})
export class AiReplyDraftsModule {}

import { Module } from '@nestjs/common'
import { MentionsController } from './mentions.controller'
import { MentionsService } from './mentions.service'

@Module({
  controllers: [MentionsController],
  providers: [MentionsService]
})
export class MentionsModule {}

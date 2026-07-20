import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { MentionsController } from './mentions.controller'
import { MentionsService } from './mentions.service'

@Module({
  imports: [AdminModule],
  controllers: [MentionsController],
  providers: [MentionsService]
})
export class MentionsModule {}

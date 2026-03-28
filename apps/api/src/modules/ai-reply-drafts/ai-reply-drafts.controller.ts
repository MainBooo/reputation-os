import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { AiReplyDraftsService } from './ai-reply-drafts.service'
import { GenerateReplyDto } from './dto/generate-reply.dto'

@UseGuards(JwtAuthGuard)
@Controller('mentions')
export class AiReplyDraftsController {
  constructor(private readonly aiReplyDraftsService: AiReplyDraftsService) {}

  @Post(':id/generate-reply')
  generate(@CurrentUser() user: AuthUser, @Param('id') mentionId: string, @Body() dto: GenerateReplyDto) {
    return this.aiReplyDraftsService.generate(user.id, mentionId, dto)
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { GenerateReplyDto } from './dto/generate-reply.dto'

@Injectable()
export class AiReplyDraftsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(userId: string, mentionId: string, dto: GenerateReplyDto) {
    const mention = await this.prisma.mention.findUnique({
      where: { id: mentionId },
      include: { company: true }
    })
    if (!mention) throw new NotFoundException('Mention not found')

    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: mention.company.workspaceId }
    })
    if (!member) throw new ForbiddenException('No access to mention')

    const draftText = mention.sentiment === 'NEGATIVE'
      ? 'Спасибо за обратную связь. Нам жаль, что у вас был такой опыт. Мы уже разбираемся.'
      : 'Спасибо за отзыв. Мы ценим, что вы нашли время написать нам.'

    return this.prisma.aIReplyDraft.create({
      data: {
        companyId: mention.companyId,
        mentionId: mention.id,
        createdByUserId: userId,
        languageCode: dto.languageCode || 'ru',
        tone: dto.tone || 'professional',
        promptVersion: 'mvp-v1',
        draftText,
        status: 'READY',
        modelName: 'stub-reply-model',
        metadata: { source: 'stub' }
      }
    })
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EntitlementsService } from '../billing/entitlements.service'
import { GenerateReplyDto } from './dto/generate-reply.dto'

type YandexGptResponse = {
  output?: Array<{
    content?: Array<{
      text?: string
    }>
  }>
}

@Injectable()
export class AiReplyDraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService
  ) {}

  private buildPrompt(mention: any, dto: GenerateReplyDto) {
    const tone = dto.tone || 'professional'
    const languageCode = dto.languageCode || 'ru'
    const rating = mention.ratingValue ? `${mention.ratingValue}/5` : 'нет оценки'
    const author = mention.author || 'гость'
    const content = mention.content || mention.title || 'Текст отсутствует.'

    return [
      'Ты профессиональный reputation-менеджер премиального заведения.',
      'Пиши ответы максимально естественно, по-человечески и НЕ шаблонно.',
      'Каждый ответ должен отличаться от предыдущих.',
      '',
      `Язык: ${languageCode}.`,
      `Стиль: ${tone}.`,
      `Компания: ${mention.company?.name || 'Компания'}.`,
      `Площадка: ${mention.platform || mention.source?.platform || 'неизвестно'}.`,
      `Автор: ${author}.`,
      `Оценка: ${rating}.`,
      '',
      'Главная задача:',
      '- внимательно анализируй сам отзыв;',
      '- отвечай именно на проблемы из текста;',
      '- используй детали отзыва;',
      '- избегай одинаковых фраз;',
      '- не начинай каждый ответ с "Здравствуйте" или "Благодарим за отзыв";',
      '- не используй канцелярит;',
      '- ответ должен выглядеть как настоящий ответ менеджера, а не AI;',
      '',
      'Если негатив:',
      '- прояви эмпатию;',
      '- упомяни конкретную проблему;',
      '- извинись естественно;',
      '- предложи разобраться;',
      '- не повторяй одни и те же формулировки.',
      '',
      'Если позитив:',
      '- отвечай тепло;',
      '- можно слегка неформально;',
      '- упоминай детали из отзыва.',
      '',
      'Запрещено:',
      '- шаблонные фразы;',
      '- одинаковые начала;',
      '- слишком официальный стиль;',
      '- повторять текст клиента;',
      '- писать "нам очень жаль" в каждом ответе.',
      '',
      'Размер ответа: 2-5 предложений.',
      'Верни только готовый текст ответа.',
      '',
      'Отзыв клиента:',
      content
    ].join('\n')
  }

  private extractText(data: YandexGptResponse) {
    return data?.output?.[0]?.content?.[0]?.text?.trim() || ''
  }

  private async generateWithYandexGpt(mention: any, dto: GenerateReplyDto) {
    const apiKey = process.env.YANDEX_GPT_API_KEY
    const folderId = process.env.YANDEX_GPT_FOLDER_ID
    const model = process.env.YANDEX_GPT_MODEL || 'yandexgpt-lite'

    if (!apiKey || !folderId) {
      throw new BadRequestException('YandexGPT is not configured')
    }

    const response = await fetch('https://ai.api.cloud.yandex.net/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: `gpt://${folderId}/${model}`,
        input: this.buildPrompt(mention, dto),
        temperature: 0.75,
        max_output_tokens: 700
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new BadRequestException(`YandexGPT request failed: ${response.status} ${errorText.slice(0, 300)}`)
    }

    const data = (await response.json()) as YandexGptResponse
    const text = this.extractText(data)

    if (!text) {
      throw new BadRequestException('YandexGPT returned empty reply')
    }

    return text
  }

  async generate(userId: string, mentionId: string, dto: GenerateReplyDto) {
    const mention = await this.prisma.mention.findUnique({
      where: { id: mentionId },
      include: { company: true, source: true }
    })
    if (!mention) throw new NotFoundException('Mention not found')

    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: mention.company.workspaceId }
    })
    if (!member) throw new ForbiddenException('No access to mention')

    const { limits } = await this.entitlements.getForWorkspace(mention.company.workspaceId)
    const maxAiReplies = Number(limits.maxAiRepliesPerMonth)

    if (maxAiReplies >= 0) {
      const monthStart = new Date()
      monthStart.setUTCDate(1)
      monthStart.setUTCHours(0, 0, 0, 0)

      const repliesThisMonth = await this.prisma.aIReplyDraft.count({
        where: {
          company: { workspaceId: mention.company.workspaceId },
          createdAt: { gte: monthStart }
        }
      })

      if (repliesThisMonth >= maxAiReplies) {
        throw new ForbiddenException({ code: 'PLAN_LIMIT', feature: 'maxAiRepliesPerMonth', limit: maxAiReplies })
      }
    }

    const draftText = await this.generateWithYandexGpt(mention, dto)

    return this.prisma.aIReplyDraft.create({
      data: {
        companyId: mention.companyId,
        mentionId: mention.id,
        createdByUserId: userId,
        languageCode: dto.languageCode || 'ru',
        tone: dto.tone || 'professional',
        promptVersion: 'yandexgpt-v2-specific',
        draftText,
        status: 'READY',
        modelName: process.env.YANDEX_GPT_MODEL || 'yandexgpt-lite',
        metadata: { provider: 'yandexgpt' }
      }
    })
  }
}

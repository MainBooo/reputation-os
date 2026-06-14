import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name)

  constructor(private readonly prisma: PrismaService) {}

  async getCompaniesForUser(userId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            companies: {
              include: {
                mentions: {
                  orderBy: { publishedAt: 'desc' },
                  take: 1,
                },
                ratingSnapshots: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    })
    return members.flatMap((m) => m.workspace.companies)
  }

  async getCompanyById(companyId: string, userId: string) {
    return this.prisma.company.findFirst({
      where: {
        id: companyId,
        workspace: { members: { some: { userId } } },
      },
      include: {
        mentions: {
          orderBy: { publishedAt: 'desc' },
          take: 5,
          include: { source: true },
        },
        ratingSnapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
  }

  async getRecentMentions(companyId: string, userId: string, limit = 5) {
    return this.prisma.mention.findMany({
      where: {
        companyId,
        company: { workspace: { members: { some: { userId } } } },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      include: { source: true },
    })
  }

  async createCompany(data: {
    name: string
    platforms: string[]
    yandexUrl?: string
    userId: string
    workspaceId: string
  }) {
    const company = await this.prisma.company.create({
      data: {
        name: data.name,
        normalizedName: data.name.toLowerCase(),
        workspaceId: data.workspaceId,
      },
    })
    this.logger.log(`Создана компания "${data.name}" (id=${company.id}) пользователем ${data.userId}`)
    return company
  }

  async deleteCompany(companyId: string, userId: string): Promise<boolean> {
    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        workspace: { members: { some: { userId, role: { in: ['OWNER', 'ADMIN'] } } } },
      },
    })
    if (!company) return false
    await this.prisma.company.delete({ where: { id: companyId } })
    this.logger.log(`Удалена компания id=${companyId} пользователем ${userId}`)
    return true
  }

  async generateAiReply(mentionId: string): Promise<string> {
    const existing = await this.prisma.aIReplyDraft.findFirst({
      where: { mentionId },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) return existing.draftText

    const mention = await this.prisma.mention.findUnique({
      where: { id: mentionId },
      include: { company: true },
    })
    if (!mention) return 'Упоминание не найдено.'

    const draft = await this.prisma.aIReplyDraft.create({
      data: {
        mentionId,
        companyId: mention.companyId,
        draftText: `Спасибо за ваш отзыв о ${mention.company.name}! Мы ценим ваше мнение и постараемся учесть его в работе.`,
        createdByUserId: null,
        languageCode: 'ru',
        tone: 'professional',
        modelName: 'manual',
        promptVersion: '1',
        status: 'DRAFT',
      },
    })
    return draft.draftText
  }
}

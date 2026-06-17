import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../common/prisma/prisma.service'
import * as jwt from 'jsonwebtoken'

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private makeServiceToken(userId: string): string {
    const secret = this.config.getOrThrow<string>('JWT_SECRET')
    return jwt.sign({ sub: userId, service: 'bot' }, secret, { expiresIn: '5m' })
  }

  // Тот же рейтинг, что отображается в карточке компании на вебе:
  // AVG(Mention.ratingValue) WHERE ratingValue IS NOT NULL
  private async getCurrentRatings(companyIds: string[]): Promise<Map<string, number | null>> {
    const result = new Map<string, number | null>()
    if (!companyIds.length) return result

    const rows = await this.prisma.mention.groupBy({
      by: ['companyId'],
      where: {
        companyId: { in: companyIds },
        ratingValue: { not: null },
      },
      _avg: {
        ratingValue: true,
      },
    })

    for (const row of rows) {
      result.set(
        row.companyId,
        row._avg.ratingValue === null
          ? null
          : Number(row._avg.ratingValue),
      )
    }

    return result
  }

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
              },
            },
          },
        },
      },
    })
    const companies = members.flatMap((m) => m.workspace.companies)
    const ratings = await this.getCurrentRatings(companies.map((c) => c.id))
    return companies.map((c) => ({ ...c, currentRating: ratings.get(c.id) ?? null }))
  }

  async getCompanyById(companyId: string, userId: string) {
    const company = await this.prisma.company.findFirst({
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
      },
    })
    if (!company) return null
    const ratings = await this.getCurrentRatings([company.id])
    return { ...company, currentRating: ratings.get(company.id) ?? null }
  }

  async getRecentMentions(companyId: string, userId: string, limit = 5) {
    const [mentions, sourceTargets] = await Promise.all([
      this.prisma.mention.findMany({
        where: {
          companyId,
          type: 'REVIEW',
          ratingValue: { not: null },
          company: { workspace: { members: { some: { userId } } } },
        },
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        include: { source: true },
      }),
      this.prisma.companySourceTarget.findMany({
        where: { companyId, isActive: true },
        include: { source: true },
      }),
    ])

    const sourceUrlByPlatform = new Map(
      sourceTargets
        .filter((target) => target.externalUrl && target.source?.platform)
        .map((target) => [target.source.platform, target.externalUrl]),
    )

    return mentions.map((mention) => ({
      ...mention,
      sourceUrl: sourceUrlByPlatform.get(mention.source?.platform ?? mention.platform) || mention.source?.baseUrl || null,
    }))
  }

  async createCompany(data: {
    name: string
    platforms: string[]
    yandexUrl?: string
    twoGisUrl?: string
    keywords?: string[]
    userId: string
    workspaceId: string
  }) {
    const apiUrl = this.config.getOrThrow<string>('API_INTERNAL_URL')
    const token = this.makeServiceToken(data.userId)

    const body = {
      workspaceId: data.workspaceId,
      name: data.name,
      ...(data.yandexUrl && { yandexUrl: data.yandexUrl }),
      ...(data.twoGisUrl && { twoGisUrl: data.twoGisUrl }),
      ...(data.keywords?.length && { keywords: data.keywords }),
    }

    const res = await fetch(`${apiUrl}/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      this.logger.error(`API createCompany failed: ${res.status} ${err}`)
      throw new Error(`Ошибка создания компании: ${res.status}`)
    }

    const company = await res.json() as any
    this.logger.log(`Создана компания "${company.name}" (id=${company.id}) через API`)
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

  async generateAiReply(mentionId: string, userId: string): Promise<string> {
    const apiUrl = this.config.getOrThrow<string>('API_INTERNAL_URL')
    const token = this.makeServiceToken(userId)

    const res = await fetch(`${apiUrl}/mentions/${mentionId}/generate-reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        languageCode: 'ru',
        tone: 'professional',
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      this.logger.error(`API generateAiReply failed: ${res.status} ${err}`)
      throw new Error(`Ошибка генерации AI-ответа: ${res.status}`)
    }

    const draft = await res.json() as { draftText?: string }

    if (!draft.draftText) {
      this.logger.error(`API generateAiReply returned empty draftText for mention=${mentionId}`)
      throw new Error('API вернул пустой AI-ответ')
    }

    return draft.draftText
  }
}

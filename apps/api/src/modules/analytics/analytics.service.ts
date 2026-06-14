import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EntitlementsService } from '../billing/entitlements.service'

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService
  ) {}

  private async assertCompanyAccess(userId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { workspaceId: true } })
    if (!company) throw new NotFoundException('Company not found')

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true, isActive: true }
    })

    if (user?.isActive && user.systemRole === 'SUPER_ADMIN') return

    const member = await this.prisma.workspaceMember.findFirst({ where: { workspaceId: company.workspaceId, userId } })
    if (!member) throw new ForbiddenException('No access to company')
  }

  async overview(userId: string, companyId: string, from?: string, to?: string) {
    await this.assertCompanyAccess(userId, companyId)

    const startDate = from ? new Date(`${from}T00:00:00.000Z`) : new Date()
    const endDate = to ? new Date(`${to}T23:59:59.999Z`) : new Date()

    if (!from) {
      startDate.setHours(0, 0, 0, 0)
      startDate.setDate(startDate.getDate() - 6)
    }

    const periodWhere = { companyId, createdAt: { gte: startDate, lte: endDate } }

    const [mentionsCount, positiveCount, neutralCount, negativeCount, reviewsCount, latest, ratingAgg] = await Promise.all([
      this.prisma.mention.count({ where: periodWhere }),
      this.prisma.mention.count({ where: { ...periodWhere, sentiment: 'POSITIVE' } }),
      this.prisma.mention.count({ where: { ...periodWhere, sentiment: 'NEUTRAL' } }),
      this.prisma.mention.count({ where: { ...periodWhere, sentiment: 'NEGATIVE' } }),
      this.prisma.mention.count({ where: { ...periodWhere, type: 'REVIEW' } }),
      this.prisma.mention.findMany({ where: periodWhere, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], take: 10 }),
      this.prisma.mention.aggregate({
        where: { ...periodWhere, ratingValue: { not: null } },
        _avg: { ratingValue: true }
      })
    ])

    const rating = Number(ratingAgg._avg.ratingValue || 0)
    const positiveShare = mentionsCount ? Math.round((positiveCount / mentionsCount) * 100) : 0

    const dailyMentions = await this.prisma.mention.findMany({
      where: { companyId, createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true, sentiment: true, ratingValue: true }
    })

    const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1)
    const daysCount = Math.min(diffDays, 31)

    const days = Array.from({ length: daysCount }).map((_, index) => {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + index)

      const key = date.toISOString().slice(0, 10)
      const rows = dailyMentions.filter((item) => item.createdAt.toISOString().slice(0, 10) === key)
      const ratingRows = rows.filter((item) => item.ratingValue !== null)

      const dayRating = ratingRows.length
        ? ratingRows.reduce((sum, item) => sum + Number(item.ratingValue || 0), 0) / ratingRows.length
        : rating

      return {
        label: date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
        positive: rows.filter((item) => item.sentiment === 'POSITIVE').length,
        neutral: rows.filter((item) => item.sentiment === 'NEUTRAL').length,
        negative: rows.filter((item) => item.sentiment === 'NEGATIVE').length,
        rating: dayRating ? Number(Math.max(1, Math.min(5, dayRating)).toFixed(2)) : 0
      }
    })

    return {
      mentionsCount,
      positiveCount,
      neutralCount,
      negativeCount,
      reviewsCount,
      rating,
      positiveShare,
      trend: days,
      reputationTrend: days,
      latest,
      deltas: { total: 0, positive: 0, negative: 0 }
    }
  }

  async sentiment(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { workspaceId: true } })
    if (company && !await this.entitlements.can(company.workspaceId, 'advancedAnalytics')) {
      throw new ForbiddenException({ code: 'PLAN_LIMIT', feature: 'advancedAnalytics' })
    }
    const grouped = await this.prisma.mention.groupBy({
      by: ['sentiment'],
      where: { companyId },
      _count: { _all: true }
    })
    return grouped.map((item) => ({ sentiment: item.sentiment, count: item._count._all }))
  }

  async platforms(userId: string, companyId: string, from?: string, to?: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { workspaceId: true } })
    if (company && !await this.entitlements.can(company.workspaceId, 'advancedAnalytics')) {
      throw new ForbiddenException({ code: 'PLAN_LIMIT', feature: 'advancedAnalytics' })
    }
    await this.assertCompanyAccess(userId, companyId)

    const startDate = from ? new Date(`${from}T00:00:00.000Z`) : new Date()
    const endDate = to ? new Date(`${to}T23:59:59.999Z`) : new Date()

    if (!from) {
      startDate.setHours(0, 0, 0, 0)
      startDate.setDate(startDate.getDate() - 6)
    }

    const grouped = await this.prisma.mention.groupBy({
      by: ['platform'],
      where: { companyId, createdAt: { gte: startDate, lte: endDate } },
      _count: { _all: true },
      _avg: { ratingValue: true }
    })

    const data = grouped.map((item) => ({
      platform: item.platform,
      count: item._count._all,
      avgRating: item._avg.ratingValue ? Number(item._avg.ratingValue.toFixed(1)) : null
    }))

    const webCount = data.find((item) => item.platform === 'WEB')?.count ?? 0
    return { items: data, platforms: data, webCount }
  }
}

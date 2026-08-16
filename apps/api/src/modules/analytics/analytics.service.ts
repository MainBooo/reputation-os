import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EntitlementsService } from '../billing/entitlements.service'
import { USER_RELEVANT_MENTION } from '../mentions/mention-visibility.filter'

const DAY_MS = 24 * 60 * 60 * 1000

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService, private readonly entitlements: EntitlementsService) {}

  private async assertCompanyAccess(userId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { workspaceId: true } })
    if (!company) throw new NotFoundException('Company not found')
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true, isActive: true } })
    if (user?.isActive && user.systemRole === 'SUPER_ADMIN') return company
    const member = await this.prisma.workspaceMember.findFirst({ where: { workspaceId: company.workspaceId, userId } })
    if (!member) throw new ForbiddenException('No access to company')
    return company
  }

  private period(from?: string, to?: string) {
    const endDate = to ? new Date(`${to}T23:59:59.999Z`) : new Date()
    const startDate = from ? new Date(`${from}T00:00:00.000Z`) : new Date(endDate)
    if (!from) {
      startDate.setUTCHours(0, 0, 0, 0)
      startDate.setUTCDate(startDate.getUTCDate() - 6)
    }
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate > endDate) {
      throw new BadRequestException('Invalid analytics period')
    }
    const durationMs = endDate.getTime() - startDate.getTime() + 1
    const previousEnd = new Date(startDate.getTime() - 1)
    const previousStart = new Date(previousEnd.getTime() - durationMs + 1)
    return { startDate, endDate, previousStart, previousEnd }
  }

  private relevantWhere(companyId: string, startDate: Date, endDate: Date): Prisma.MentionWhereInput {
    return { companyId, publishedAt: { gte: startDate, lte: endDate }, AND: [USER_RELEVANT_MENTION] }
  }

  private percentDelta(current: number, previous: number): number | null {
    return previous === 0 ? null : Number((((current - previous) / previous) * 100).toFixed(1))
  }

  async overview(userId: string, companyId: string, from?: string, to?: string) {
    await this.assertCompanyAccess(userId, companyId)
    const { startDate, endDate, previousStart, previousEnd } = this.period(from, to)
    const periodWhere = this.relevantWhere(companyId, startDate, endDate)
    const previousWhere = this.relevantWhere(companyId, previousStart, previousEnd)

    const [mentionsCount, positiveCount, neutralCount, negativeCount, reviewsCount, latest, ratingAgg,
      previousCount, previousPositive, previousNegative, previousRatingAgg, snapshots, platformGroups] = await Promise.all([
      this.prisma.mention.count({ where: periodWhere }),
      this.prisma.mention.count({ where: { ...periodWhere, sentiment: 'POSITIVE' } }),
      this.prisma.mention.count({ where: { ...periodWhere, sentiment: 'NEUTRAL' } }),
      this.prisma.mention.count({ where: { ...periodWhere, sentiment: 'NEGATIVE' } }),
      this.prisma.mention.count({ where: { ...periodWhere, type: 'REVIEW' } }),
      this.prisma.mention.findMany({ where: periodWhere, orderBy: { publishedAt: 'desc' }, take: 10 }),
      this.prisma.mention.aggregate({ where: { ...periodWhere, ratingValue: { not: null } }, _avg: { ratingValue: true } }),
      this.prisma.mention.count({ where: previousWhere }),
      this.prisma.mention.count({ where: { ...previousWhere, sentiment: 'POSITIVE' } }),
      this.prisma.mention.count({ where: { ...previousWhere, sentiment: 'NEGATIVE' } }),
      this.prisma.mention.aggregate({ where: { ...previousWhere, ratingValue: { not: null } }, _avg: { ratingValue: true } }),
      this.prisma.ratingSnapshot.findMany({
        where: { companyId, capturedAt: { gte: startDate, lte: endDate } },
        select: { capturedAt: true, ratingValue: true },
        orderBy: { capturedAt: 'asc' }
      }),
      this.prisma.mention.groupBy({
        by: ['platform'], where: periodWhere, _count: { _all: true }
      })
    ])

    type DailyRow = { day: Date; positive: bigint; neutral: bigint; negative: bigint }
    const dailyRows = await this.prisma.$queryRaw<DailyRow[]>`
      SELECT date_trunc('day', "publishedAt" AT TIME ZONE 'UTC') AS day,
        COUNT(*) FILTER (WHERE sentiment = 'POSITIVE') AS positive,
        COUNT(*) FILTER (WHERE sentiment = 'NEUTRAL') AS neutral,
        COUNT(*) FILTER (WHERE sentiment = 'NEGATIVE') AS negative
      FROM "Mention"
      WHERE "companyId" = ${companyId}
        AND "publishedAt" >= ${startDate} AND "publishedAt" <= ${endDate}
        AND "isInboxVisible" = TRUE AND "needsManualReview" = FALSE
        AND ("reviewDecision" = 'RELEVANT' OR (
          ("reviewDecision" IS NULL OR "reviewDecision" <> 'IRRELEVANT')
          AND ("messageClassification" IS NULL OR "messageClassification" <> 'IRRELEVANT')
        ))
      GROUP BY 1 ORDER BY 1
    `

    const dailyMap = new Map(dailyRows.map((row) => [row.day.toISOString().slice(0, 10), row]))
    const daysCount = Math.min(Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1), 31)
    const trend = Array.from({ length: daysCount }).map((_, index) => {
      const date = new Date(startDate)
      date.setUTCDate(startDate.getUTCDate() + index)
      const row = dailyMap.get(date.toISOString().slice(0, 10))
      return {
        label: date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
        positive: row ? Number(row.positive) : 0,
        neutral: row ? Number(row.neutral) : 0,
        negative: row ? Number(row.negative) : 0
      }
    })

    const snapshotDays = new Map<string, number[]>()
    for (const snapshot of snapshots) {
      const key = snapshot.capturedAt.toISOString().slice(0, 10)
      snapshotDays.set(key, [...(snapshotDays.get(key) ?? []), Number(snapshot.ratingValue)])
    }
    const reputationTrend = [...snapshotDays.entries()].map(([date, values]) => ({
      date,
      label: new Date(`${date}T00:00:00.000Z`).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
      rating: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
    }))

    const rating = ratingAgg._avg.ratingValue == null ? null : Number(ratingAgg._avg.ratingValue)
    const previousRating = previousRatingAgg._avg.ratingValue == null ? null : Number(previousRatingAgg._avg.ratingValue)
    return {
      period: { from: startDate, to: endDate }, mentionsCount, positiveCount, neutralCount, negativeCount, reviewsCount,
      rating,
      positiveShare: mentionsCount ? Math.round((positiveCount / mentionsCount) * 100) : null,
      trend, reputationTrend, latest,
      platformDistribution: platformGroups.map((item) => ({ platform: item.platform, count: item._count._all })),
      deltas: {
        total: this.percentDelta(mentionsCount, previousCount),
        positive: this.percentDelta(positiveCount, previousPositive),
        negative: this.percentDelta(negativeCount, previousNegative),
        rating: rating == null || previousRating == null ? null : Number((rating - previousRating).toFixed(2))
      }
    }
  }

  async sentiment(userId: string, companyId: string, from?: string, to?: string) {
    const company = await this.assertCompanyAccess(userId, companyId)
    if (!await this.entitlements.can(company.workspaceId, 'advancedAnalytics')) {
      throw new ForbiddenException({ code: 'PLAN_LIMIT', feature: 'advancedAnalytics' })
    }
    const { startDate, endDate } = this.period(from, to)
    const grouped = await this.prisma.mention.groupBy({
      by: ['sentiment'], where: this.relevantWhere(companyId, startDate, endDate), _count: { _all: true }
    })
    return grouped.map((item) => ({ sentiment: item.sentiment, count: item._count._all }))
  }

  async platforms(userId: string, companyId: string, from?: string, to?: string) {
    const company = await this.assertCompanyAccess(userId, companyId)
    if (!await this.entitlements.can(company.workspaceId, 'advancedAnalytics')) {
      throw new ForbiddenException({ code: 'PLAN_LIMIT', feature: 'advancedAnalytics' })
    }
    const { startDate, endDate } = this.period(from, to)
    const grouped = await this.prisma.mention.groupBy({
      by: ['platform'], where: this.relevantWhere(companyId, startDate, endDate),
      _count: { _all: true }, _avg: { ratingValue: true }
    })
    const data = grouped.map((item) => ({
      platform: item.platform, count: item._count._all,
      avgRating: item._avg.ratingValue ? Number(item._avg.ratingValue.toFixed(1)) : null
    }))
    return { items: data, platforms: data, webCount: data.find((item) => item.platform === 'WEB')?.count ?? 0 }
  }
}

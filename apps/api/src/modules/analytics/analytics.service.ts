import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCompanyAccess(userId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { workspaceId: true } })
    if (!company) throw new NotFoundException('Company not found')
    const member = await this.prisma.workspaceMember.findFirst({ where: { workspaceId: company.workspaceId, userId } })
    if (!member) throw new ForbiddenException('No access to company')
  }

  async overview(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)
    const [mentionsCount, negativeCount, reviewsCount, latest] = await Promise.all([
      this.prisma.mention.count({ where: { companyId } }),
      this.prisma.mention.count({ where: { companyId, sentiment: 'NEGATIVE' } }),
      this.prisma.mention.count({ where: { companyId, type: 'REVIEW' } }),
      this.prisma.mention.findMany({ where: { companyId }, orderBy: { publishedAt: 'desc' }, take: 10 })
    ])
    return { mentionsCount, negativeCount, reviewsCount, latest }
  }

  async sentiment(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)
    const grouped = await this.prisma.mention.groupBy({
      by: ['sentiment'],
      where: { companyId },
      _count: { _all: true }
    })
    return grouped.map((item) => ({ sentiment: item.sentiment, count: item._count._all }))
  }

  async platforms(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)
    const grouped = await this.prisma.mention.groupBy({
      by: ['platform'],
      where: { companyId },
      _count: { _all: true }
    })
    const data = grouped.map((item) => ({ platform: item.platform, count: item._count._all }))
    const webCount = data.find((item) => item.platform === 'WEB')?.count ?? 0
    return { platforms: data, webCount }
  }
}

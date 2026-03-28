import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCompanyAccess(userId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { workspaceId: true } })
    if (!company) throw new NotFoundException('Company not found')
    const member = await this.prisma.workspaceMember.findFirst({ where: { workspaceId: company.workspaceId, userId } })
    if (!member) throw new ForbiddenException('No access to company')
  }

  async history(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)
    return this.prisma.ratingSnapshot.findMany({
      where: { companyId },
      include: { source: true },
      orderBy: { capturedAt: 'asc' }
    })
  }

  async overview(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)
    const snapshots = await this.prisma.ratingSnapshot.findMany({
      where: { companyId },
      include: { source: true },
      orderBy: { capturedAt: 'desc' }
    })

    const grouped = new Map<string, { ratingValue: number; reviewsCount: number }>()
    for (const snapshot of snapshots) {
      if (!grouped.has(snapshot.platform)) {
        grouped.set(snapshot.platform, {
          ratingValue: Number(snapshot.ratingValue),
          reviewsCount: snapshot.reviewsCount ?? 0
        })
      }
    }

    let weightedNumerator = 0
    let weightedDenominator = 0
    for (const item of grouped.values()) {
      weightedNumerator += item.ratingValue * item.reviewsCount
      weightedDenominator += item.reviewsCount
    }

    const aggregatedRating = weightedDenominator > 0 ? weightedNumerator / weightedDenominator : null
    return {
      aggregatedRating,
      platforms: Array.from(grouped.entries()).map(([platform, item]) => ({
        platform,
        ratingValue: item.ratingValue,
        reviewsCount: item.reviewsCount
      }))
    }
  }
}

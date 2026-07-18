import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

export interface TelegramBootstrapTarget {
  sourceId: string
  companySourceTargetId: string
  autoAddToWatchlist: boolean
}

/** Mirrors apps/api SyncService.ensureWebBootstrapTarget for the WEB platform —
 *  one lazily-created Source{platform:TELEGRAM} per workspace, one lazily-created
 *  CompanySourceTarget per company (externalPlaceId=`telegram-bootstrap:{companyId}`)
 *  carrying the autoAddToWatchlist opt-in flag in its config JSON. */
@Injectable()
export class TelegramScoutSourceService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureBootstrapTarget(companyId: string): Promise<TelegramBootstrapTarget> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, workspaceId: true, name: true }
    })

    if (!company) throw new Error(`Company not found: ${companyId}`)

    let source = await this.prisma.source.findFirst({
      where: { workspaceId: company.workspaceId, platform: 'TELEGRAM', type: 'SOCIAL_MENTION_FEED' }
    })

    if (!source) {
      source = await this.prisma.source.create({
        data: {
          workspaceId: company.workspaceId,
          name: 'Telegram monitoring',
          platform: 'TELEGRAM',
          type: 'SOCIAL_MENTION_FEED',
          baseUrl: null,
          isEnabled: true,
          config: { origin: 'auto-bootstrap' }
        }
      })
    }

    const externalPlaceId = `telegram-bootstrap:${company.id}`

    let target = await this.prisma.companySourceTarget.findFirst({
      where: { companyId: company.id, sourceId: source.id, externalPlaceId }
    })

    if (!target) {
      target = await this.prisma.companySourceTarget.create({
        data: {
          companyId: company.id,
          sourceId: source.id,
          externalPlaceId,
          externalUrl: null,
          displayName: `${company.name} · Telegram Scout`,
          isActive: true,
          syncReviewsEnabled: false,
          syncRatingsEnabled: false,
          syncMentionsEnabled: true,
          config: { origin: 'auto-bootstrap', autoAddToWatchlist: false }
        }
      })
    }

    const config = (target.config as Record<string, unknown> | null) ?? {}

    return {
      sourceId: source.id,
      companySourceTargetId: target.id,
      autoAddToWatchlist: config.autoAddToWatchlist === true
    }
  }
}

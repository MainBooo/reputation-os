import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Queue } from 'bullmq'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EntitlementsService } from '../billing/entitlements.service'
import { CreateTelegramChannelDto } from './dto/create-telegram-channel.dto'
import { UpdateTelegramChannelDto } from './dto/update-telegram-channel.dto'

const RESOLVE_POLL_TIMEOUT_MS = 20_000
const RESOLVE_POLL_INTERVAL_MS = 1_000
const CHECK_POLL_TIMEOUT_MS = 15_000
const CHECK_POLL_INTERVAL_MS = 1_000

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

@Injectable()
export class TelegramChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    @Inject('SYNC_QUEUE_TELEGRAM_SEARCH') private readonly telegramSearchQueue: Queue
  ) {}

  private async resolveCompany(userId: string, companyId: string, access: 'read' | 'write' = 'read') {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new NotFoundException('Company not found')

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true, isActive: true }
    })

    if (!(user?.isActive && user.systemRole === 'SUPER_ADMIN')) {
      const member = await this.prisma.workspaceMember.findFirst({
        where: { userId, workspaceId: company.workspaceId }
      })
      if (!member) throw new ForbiddenException('No access to company')
      if (access === 'write' && member.role !== 'OWNER' && member.role !== 'ADMIN') {
        throw new ForbiddenException('No write access to company')
      }
    }

    return company
  }

  private async assertTelegramMonitoringAllowed(workspaceId: string) {
    const entitlements = await this.entitlements.getForWorkspace(workspaceId)

    if (!entitlements.workspaceActive) {
      throw new ForbiddenException('Workspace is disabled')
    }

    if (!entitlements.limits.telegramMonitoringEnabled || !entitlements.limits.platforms.includes('TELEGRAM' as any)) {
      throw new ForbiddenException({ code: 'PLAN_LIMIT', feature: 'telegramMonitoringEnabled' })
    }
  }

  async list(userId: string, companyId: string) {
    await this.resolveCompany(userId, companyId, 'read')

    const links = await this.prisma.companyTelegramChannel.findMany({
      where: { companyId },
      include: { telegramChannel: true },
      orderBy: { createdAt: 'desc' }
    })

    return links.map((link) => this.toDto(link))
  }

  private toDto(link: any) {
    return {
      id: link.id,
      chatId: link.telegramChannel.chatId,
      username: link.telegramChannel.username,
      title: link.telegramChannel.title,
      entityType: link.telegramChannel.entityType,
      enabled: link.enabled,
      discoveryMethod: link.discoveryMethod,
      matchedQuery: link.matchedQuery,
      checkIntervalMin: link.checkIntervalMin,
      nextCheckAt: link.nextCheckAt,
      lastCheckedAt: link.lastCheckedAt,
      consecutiveErrors: link.consecutiveErrors,
      lastError: link.lastError,
      lastDecisionReason: link.lastDecisionReason,
      relevanceScore: link.relevanceScore,
      mentionsFoundCount: link.mentionsFoundCount,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt
    }
  }

  async create(userId: string, companyId: string, dto: CreateTelegramChannelDto) {
    const company = await this.resolveCompany(userId, companyId, 'write')
    await this.assertTelegramMonitoringAllowed(company.workspaceId)

    const username = dto.username.replace(/^@/, '').trim()
    if (!username) throw new BadRequestException('username is required')

    const jobId = `telegram-manual-add:${companyId}:${Date.now()}`
    const job = await this.telegramSearchQueue.add(
      'telegram.source_check',
      { mode: 'source_check', companyId, username },
      { jobId, attempts: 1, removeOnComplete: { age: 3600 }, removeOnFail: { age: 86400 } }
    )

    const result = await this.pollJobLog(String(job.id), RESOLVE_POLL_TIMEOUT_MS, RESOLVE_POLL_INTERVAL_MS)

    if (!result) {
      return { queued: true, stillProcessing: true, bullJobId: String(job.id) }
    }

    const payload = (result.result as Record<string, unknown>) || {}

    if (payload.ok === false) {
      const messages: Record<string, string> = {
        invalid_username: 'Некорректный username.',
        not_found: 'Не удалось найти канал/группу с таким username.',
        not_channel_or_group: 'Это не публичный канал, группа или супергруппа.',
        not_public: 'У найденной сущности нет публичного username.'
      }
      const reason = String(payload.reason || '')
      throw new BadRequestException(messages[reason] || (payload.message as string) || 'Не удалось добавить источник')
    }

    const companyTelegramChannelId = payload.companyTelegramChannelId as string | undefined
    if (!companyTelegramChannelId) {
      return { queued: true, stillProcessing: true, bullJobId: String(job.id) }
    }

    const link = await this.prisma.companyTelegramChannel.findUnique({
      where: { id: companyTelegramChannelId },
      include: { telegramChannel: true }
    })

    if (!link) throw new BadRequestException('Не удалось добавить источник')

    return this.toDto(link)
  }

  async update(userId: string, companyId: string, channelId: string, dto: UpdateTelegramChannelDto) {
    await this.resolveCompany(userId, companyId, 'write')

    const link = await this.prisma.companyTelegramChannel.findUnique({ where: { id: channelId } })
    if (!link || link.companyId !== companyId) throw new NotFoundException('Telegram channel not found')

    if (dto.enabled === true && !link.enabled) {
      const company = await this.prisma.company.findUnique({ where: { id: companyId } })
      if (company) await this.assertTelegramMonitoringAllowed(company.workspaceId)
    }

    const updated = await this.prisma.companyTelegramChannel.update({
      where: { id: channelId },
      data: {
        ...(dto.enabled !== undefined
          ? {
              enabled: dto.enabled,
              // See the dispatcher's WHERE nextCheckAt <= now — NULL never matches,
              // so a freshly-enabled row needs an immediate due date.
              nextCheckAt: dto.enabled ? new Date() : link.nextCheckAt
            }
          : {}),
        ...(dto.checkIntervalMin !== undefined ? { checkIntervalMin: dto.checkIntervalMin } : {})
      },
      include: { telegramChannel: true }
    })

    return this.toDto(updated)
  }

  async remove(userId: string, companyId: string, channelId: string) {
    await this.resolveCompany(userId, companyId, 'write')

    const link = await this.prisma.companyTelegramChannel.findUnique({ where: { id: channelId } })
    if (!link || link.companyId !== companyId) throw new NotFoundException('Telegram channel not found')

    await this.prisma.companyTelegramChannel.delete({ where: { id: channelId } })
    return { deleted: true }
  }

  async checkNow(userId: string, companyId: string, channelId: string) {
    await this.resolveCompany(userId, companyId, 'write')

    const link = await this.prisma.companyTelegramChannel.findUnique({ where: { id: channelId } })
    if (!link || link.companyId !== companyId) throw new NotFoundException('Telegram channel not found')

    const jobId = `telegram-source-check:${channelId}:${Date.now()}`
    const job = await this.telegramSearchQueue.add(
      'telegram.source_check',
      { mode: 'source_check', companyId, telegramChannelId: link.telegramChannelId },
      { jobId, attempts: 1, removeOnComplete: { age: 3600 }, removeOnFail: { age: 86400 } }
    )

    const result = await this.pollJobLog(String(job.id), CHECK_POLL_TIMEOUT_MS, CHECK_POLL_INTERVAL_MS)

    if (!result) {
      return { queued: true, stillProcessing: true, bullJobId: String(job.id) }
    }

    if (result.jobStatus === 'PARTIAL' && (result.result as any)?.reason?.startsWith('mtproto_lock_busy')) {
      return { queued: true, busy: true, message: 'Агент временно занят, повторите через несколько минут.' }
    }

    return { queued: false, status: result.jobStatus, result: result.result }
  }

  async startTelegramSync(userId: string, companyId: string) {
    const company = await this.resolveCompany(userId, companyId, 'write')
    await this.assertTelegramMonitoringAllowed(company.workspaceId)
    await this.ensureTelegramBootstrapTarget(companyId)

    const jobId = `telegram-discovery:${companyId}:manual-${Date.now()}`
    const job = await this.telegramSearchQueue.add(
      'telegram.discovery',
      { mode: 'discovery', companyId, triggeredByUserId: userId },
      { jobId, attempts: 1, removeOnComplete: { age: 3600 }, removeOnFail: { age: 86400 } }
    )

    const log = await this.prisma.jobLog.create({
      data: {
        companyId,
        triggeredByUserId: userId,
        queueName: 'telegram_search',
        jobName: 'telegram.discovery',
        jobStatus: 'PENDING',
        result: { bullJobId: String(job.id), mode: 'discovery' }
      }
    })

    return { queued: true, bullJobId: String(job.id), log }
  }

  async getScoutStatus(userId: string, companyId: string) {
    await this.resolveCompany(userId, companyId, 'read')

    const latestLog = await this.prisma.jobLog.findFirst({
      where: { companyId, queueName: 'telegram_search' },
      orderBy: { createdAt: 'desc' }
    })

    const [enabledCount, totalCount, aggregate] = await Promise.all([
      this.prisma.companyTelegramChannel.count({ where: { companyId, enabled: true } }),
      this.prisma.companyTelegramChannel.count({ where: { companyId } }),
      this.prisma.companyTelegramChannel.aggregate({
        where: { companyId },
        _sum: { mentionsFoundCount: true }
      })
    ])

    return {
      companyId,
      latestLog,
      watchlistEnabledCount: enabledCount,
      watchlistTotalCount: totalCount,
      totalMentionsFound: aggregate._sum.mentionsFoundCount || 0
    }
  }

  private async ensureTelegramBootstrapTarget(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new NotFoundException('Company not found')

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

    const existing = await this.prisma.companySourceTarget.findFirst({
      where: { companyId: company.id, sourceId: source.id, externalPlaceId }
    })

    if (existing) {
      if (!existing.isActive || !existing.syncMentionsEnabled) {
        return this.prisma.companySourceTarget.update({
          where: { id: existing.id },
          data: { isActive: true, syncMentionsEnabled: true }
        })
      }
      return existing
    }

    return this.prisma.companySourceTarget.create({
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

  private async pollJobLog(bullJobId: string, timeoutMs: number, intervalMs: number) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const log = await this.prisma.jobLog.findFirst({
        where: {
          queueName: 'telegram_search',
          result: { path: ['bullJobId'], equals: bullJobId }
        },
        orderBy: { createdAt: 'desc' }
      })

      if (log && log.jobStatus !== 'PENDING' && log.jobStatus !== 'RUNNING') {
        return log
      }

      await delay(intervalMs)
    }

    return null
  }
}

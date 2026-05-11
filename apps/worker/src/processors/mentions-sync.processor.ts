import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { SourceAdapterFactory } from '../adapters/source-adapter.factory'
import { MentionService } from '../services/mention.service'
import { JobLogService } from '../services/job-log.service'
import { QUEUES } from '../queues/queue.names'
import { WORKER_OPTIONS } from '../queues/job-options'

@Injectable()
export class MentionsSyncProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

  private isMapReviewUrl(value?: string | null) {
    if (!value) return false

    try {
      const parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
      const path = parsed.pathname.toLowerCase()

      return (
        host === '2gis.ru' ||
        host.endsWith('.2gis.ru') ||
        (
          (host === 'yandex.ru' || host.endsWith('.yandex.ru') || host === 'yandex.com' || host.endsWith('.yandex.com')) &&
          path.startsWith('/maps')
        )
      )
    } catch {
      const lower = value.toLowerCase()
      return lower.includes('2gis.ru') || lower.includes('yandex.ru/maps') || lower.includes('yandex.com/maps')
    }
  }

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.MENTIONS_SYNC}`) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly mentionService: MentionService,
    private readonly jobLogService: JobLogService
  ) {}

  onModuleInit() {
    this.worker = new Worker(QUEUES.MENTIONS_SYNC, async (job: Job) => this.handle(job), {
      connection: this.connection,
      ...WORKER_OPTIONS.mentionsSync
    })
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(job: Job) {
    const { companyId } = job.data

    try {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        include: {
          aliases: {
            orderBy: { priority: 'desc' },
            take: 5
          }
        }
      })

      const targets = await this.prisma.companySourceTarget.findMany({
        where: { companyId, syncMentionsEnabled: true },
        include: { source: true }
      })

      let itemsDiscovered = 0
      let itemsCreated = 0
      let itemsUpdated = 0
      let itemsDeduped = 0

      for (const target of targets) {
        if (!['WEB', 'CUSTOM'].includes(target.source.platform)) continue

        const adapter = SourceAdapterFactory.getAdapter(target.source.platform)
        const mentions = await adapter.fetchMentions({
          ...target,
          searchContext: {
            companyName: company?.name || null,
            website: company?.website || target.externalUrl || null,
            city: company?.city || null,
            industry: company?.industry || null,
            aliases: company?.aliases?.map((alias) => alias.value) || []
          }
        })

        itemsDiscovered += mentions.length

        for (const item of mentions) {
          if (target.source.platform === 'WEB' && this.isMapReviewUrl(item.url)) {
            console.log('[WEB] skip map/review platform mention', { companyId, url: item.url })
            itemsDeduped += 1
            continue
          }

          let companySourceTargetId = target.id

          if (target.source.platform === 'WEB' && item.url) {
            const existingAutoTarget = await this.prisma.companySourceTarget.findFirst({
              where: {
                companyId,
                sourceId: target.sourceId,
                externalUrl: item.url
              }
            })

            if (existingAutoTarget) {
              companySourceTargetId = existingAutoTarget.id
            } else {
              const createdAutoTarget = await this.prisma.companySourceTarget.create({
                data: {
                  companyId,
                  sourceId: target.sourceId,
                  externalUrl: item.url,
                  displayName: item.title || item.url,
                  isActive: false,
                  syncReviewsEnabled: false,
                  syncRatingsEnabled: false,
                  syncMentionsEnabled: false,
                  config: {
                    origin: 'auto',
                    scanIntervalHours: 24,
                    discoveredBy: 'yandex_search',
                    discoveredFromTargetId: target.id
                  }
                }
              })

              companySourceTargetId = createdAutoTarget.id
            }
          }

          const existingMention = item.externalMentionId
            ? await this.prisma.mention.findFirst({
                where: {
                  companyId,
                  platform: target.source.platform,
                  externalMentionId: item.externalMentionId
                },
                select: { id: true }
              })
            : null

          await this.mentionService.persistExternalMention({
            companyId,
            sourceId: target.sourceId,
            platform: target.source.platform,
            type: target.source.platform === 'WEB' ? 'WEB_MENTION' : 'SOCIAL_MENTION',
            externalMentionId: item.externalMentionId,
            url: item.url,
            title: item.title,
            content: item.content,
            author: item.author,
            publishedAt: item.publishedAt,
            rawPayload: item,
            metadata: { syncType: 'mentions' },
            companySourceTargetId
          })

          if (existingMention) {
            itemsUpdated += 1
          } else {
            itemsCreated += 1
          }
        }
      }

      await this.jobLogService.finish({
        companyId,
        queueName: QUEUES.MENTIONS_SYNC,
        jobName: 'mentions.sync',
        bullJobId: job.id,
        status: 'SUCCESS',
        itemsDiscovered,
        itemsCreated,
        itemsUpdated,
        itemsDeduped,
        result: {
          processedTargets: targets.length
        }
      }).catch(() => null)

      return { companyId, processedTargets: targets.length, itemsDiscovered, itemsCreated, itemsUpdated, itemsDeduped }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      await this.jobLogService.finish({
        companyId,
        queueName: QUEUES.MENTIONS_SYNC,
        jobName: 'mentions.sync',
        bullJobId: job.id,
        status: 'FAILED',
        errorMessage: message
      }).catch(() => null)

      throw error
    }
  }
}

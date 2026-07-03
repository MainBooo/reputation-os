import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Queue } from 'bullmq'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EntitlementsService } from '../billing/entitlements.service'
import { QUEUES } from '../../common/queues/queue.names'
import { JOBS } from '../../common/queues/job.names'
import { SYNC_JOB_OPTIONS, CRON_JOB_OPTIONS } from '../../common/queues/job-options'
import { CreateCompanyDto } from './dto/create-company.dto'
import { UpdateCompanyDto } from './dto/update-company.dto'
import { CreateCompanyAliasDto } from './dto/create-company-alias.dto'
import { CreateCompanySourceTargetDto } from './dto/create-company-source-target.dto'
import { UpdateCompanySourceTargetDto } from './dto/update-company-source-target.dto'

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    @Inject(`QUEUE_${QUEUES.REVIEWS_SYNC}`) private readonly reviewsSyncQueue: Queue,
    @Inject(`QUEUE_${QUEUES.RATING_REFRESH}`) private readonly ratingRefreshQueue: Queue,
      @Inject(`QUEUE_${QUEUES.MENTIONS_SYNC}`) private readonly mentionsSyncQueue: Queue
  ) {}

  private normalize(value?: string | null) {
    return value?.trim().toLowerCase() || null
  }

  private normalizeKeywords(values?: string[] | null) {
    if (!Array.isArray(values)) return []

    const seen = new Set<string>()

    return values
      .map((value) => value?.trim().replace(/\s+/g, ' '))
      .filter((value): value is string => Boolean(value))
      .filter((value) => {
        const normalized = this.normalize(value)
        if (!normalized || seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })
      .slice(0, 20)
  }

  private async syncCompanyKeywords(companyId: string, keywords?: string[] | null) {
    if (keywords === undefined) return

    const normalizedKeywords = this.normalizeKeywords(keywords)

    await this.prisma.companyAlias.deleteMany({
      where: { companyId }
    })

    if (!normalizedKeywords.length) return

    await this.prisma.companyAlias.createMany({
      data: normalizedKeywords.map((value, index) => ({
        companyId,
        value,
        normalizedValue: this.normalize(value) || value.toLowerCase(),
        priority: 100 + index,
        isPrimary: index === 0
      })),
      skipDuplicates: true
    })
  }

  private normalizeYandexUrl(value?: string | null) {
    const trimmed = value?.trim()
    if (!trimmed) return null

    const match = trimmed.match(/https?:\/\/yandex\.ru\/maps\/org\/[^/?#]+\/\d+/i)

    if (match?.[0]) {
      return match[0].replace(/\/$/, '') + '/reviews/'
    }

    return trimmed
  }

  private normalizeTwoGisUrl(value?: string | null) {
    const trimmed = value?.trim()
    if (!trimmed) return null

    try {
      const parsed = new URL(trimmed)
      const host = parsed.hostname.toLowerCase()

      if (!host.endsWith('2gis.ru')) {
        return trimmed
      }

      const parts = parsed.pathname.split('/').filter(Boolean)
      const city = parts[0] || 'moscow'
      const firmIndex = parts.findIndex((part) => part === 'firm')
      const firmId = firmIndex >= 0 ? parts[firmIndex + 1] : null

      if (!firmId || !/^\d+$/.test(firmId)) {
        return trimmed
      }

      const normalized = new URL(`https://2gis.ru/${city}/firm/${firmId}/tab/reviews`)
      const mapPosition = parsed.searchParams.get('m')

      if (mapPosition) {
        normalized.searchParams.set('m', mapPosition)
      }

      return normalized.toString()
    } catch {
      const match = trimmed.match(/https?:\/\/2gis\.ru\/([^/?#]+).*?\/firm\/(\d+)/i)

      if (match?.[1] && match?.[2]) {
        return `https://2gis.ru/${match[1]}/firm/${match[2]}/tab/reviews`
      }

      return trimmed
    }
  }

  private toInputJson(value?: Record<string, unknown>) {
    return value as Prisma.InputJsonValue | undefined
  }

  private async assertWorkspaceAccess(
    userId: string,
    workspaceId: string,
    access: 'read' | 'write' = 'read'
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true, isActive: true }
    })

    if (user?.isActive && user.systemRole === 'SUPER_ADMIN') {
      return { role: 'OWNER' as const }
    }

    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId }
    })

    if (!member) {
      throw new ForbiddenException('No access to workspace')
    }

    if (
      access === 'write' &&
      member.role !== 'OWNER' &&
      member.role !== 'ADMIN'
    ) {
      throw new ForbiddenException('No write access to workspace')
    }

    return member
  }

  private async ensureTwoGisSource(workspaceId: string) {
    let twoGisSource = await this.prisma.source.findFirst({
      where: {
        workspaceId,
        platform: 'TWOGIS',
        isEnabled: true
      },
      orderBy: { createdAt: 'asc' }
    })

    if (twoGisSource) {
      this.logger.log(`[TwoGisInit] existing source found workspaceId=${workspaceId} sourceId=${twoGisSource.id}`)
      return twoGisSource
    }

    twoGisSource = await this.prisma.source.create({
      data: {
        workspaceId,
        name: '2GIS',
        platform: 'TWOGIS',
        type: 'REVIEW_FEED',
        baseUrl: 'https://2gis.ru/',
        isEnabled: true
      }
    })

    this.logger.log(`[TwoGisInit] source created workspaceId=${workspaceId} sourceId=${twoGisSource.id}`)
    return twoGisSource
  }

  private async ensureWebSource(workspaceId: string) {
    let webSource = await this.prisma.source.findFirst({
      where: {
        workspaceId,
        platform: 'WEB',
        isEnabled: true
      },
      orderBy: { createdAt: 'asc' }
    })

    if (webSource) {
      this.logger.log(`[WebInit] existing source found workspaceId=${workspaceId} sourceId=${webSource.id}`)
      return webSource
    }

    webSource = await this.prisma.source.create({
      data: {
        workspaceId,
        name: 'Web mentions',
        platform: 'WEB',
        type: 'WEB_MENTION_FEED',
        baseUrl: 'https://duckduckgo.com/',
        isEnabled: true
      }
    })

    this.logger.log(`[WebInit] source created workspaceId=${workspaceId} sourceId=${webSource.id}`)
    return webSource
  }

  private async ensureYandexSource(workspaceId: string) {
    let yandexSource = await this.prisma.source.findFirst({
      where: {
        workspaceId,
        platform: 'YANDEX',
        isEnabled: true
      },
      orderBy: { createdAt: 'asc' }
    })

    if (yandexSource) {
      this.logger.log(`[YandexInit] existing source found workspaceId=${workspaceId} sourceId=${yandexSource.id}`)
      return yandexSource
    }

    yandexSource = await this.prisma.source.create({
      data: {
        workspaceId,
        name: 'Yandex Maps',
        platform: 'YANDEX',
        type: 'REVIEW_FEED',
        baseUrl: 'https://yandex.ru/maps/',
        isEnabled: true
      }
    })

    this.logger.log(`[YandexInit] source created workspaceId=${workspaceId} sourceId=${yandexSource.id}`)
    return yandexSource
  }

  private getYandexReviewsRepeatOptions() {
    return { every: 10 * 60 * 1000 }
  }

  private getYandexReviewsRepeatJobId(companyId: string) {
    return `reviews-sync:${companyId}`
  }

  private async ensureYandexReviewsRepeat(companyId: string) {
    await this.reviewsSyncQueue.add(
      JOBS.REVIEWS_SYNC,
      { companyId, autoCron: true },
      {
          ...CRON_JOB_OPTIONS,
          repeat: this.getYandexReviewsRepeatOptions(),
          jobId: this.getYandexReviewsRepeatJobId(companyId)
        }
    )

    this.logger.log(`[YandexCron] repeat reviews.sync ensured companyId=${companyId}`)
  }

  private async removeYandexReviewsRepeat(companyId: string) {
    const repeatables = await this.reviewsSyncQueue.getRepeatableJobs()
    const jobId = this.getYandexReviewsRepeatJobId(companyId)

    for (const job of repeatables) {
      const isTargetJob =
        job.name === JOBS.REVIEWS_SYNC &&
        (job.id === jobId || job.key.includes(jobId) || job.key.includes(companyId))

      if (isTargetJob) {
        await this.reviewsSyncQueue.removeRepeatableByKey(job.key)
        this.logger.log(`[YandexCron] repeat reviews.sync removed companyId=${companyId} key=${job.key}`)
      }
    }
  }

  private async hasEnabledReviewTargets(companyId: string) {
    const count = await this.prisma.companySourceTarget.count({
      where: {
        companyId,
        isActive: true,
        syncReviewsEnabled: true,
        AND: [
          { externalUrl: { not: null } },
          { externalUrl: { not: '' } }
        ],
        source: {
          platform: { in: ['YANDEX', 'TWOGIS'] },
          isEnabled: true
        }
      }
    })

    return count > 0
  }

  private async refreshReviewsRepeat(companyId: string) {
    if (await this.hasEnabledReviewTargets(companyId)) {
      await this.ensureYandexReviewsRepeat(companyId)
      this.logger.log(`[ReviewsCron] repeat reviews.sync enabled companyId=${companyId}`)
      return
    }

    await this.removeYandexReviewsRepeat(companyId)
    this.logger.log(`[ReviewsCron] repeat reviews.sync disabled companyId=${companyId}`)
  }

  private getWebMentionsRepeatJobId(companyId: string) {
    return `web-mentions-sync:${companyId}`
  }

  private normalizeWebScanIntervalMinutes(value: unknown) {
    const minutes = Number(value)

    if (minutes === 240 || minutes === 720 || minutes === 1440) {
      return minutes
    }

    return 1440
  }

  private async getWebMentionsRepeatEveryMs(companyId: string) {
    const targets = await this.prisma.companySourceTarget.findMany({
      where: {
        companyId,
        isActive: true,
        syncMentionsEnabled: true,
        AND: [
          { externalUrl: { not: null } },
          { externalUrl: { not: '' } }
        ],
        source: {
          platform: 'WEB',
          isEnabled: true
        }
      },
      select: {
        config: true
      }
    })

    if (!targets.length) return null

    const minutes = targets
      .map((target) => {
        const config = target.config as Record<string, unknown> | null
        return this.normalizeWebScanIntervalMinutes(
          config?.scanIntervalMinutes || Number(config?.scanIntervalHours || 24) * 60
        )
      })
      .sort((a, b) => a - b)[0]

    return minutes * 60 * 1000
  }

  private async removeWebMentionsRepeat(companyId: string) {
    const repeatables = await this.mentionsSyncQueue.getRepeatableJobs()
    const jobId = this.getWebMentionsRepeatJobId(companyId)

    for (const job of repeatables) {
      const isTargetJob =
        job.name === JOBS.MENTIONS_SYNC &&
        (job.id === jobId || job.key.includes(jobId) || job.key.includes(companyId))

      if (!isTargetJob) continue

      await this.mentionsSyncQueue.removeRepeatableByKey(job.key)
      this.logger.log(
        `[WebCron] repeat mentions.sync removed companyId=${companyId} key=${job.key} every=${job.every || 'unknown'}`
      )
    }
  }

  private async refreshWebMentionsRepeat(companyId: string) {
    const every = await this.getWebMentionsRepeatEveryMs(companyId)

    await this.removeWebMentionsRepeat(companyId)

    if (!every) {
      this.logger.log(`[WebCron] repeat mentions.sync skipped companyId=${companyId} reason=no_enabled_web_targets`)
      return
    }

    await this.mentionsSyncQueue.add(
      JOBS.MENTIONS_SYNC,
      { companyId, autoCron: true, scope: 'WEB' },
      {
          ...CRON_JOB_OPTIONS,
          repeat: { every },
          jobId: this.getWebMentionsRepeatJobId(companyId)
        }
    )

    this.logger.log(`[WebCron] repeat mentions.sync ensured companyId=${companyId} everyMinutes=${Math.round(every / 60000)}`)
  }

  private async enqueueAutoSyncJobs(params: {
    companyId: string
    userId: string
    requestedAt: string
  }) {
    const { companyId, userId, requestedAt } = params

    try {
      this.logger.log(`[YandexInit] enqueue reviews.sync start companyId=${companyId}`)

      const reviewsJob = await this.reviewsSyncQueue.add(
        JOBS.REVIEWS_SYNC,
        {
          companyId,
          triggeredByUserId: userId,
          requestedAt,
          autoStart: true
        },
        SYNC_JOB_OPTIONS
      )

      await this.prisma.jobLog.create({
        data: {
          companyId,
          triggeredByUserId: userId,
          queueName: QUEUES.REVIEWS_SYNC,
          jobName: JOBS.REVIEWS_SYNC,
          jobStatus: 'PENDING',
          result: {
            bullJobId: String(reviewsJob.id),
            requestedAt,
            autoStart: true
          } as Prisma.InputJsonValue
        }
      })

      this.logger.log(`[YandexInit] enqueue reviews.sync success companyId=${companyId} bullJobId=${String(reviewsJob.id)}`)
    } catch (error) {
      this.logger.error(
        `[YandexInit] enqueue reviews.sync failed companyId=${companyId}`,
        error instanceof Error ? error.stack : String(error)
      )
    }

    try {
      this.logger.log(`[YandexInit] enqueue rating.refresh start companyId=${companyId}`)

      const ratingJob = await this.ratingRefreshQueue.add(
        JOBS.RATING_REFRESH,
        {
          companyId,
          triggeredByUserId: userId,
          requestedAt,
          autoStart: true
        },
        SYNC_JOB_OPTIONS
      )

      await this.prisma.jobLog.create({
        data: {
          companyId,
          triggeredByUserId: userId,
          queueName: QUEUES.RATING_REFRESH,
          jobName: JOBS.RATING_REFRESH,
          jobStatus: 'PENDING',
          result: {
            bullJobId: String(ratingJob.id),
            requestedAt,
            autoStart: true
          } as Prisma.InputJsonValue
        }
      })

      this.logger.log(`[YandexInit] enqueue rating.refresh success companyId=${companyId} bullJobId=${String(ratingJob.id)}`)
    } catch (error) {
      this.logger.error(
        `[YandexInit] enqueue rating.refresh failed companyId=${companyId}`,
        error instanceof Error ? error.stack : String(error)
      )
    }

  }

  private async enqueueInitialWebScan(params: { companyId: string; userId: string; requestedAt: string }) {
    const { companyId, userId, requestedAt } = params

    try {
      this.logger.log(`[WebInit] enqueue mentions.sync start companyId=${companyId}`)

      const mentionsJob = await this.mentionsSyncQueue.add(
        JOBS.MENTIONS_SYNC,
        {
          companyId,
          triggeredByUserId: userId,
          requestedAt,
          scope: 'WEB',
          autoStart: true
        },
        SYNC_JOB_OPTIONS
      )

      await this.prisma.jobLog.create({
        data: {
          companyId,
          triggeredByUserId: userId,
          queueName: QUEUES.MENTIONS_SYNC,
          jobName: JOBS.MENTIONS_SYNC,
          jobStatus: 'PENDING',
          result: {
            bullJobId: String(mentionsJob.id),
            requestedAt,
            scope: 'WEB',
            autoStart: true
          } as Prisma.InputJsonValue
        }
      })

      this.logger.log(`[WebInit] enqueue mentions.sync success companyId=${companyId} bullJobId=${String(mentionsJob.id)}`)
    } catch (error) {
      this.logger.error(
        `[WebInit] enqueue mentions.sync failed companyId=${companyId}`,
        error instanceof Error ? error.stack : String(error)
      )
    }

    await this.refreshWebMentionsRepeat(companyId)
  }

  async findAll(userId: string) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true }
    })

    const companies = await this.prisma.company.findMany({
      where: currentUser?.systemRole === 'SUPER_ADMIN'
        ? {}
        : { workspace: { members: { some: { userId } } } },
      include: {
        aliases: true,
        sourceTargets: true,
        workspace: {
          include: {
            members: {
              where: { role: 'OWNER' },
              take: 1,
              include: {
                user: {
                  select: { id: true, email: true, fullName: true }
                }
              }
            }
          }
        },
        _count: { select: { mentions: true, ratingSnapshots: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    return companies
  }

  async create(userId: string, dto: CreateCompanyDto) {
    await this.assertWorkspaceAccess(userId, dto.workspaceId, 'write')

    const companiesCount = await this.prisma.company.count({
      where: { workspaceId: dto.workspaceId }
    })

    const { limits, workspaceActive } = await this.entitlements.getForWorkspace(dto.workspaceId)

    if (!workspaceActive) {
      throw new ForbiddenException('Workspace is disabled')
    }

    const maxCompanies = Number(limits.maxCompanies)

    if (maxCompanies >= 0 && companiesCount >= maxCompanies) {
      throw new ForbiddenException({ code: 'PLAN_LIMIT', feature: 'maxCompanies', limit: maxCompanies })
    }

    this.logger.log(
      `[CompanyCreate] start workspaceId=${dto.workspaceId} name="${dto.name}" yandexUrl="${dto.yandexUrl?.trim() || ''}"`
    )

    const company = await this.prisma.company.create({
      data: {
        workspaceId: dto.workspaceId,
        name: dto.name,
        normalizedName: this.normalize(dto.name) || '',
        website: dto.website,
        normalizedWebsite: this.normalize(dto.website),
        city: dto.city,
        normalizedCity: this.normalize(dto.city),
        industry: dto.industry
      }
    })

    await this.syncCompanyKeywords(company.id, dto.keywords)

    const normalizedYandexUrl = this.normalizeYandexUrl(dto.yandexUrl)
    const normalizedTwoGisUrl = this.normalizeTwoGisUrl(dto.twoGisUrl)

    const allowedPlatforms = Array.isArray(limits.platforms) ? limits.platforms : []

    if (normalizedYandexUrl && !allowedPlatforms.includes('YANDEX')) {
      this.logger.log(`[CompanyCreate] skip yandex init companyId=${company.id} reason=platform_not_allowed`)
    } else if (normalizedYandexUrl) {
      const yandexSource = await this.ensureYandexSource(dto.workspaceId)

      const target = await this.prisma.companySourceTarget.create({
        data: {
          companyId: company.id,
          sourceId: yandexSource.id,
          externalUrl: normalizedYandexUrl,
          syncReviewsEnabled: true,
          syncRatingsEnabled: true,
          syncMentionsEnabled: true
        }
      })

      this.logger.log(
        `[YandexInit] target created companyId=${company.id} targetId=${target.id} sourceId=${yandexSource.id} url="${normalizedYandexUrl}"`
      )

      await this.enqueueAutoSyncJobs({
        companyId: company.id,
        userId,
        requestedAt: new Date().toISOString()
      })
    } else {
      this.logger.log(`[CompanyCreate] skip yandex init companyId=${company.id} reason=no_yandex_url`)
    }

    if (normalizedTwoGisUrl && !allowedPlatforms.includes('TWOGIS')) {
      this.logger.log(`[CompanyCreate] skip 2gis init companyId=${company.id} reason=platform_not_allowed`)
    } else if (normalizedTwoGisUrl) {
      const twoGisSource = await this.ensureTwoGisSource(dto.workspaceId)

      const target = await this.prisma.companySourceTarget.create({
        data: {
          companyId: company.id,
          sourceId: twoGisSource.id,
          externalUrl: normalizedTwoGisUrl,
          syncReviewsEnabled: true,
          syncRatingsEnabled: true,
          syncMentionsEnabled: true
        }
      })

      this.logger.log(
        `[TwoGisInit] target created companyId=${company.id} targetId=${target.id} sourceId=${twoGisSource.id} url="${normalizedTwoGisUrl}"`
      )

      await this.enqueueAutoSyncJobs({
        companyId: company.id,
        userId,
        requestedAt: new Date().toISOString()
      })

      await this.ensureYandexReviewsRepeat(company.id)
    } else {
      this.logger.log(`[CompanyCreate] skip 2gis init companyId=${company.id} reason=no_two_gis_url`)
    }

    if (allowedPlatforms.includes('WEB') && limits.webMonitoringEnabled) {
      const webSource = await this.ensureWebSource(dto.workspaceId)
      const existingWebTarget = await this.prisma.companySourceTarget.findFirst({
        where: { companyId: company.id, sourceId: webSource.id, externalUrl: null }
      })
      if (!existingWebTarget) {
        await this.prisma.companySourceTarget.create({
          data: {
            companyId: company.id,
            sourceId: webSource.id,
            syncMentionsEnabled: true,
            isActive: true
          }
        })
        this.logger.log(`[WebInit] root target created companyId=${company.id}`)
      }

      await this.enqueueInitialWebScan({
        companyId: company.id,
        userId,
        requestedAt: new Date().toISOString()
      })
    }

    return company
  }

  async findOne(userId: string, id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        aliases: true,
        sourceTargets: { include: { source: true } },
        _count: { select: { mentions: true, ratingSnapshots: true } }
      }
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId, 'read')

    return company
  }

  async update(userId: string, id: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id } })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId, 'write')

    const updatedCompany = await this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.name !== undefined
          ? { name: dto.name, normalizedName: this.normalize(dto.name) || '' }
          : {}),
        ...(dto.website !== undefined
          ? { website: dto.website, normalizedWebsite: this.normalize(dto.website) }
          : {}),
        ...(dto.city !== undefined
          ? { city: dto.city, normalizedCity: this.normalize(dto.city) }
          : {}),
        ...(dto.industry !== undefined ? { industry: dto.industry } : {})
      }
    })

    await this.syncCompanyKeywords(id, dto.keywords)

    if (dto.twoGisUrl !== undefined) {
      const normalizedTwoGisUrl = this.normalizeTwoGisUrl(dto.twoGisUrl)

      const twoGisSource = normalizedTwoGisUrl
        ? await this.ensureTwoGisSource(company.workspaceId)
        : await this.prisma.source.findFirst({
            where: {
              workspaceId: company.workspaceId,
              platform: 'TWOGIS',
              isEnabled: true
            },
            orderBy: { createdAt: 'asc' }
          })

      if (twoGisSource) {
        const existingTarget = await this.prisma.companySourceTarget.findFirst({
          where: {
            companyId: id,
            sourceId: twoGisSource.id
          },
          orderBy: { createdAt: 'asc' }
        })

        if (normalizedTwoGisUrl) {
          if (existingTarget) {
            await this.prisma.companySourceTarget.update({
              where: { id: existingTarget.id },
              data: {
                externalUrl: normalizedTwoGisUrl,
                isActive: true,
                syncReviewsEnabled: true,
                syncRatingsEnabled: true,
                syncMentionsEnabled: true
              }
            })

            this.logger.log(`[TwoGisInit] target updated companyId=${id} targetId=${existingTarget.id}`)
          } else {
            const target = await this.prisma.companySourceTarget.create({
              data: {
                companyId: id,
                sourceId: twoGisSource.id,
                externalUrl: normalizedTwoGisUrl,
                syncReviewsEnabled: true,
                syncRatingsEnabled: true,
                syncMentionsEnabled: true
              }
            })

            this.logger.log(`[TwoGisInit] target created via update companyId=${id} targetId=${target.id}`)
          }

          await this.enqueueAutoSyncJobs({
            companyId: id,
            userId,
            requestedAt: new Date().toISOString()
          })

          await this.ensureYandexReviewsRepeat(id)
        } else if (existingTarget) {
          await this.prisma.companySourceTarget.update({
            where: { id: existingTarget.id },
            data: { externalUrl: null }
          })

          this.logger.log(`[TwoGisInit] target url cleared companyId=${id} targetId=${existingTarget.id}`)
        }
      }
    }

    if (dto.yandexUrl !== undefined) {
      const normalizedYandexUrl = this.normalizeYandexUrl(dto.yandexUrl)

      if (normalizedYandexUrl) {
        const yandexSource = await this.ensureYandexSource(company.workspaceId)

        const existingTarget = await this.prisma.companySourceTarget.findFirst({
          where: {
            companyId: id,
            sourceId: yandexSource.id
          },
          orderBy: { createdAt: 'asc' }
        })

        if (existingTarget) {
          await this.prisma.companySourceTarget.update({
            where: { id: existingTarget.id },
            data: {
              externalUrl: normalizedYandexUrl,
              isActive: true,
              syncReviewsEnabled: true,
              syncRatingsEnabled: true,
              syncMentionsEnabled: true
            }
          })

          this.logger.log(
            `[YandexInit] target updated companyId=${id} targetId=${existingTarget.id} sourceId=${yandexSource.id} url="${normalizedYandexUrl}"`
          )
        } else {
          const target = await this.prisma.companySourceTarget.create({
            data: {
              companyId: id,
              sourceId: yandexSource.id,
              externalUrl: normalizedYandexUrl,
              syncReviewsEnabled: true,
              syncRatingsEnabled: true,
              syncMentionsEnabled: true
            }
          })

          this.logger.log(
            `[YandexInit] target created via update companyId=${id} targetId=${target.id} sourceId=${yandexSource.id} url="${normalizedYandexUrl}"`
          )
        }

        await this.enqueueAutoSyncJobs({
          companyId: id,
          userId,
          requestedAt: new Date().toISOString()
        })
      } else {
        const yandexSource = await this.prisma.source.findFirst({
          where: {
            workspaceId: company.workspaceId,
            platform: 'YANDEX',
            isEnabled: true
          },
          orderBy: { createdAt: 'asc' }
        })

        if (yandexSource) {
          const existingTarget = await this.prisma.companySourceTarget.findFirst({
            where: {
              companyId: id,
              sourceId: yandexSource.id
            },
            orderBy: { createdAt: 'asc' }
          })

          if (existingTarget) {
            await this.prisma.companySourceTarget.update({
              where: { id: existingTarget.id },
              data: {
                externalUrl: null
              }
            })

            this.logger.log(`[YandexInit] target url cleared companyId=${id} targetId=${existingTarget.id}`)
          }
        }
      }
    }

    return updatedCompany
  }

  async remove(userId: string, id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId, 'write')

    await this.prisma.aIReplyDraft.deleteMany({ where: { companyId: id } })
    await this.prisma.watchedPageItem.deleteMany({ where: { companyId: id } })
    await this.prisma.watchedPage.deleteMany({ where: { companyId: id } })
    await this.prisma.mention.deleteMany({ where: { companyId: id } })
    await this.prisma.ratingSnapshot.deleteMany({ where: { companyId: id } })
    await this.prisma.companySourceTarget.deleteMany({ where: { companyId: id } })
    await this.prisma.companyAlias.deleteMany({ where: { companyId: id } })

    return this.prisma.company.delete({
      where: { id }
    })
  }

  async createAlias(userId: string, companyId: string, dto: CreateCompanyAliasDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId, 'write')

    return this.prisma.companyAlias.create({
      data: {
        companyId,
        value: dto.value,
        normalizedValue: this.normalize(dto.value) || '',
        priority: dto.priority ?? 100,
        isPrimary: dto.isPrimary ?? false
      }
    })
  }

  async deleteAlias(userId: string, companyId: string, aliasId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId, 'write')

    return this.prisma.companyAlias.delete({
      where: { id: aliasId }
    })
  }

  async getSources(userId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId)

    const targets = await this.prisma.companySourceTarget.findMany({
      where: { companyId },
      include: {
        source: true,
        _count: {
          select: { mentions: true }
        },
        mentions: {
          orderBy: { publishedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            title: true,
            url: true,
            publishedAt: true,
            createdAt: true
          }
        },
        watchedPages: {
          take: 1,
          select: {
            id: true,
            pageType: true,
            lastCheckedAt: true,
            lastChangedAt: true,
            lastError: true,
            enabled: true,
            checkIntervalMin: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const getConfig = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, unknown>
      return value as Record<string, unknown>
    }

    const hostFromUrl = (value?: string | null) => {
      if (!value) return ''
      try {
        return new URL(value.startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./, '').toLowerCase()
      } catch {
        return value.toLowerCase()
      }
    }

    const sourceKind = (target: (typeof targets)[number]) => {
      const haystack = `${target.displayName || ''} ${target.externalUrl || ''}`.toLowerCase()
      const host = hostFromUrl(target.externalUrl)

      if (haystack.includes('otzovik') || haystack.includes('irecommend') || haystack.includes('отзов')) return 'Отзовик'
      if (haystack.includes('catalog') || haystack.includes('справочник') || haystack.includes('каталог') || haystack.includes('yell') || haystack.includes('zoon')) return 'Каталог'
      if (haystack.includes('article') || haystack.includes('news') || haystack.includes('blog') || haystack.includes('статья')) return 'Статья'
      if (company.normalizedWebsite && host.includes(company.normalizedWebsite)) return 'Сайт'
      if (company.website && host === hostFromUrl(company.website)) return 'Сайт'

      return 'Другое'
    }

    const relevanceReasons = (target: (typeof targets)[number]) => {
      const config = getConfig(target.config)
      const reasons: string[] = []
      const haystack = `${target.displayName || ''} ${target.externalUrl || ''}`.toLowerCase()
      const host = hostFromUrl(target.externalUrl)
      const brand = company.normalizedName || company.name.toLowerCase()
      const city = company.normalizedCity || company.city?.toLowerCase() || ''
      const websiteHost = hostFromUrl(company.website)

      const hasBrand = Boolean(brand && brand.length >= 3 && haystack.includes(brand))
      const hasCity = Boolean(city && haystack.includes(city))
      const hasReviewIntent = haystack.includes('отзывы') || haystack.includes('review') || haystack.includes('reviews')
      const hasWebsiteMatch = Boolean(websiteHost && host.includes(websiteHost))
      const hasStrongConfigSignal =
        Array.isArray(config.relevanceReasons) &&
        config.relevanceReasons.some((item) => {
          if (typeof item !== 'string') return false
          const normalized = item.toLowerCase()
          return (
            normalized.includes('название') ||
            normalized.includes('домен') ||
            normalized.includes('сайт') ||
            normalized.includes('телефон') ||
            normalized.includes('адрес') ||
            normalized.includes('точное')
          )
        })

      if (hasWebsiteMatch) reasons.push('совпал домен/бренд')
      if (hasBrand) reasons.push('совпало название компании')
      if (hasBrand && hasCity) reasons.push('найден город')
      if ((hasBrand || hasWebsiteMatch) && hasReviewIntent) reasons.push('найдено слово “отзывы”')
      if (!hasBrand && !hasWebsiteMatch && hasStrongConfigSignal) reasons.push('есть сильный сигнал релевантности')

      return Array.from(new Set(reasons))
    }

    const statusForTarget = (target: (typeof targets)[number]) => {
      const config = getConfig(target.config)

      if (config.lastError) return 'ERROR'
      if (config.status === 'EXCLUDED' || config.excluded === true) return 'EXCLUDED'
      if (target.isActive && target.syncMentionsEnabled) return 'MONITORED'
      if (config.status === 'NEEDS_REVIEW') return 'NEEDS_REVIEW'
      if (config.origin === 'auto' && !target.isActive) return 'DISCOVERED'

      return target.isActive ? 'MONITORED' : 'NEEDS_REVIEW'
    }

    const relevanceForTarget = (target: (typeof targets)[number]) => {
      const config = getConfig(target.config)
      const explicitScore = Number(config.relevanceScore)
      const reasons = relevanceReasons(target)
      const hasStrongReason = reasons.some((reason) =>
        reason.includes('название') || reason.includes('домен') || reason.includes('сайт') || reason.includes('сильный')
      )

      const computedScore = hasStrongReason ? Math.min(100, 45 + reasons.length * 18) : 25
      const score = Number.isFinite(explicitScore)
        ? hasStrongReason
          ? Math.max(computedScore, Math.min(explicitScore, 85))
          : Math.min(explicitScore, 35)
        : computedScore

      if (score >= 75) return { score, label: 'высокая' }
      if (score >= 50) return { score, label: 'средняя' }
      return { score, label: 'низкая' }
    }

    return targets.map((target) => {
      const relevance = relevanceForTarget(target)
      const lastMention = target.mentions[0] || null

      return {
        ...target,
        status: statusForTarget(target),
        sourceKind: sourceKind(target),
        mentionsCount: target._count.mentions,
        lastMention,
        lastMentionAt: lastMention?.publishedAt || null,
        relevanceScore: relevance.score,
        relevanceLabel: relevance.label,
        relevanceReasons: relevanceReasons(target),
        watchedPage: target.watchedPages?.[0] || null
      }
    })
  }

  private webSourceHost(value?: string | null) {
    if (!value) return null

    try {
      const parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
      return parsed.hostname.toLowerCase().replace(/^www\./, '')
    } catch {
      return null
    }
  }

  private isMapOrReviewPlatformUrl(value?: string | null) {
    if (!value) return false

    try {
      const parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
      const path = parsed.pathname.toLowerCase()

      return (
        host === '2gis.ru' ||
        host.endsWith('.2gis.ru') ||
        ((host === 'yandex.ru' || host.endsWith('.yandex.ru') || host === 'yandex.com' || host.endsWith('.yandex.com')) &&
          path.startsWith('/maps'))
      )
    } catch {
      const normalized = value.toLowerCase()
      return normalized.includes('2gis.ru') || normalized.includes('yandex.ru/maps') || normalized.includes('yandex.com/maps')
    }
  }

  async getWebSourcesOverview(userId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId)

    const targets = await this.getSources(userId, companyId)
    const webTargets = targets.filter((target: any) => {
      if (target.source?.platform !== 'WEB') return false
      if (this.isMapOrReviewPlatformUrl(target.externalUrl)) return false
      return true
    })

    const activeTargets = webTargets.filter((target: any) => {
      if (!target.externalUrl) return false
      return target.isActive !== false && target.syncMentionsEnabled !== false
    })

    const discoveredTargets = webTargets.filter((target: any) => {
      const config = target.config && typeof target.config === 'object' && !Array.isArray(target.config)
        ? target.config as Record<string, any>
        : {}

      if (target.isActive !== false && target.syncMentionsEnabled !== false) return false
      if (config.status === 'EXCLUDED' || config.excluded === true) return false

      return config.origin === 'auto' || config.origin === 'auto-bootstrap' || config.origin === 'auto-bootstrap-backfill' || target.isActive === false
    })

    const activeByHost = new Map<string, any[]>()

    for (const target of activeTargets) {
      const host = this.webSourceHost(target.externalUrl) || 'unknown'
      const items = activeByHost.get(host) || []
      items.push(target)
      activeByHost.set(host, items)
    }

    const activeGroups = Array.from(activeByHost.entries()).map(([host, items]) => {
      const mentionsCount = items.reduce((sum, item) => sum + Number(item.mentionsCount || 0), 0)
      const lastMentionAt = items
        .map((item) => item.lastMentionAt || item.lastMention?.publishedAt || item.lastMention?.createdAt || null)
        .filter(Boolean)
        .sort()
        .reverse()[0] || null

      const primary = items
        .slice()
        .sort((a, b) => Number(b.mentionsCount || 0) - Number(a.mentionsCount || 0))[0]

      return {
        host,
        pagesCount: items.length,
        mentionsCount,
        lastMentionAt,
        primary,
        items
      }
    }).sort((a, b) => {
      const byMentions = Number(b.mentionsCount || 0) - Number(a.mentionsCount || 0)
      if (byMentions !== 0) return byMentions
      return String(a.host).localeCompare(String(b.host))
    })

    const discoveredByHost = new Map<string, any[]>()
    for (const target of discoveredTargets.filter((t: any) => Boolean(t.externalUrl))) {
      const host = this.webSourceHost(target.externalUrl) || 'unknown'
      const items = discoveredByHost.get(host) || []
      items.push(target)
      discoveredByHost.set(host, items)
    }

    const discovered = Array.from(discoveredByHost.entries()).map(([host, items]) => {
      const best = items.slice().sort((a: any, b: any) =>
        Number(b.relevanceScore || 0) - Number(a.relevanceScore || 0)
      )[0]
      return {
        ...best,
        host,
        items,
        pagesCount: items.length,
        bestUrl: best.externalUrl,
        bestTitle: best.displayName || best.externalUrl || host
      }
    }).sort((a: any, b: any) => {
      const byRelevance = Number(b.relevanceScore || 0) - Number(a.relevanceScore || 0)
      if (byRelevance !== 0) return byRelevance
      return String(a.host).localeCompare(String(b.host))
    })

    const latestSignals = await this.prisma.mention.findMany({
      where: {
        companyId,
        platform: 'WEB',
        isRelevant: true
      },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: {
        id: true,
        title: true,
        content: true,
        url: true,
        publishedAt: true,
        createdAt: true,
        platform: true,
        type: true
      }
    })

    return {
      summary: {
        activeGroupsCount: activeGroups.length,
        activeTargetsCount: activeTargets.length,
        discoveredCount: discovered.length,
        latestSignalsCount: latestSignals.length
      },
      activeGroups,
      discovered: discovered.slice(0, 50),
      latestSignals
    }
  }


  async createSourceTarget(userId: string, companyId: string, dto: CreateCompanySourceTargetDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId, 'write')

    const targetPlatform = dto.platform || (dto.sourceId
      ? (await this.prisma.source.findUnique({ where: { id: dto.sourceId }, select: { platform: true } }))?.platform
      : null)

    const ent = await this.entitlements.getForWorkspace(company.workspaceId)

    if (!ent.workspaceActive) {
      throw new ForbiddenException('Workspace is disabled')
    }

    if (targetPlatform) {
      const allowedPlatforms = Array.isArray(ent.limits.platforms) ? ent.limits.platforms : []

      if (!allowedPlatforms.includes(targetPlatform)) {
        throw new ForbiddenException({ code: 'PLAN_LIMIT', feature: 'platforms', platform: targetPlatform })
      }
    }

    // maxSources enforcement
    const maxSources = Number(ent.limits.maxSources)
    if (maxSources >= 0) {
      const currentSourcesCount = await this.prisma.companySourceTarget.count({
        where: { company: { workspaceId: company.workspaceId }, isActive: true }
      })
      if (currentSourcesCount >= maxSources) {
        throw new ForbiddenException({ code: 'PLAN_LIMIT', feature: 'maxSources', limit: maxSources })
      }
    }

    let sourceId: string | null = dto.sourceId || null

    if (!sourceId && dto.platform) {
      const sourceType = dto.platform === 'WEB' ? 'WEB_MENTION_FEED' : 'CUSTOM_FEED'

      const source = await this.prisma.source.findFirst({
        where: {
          workspaceId: company.workspaceId,
          platform: dto.platform,
          type: sourceType
        },
        orderBy: { createdAt: 'asc' }
      })

      if (source) {
        sourceId = source.id
      } else {
        const createdSource = await this.prisma.source.create({
          data: {
            workspaceId: company.workspaceId,
            name: dto.platform === 'WEB' ? 'WEB mentions' : 'Custom mentions',
            platform: dto.platform,
            type: sourceType,
            baseUrl: dto.externalUrl || null,
            isEnabled: true
          }
        })

        sourceId = createdSource.id
      }
    }

    if (!sourceId) {
      throw new NotFoundException('Source not found')
    }

    const createdTarget = await this.prisma.companySourceTarget.create({
      data: {
        companyId,
        sourceId,
        externalPlaceId: dto.externalPlaceId,
        externalUrl: dto.externalUrl,
        displayName: dto.displayName,
        syncReviewsEnabled: dto.syncReviewsEnabled ?? false,
        syncRatingsEnabled: dto.syncRatingsEnabled ?? false,
        syncMentionsEnabled: dto.syncMentionsEnabled ?? true,
        ...(dto.config !== undefined ? { config: this.toInputJson(dto.config) } : {})
      },
      include: { source: true }
    })

    if (createdTarget.source?.platform === 'WEB') {
      await this.refreshWebMentionsRepeat(companyId)

      if (createdTarget.externalUrl) {
        try {
          const domain = new URL(createdTarget.externalUrl).hostname.replace(/^www\./, '')
          await this.prisma.watchedPage.upsert({
            where: { companyId_url: { companyId, url: createdTarget.externalUrl } },
            create: {
              companyId,
              sourceTargetId: createdTarget.id,
              url: createdTarget.externalUrl,
              domain,
              pageType: 'UNKNOWN',
              enabled: true,
              checkIntervalMin: 1440
            },
            update: {
              sourceTargetId: createdTarget.id,
              enabled: true
            }
          })
        } catch (e) {
          // ignore invalid URL
        }
      }
    }

    return createdTarget
  }

  async updateSourceTarget(userId: string, companyId: string, targetId: string, dto: UpdateCompanySourceTargetDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId, 'write')

    const target = await this.prisma.companySourceTarget.findUnique({
      where: { id: targetId },
      include: { source: true }
    })

    if (!target || target.companyId !== companyId) {
      throw new NotFoundException('Company source target not found')
    }

    // workspace.isActive + WEB platform guard when reactivating
    const updateEnt = await this.entitlements.getForWorkspace(company.workspaceId)

    if (!updateEnt.workspaceActive) {
      throw new ForbiddenException('Workspace is disabled')
    }

    if (dto.isActive === true && target.source?.platform === 'WEB' && !updateEnt.limits.webMonitoringEnabled) {
      throw new ForbiddenException({ code: 'PLAN_LIMIT', feature: 'webMonitoringEnabled' })
    }

    const updatedTarget = await this.prisma.companySourceTarget.update({
      where: { id: targetId },
      data: {
        ...(dto.externalPlaceId !== undefined ? { externalPlaceId: dto.externalPlaceId } : {}),
        ...(dto.externalUrl !== undefined
          ? {
              externalUrl:
                target.source?.platform === 'YANDEX'
                  ? this.normalizeYandexUrl(dto.externalUrl)
                  : target.source?.platform === 'TWOGIS'
                    ? this.normalizeTwoGisUrl(dto.externalUrl)
                    : dto.externalUrl
            }
          : {}),
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.syncReviewsEnabled !== undefined ? { syncReviewsEnabled: dto.syncReviewsEnabled } : {}),
        ...(dto.syncRatingsEnabled !== undefined ? { syncRatingsEnabled: dto.syncRatingsEnabled } : {}),
        ...(dto.syncMentionsEnabled !== undefined ? { syncMentionsEnabled: dto.syncMentionsEnabled } : {}),
        ...(dto.config !== undefined ? { config: this.toInputJson(dto.config) } : {})
      },
      include: { source: true }
    })

    if ((updatedTarget.source?.platform === 'YANDEX' || updatedTarget.source?.platform === 'TWOGIS') && dto.syncReviewsEnabled !== undefined) {
      await this.refreshReviewsRepeat(companyId)
      this.logger.log(`[ReviewsCron] repeat refreshed from source target update companyId=${companyId} targetId=${targetId} platform=${updatedTarget.source?.platform}`)
    }

    if (updatedTarget.source?.platform === 'WEB') {
      await this.refreshWebMentionsRepeat(companyId)

      const url = updatedTarget.externalUrl
      const isMonitored = updatedTarget.isActive && updatedTarget.syncMentionsEnabled
      if (url) {
        try {
          const domain = new URL(url).hostname.replace(/^www\./, '')
          if (isMonitored) {
            await this.prisma.watchedPage.upsert({
              where: { companyId_url: { companyId, url } },
              create: {
                companyId,
                sourceTargetId: updatedTarget.id,
                url,
                domain,
                pageType: 'UNKNOWN',
                enabled: true,
                checkIntervalMin: 1440
              },
              update: {
                sourceTargetId: updatedTarget.id,
                enabled: true
              }
            })
          } else {
            await this.prisma.watchedPage.updateMany({
              where: { companyId, url },
              data: { enabled: false }
            })
          }
        } catch (e) {
          // ignore invalid URL
        }
      }
    }

    return updatedTarget
  }

  async deleteSourceTarget(userId: string, companyId: string, targetId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId, 'write')

    const target = await this.prisma.companySourceTarget.findUnique({
      where: { id: targetId },
      include: { source: true }
    })

    if (!target || target.companyId !== companyId) {
      throw new NotFoundException('Company source target not found')
    }

    if (target.source?.platform === 'WEB' && target.externalUrl) {
      await this.prisma.watchedPage.deleteMany({
        where: { companyId, url: target.externalUrl }
      })
    }

    const deletedTarget = await this.prisma.companySourceTarget.delete({
      where: { id: targetId }
    })

    if (target.source?.platform === 'WEB') {
      await this.refreshWebMentionsRepeat(companyId)
    }

    return deletedTarget
  }
}

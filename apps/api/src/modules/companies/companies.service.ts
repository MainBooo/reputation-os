import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Queue } from 'bullmq'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { QUEUES } from '../../common/queues/queue.names'
import { JOBS } from '../../common/queues/job.names'
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
    @Inject(`QUEUE_${QUEUES.REVIEWS_SYNC}`) private readonly reviewsSyncQueue: Queue,
    @Inject(`QUEUE_${QUEUES.RATING_REFRESH}`) private readonly ratingRefreshQueue: Queue
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

  private async assertWorkspaceAccess(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId }
    })

    if (!member) {
      throw new ForbiddenException('No access to workspace')
    }
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
        {
          removeOnComplete: 1000,
          removeOnFail: false
        }
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
        {
          removeOnComplete: 1000,
          removeOnFail: false
        }
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

  async findAll(userId: string) {
    return this.prisma.company.findMany({
      where: { workspace: { members: { some: { userId } } } },
      include: {
        aliases: true,
        sourceTargets: true,
        _count: { select: { mentions: true, ratingSnapshots: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async create(userId: string, dto: CreateCompanyDto) {
    await this.assertWorkspaceAccess(userId, dto.workspaceId)

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

    if (normalizedYandexUrl) {
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

    if (normalizedTwoGisUrl) {
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

    await this.assertWorkspaceAccess(userId, company.workspaceId)
    return company
  }

  async update(userId: string, id: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id } })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId)

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

    await this.assertWorkspaceAccess(userId, company.workspaceId)

    await this.prisma.companyAlias.deleteMany({ where: { companyId: id } })
    await this.prisma.companySourceTarget.deleteMany({ where: { companyId: id } })
    await this.prisma.mention.deleteMany({ where: { companyId: id } })
    await this.prisma.ratingSnapshot.deleteMany({ where: { companyId: id } })

    return this.prisma.company.delete({
      where: { id }
    })
  }

  async createAlias(userId: string, companyId: string, dto: CreateCompanyAliasDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId)

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

    await this.assertWorkspaceAccess(userId, company.workspaceId)

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

    return this.prisma.companySourceTarget.findMany({
      where: { companyId },
      include: { source: true },
      orderBy: { createdAt: 'desc' }
    })
  }

  async createSourceTarget(userId: string, companyId: string, dto: CreateCompanySourceTargetDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId)

    return this.prisma.companySourceTarget.create({
      data: {
        companyId,
        sourceId: dto.sourceId,
        externalPlaceId: dto.externalPlaceId,
        externalUrl: dto.externalUrl,
        displayName: dto.displayName,
        syncReviewsEnabled: dto.syncReviewsEnabled ?? true,
        syncRatingsEnabled: dto.syncRatingsEnabled ?? true,
        syncMentionsEnabled: dto.syncMentionsEnabled ?? true,
        ...(dto.config !== undefined ? { config: this.toInputJson(dto.config) } : {})
      }
    })
  }

  async updateSourceTarget(userId: string, companyId: string, targetId: string, dto: UpdateCompanySourceTargetDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId)

    const target = await this.prisma.companySourceTarget.findUnique({
      where: { id: targetId },
      include: { source: true }
    })

    if (!target || target.companyId !== companyId) {
      throw new NotFoundException('Company source target not found')
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
                    : this.normalizeTwoGisUrl(dto.externalUrl)
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
      if (dto.syncReviewsEnabled && updatedTarget.isActive && updatedTarget.externalUrl) {
        await this.ensureYandexReviewsRepeat(companyId)
        this.logger.log(`[YandexCron] repeat ensured from source target update companyId=${companyId} targetId=${targetId}`)
      } else {
        await this.removeYandexReviewsRepeat(companyId)
        this.logger.log(`[YandexCron] repeat removed from source target update companyId=${companyId} targetId=${targetId}`)
      }
    }

    return updatedTarget
  }

  async deleteSourceTarget(userId: string, companyId: string, targetId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.assertWorkspaceAccess(userId, company.workspaceId)

    return this.prisma.companySourceTarget.delete({
      where: { id: targetId }
    })
  }
}

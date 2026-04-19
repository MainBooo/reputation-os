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

  private normalizeYandexUrl(value?: string | null) {
    const trimmed = value?.trim()
    if (!trimmed) return null

    const match = trimmed.match(/https?:\/\/yandex\.ru\/maps\/org\/[^/?#]+\/\d+/i)

    if (match?.[0]) {
      return match[0].replace(/\/$/, '') + '/reviews/'
    }

    return trimmed
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

    try {
      await this.reviewsSyncQueue.add(
        JOBS.REVIEWS_SYNC,
        { companyId },
        {
          repeat: { every: 6 * 60 * 60 * 1000 },
          jobId: `reviews-sync:${companyId}`
        }
      )

      this.logger.log(`[YandexInit] repeat reviews.sync ensured companyId=${companyId}`)
    } catch (error) {
      this.logger.error(
        `[YandexInit] repeat reviews.sync failed companyId=${companyId}`,
        error instanceof Error ? error.stack : String(error)
      )
    }

    try {
      await this.ratingRefreshQueue.add(
        JOBS.RATING_REFRESH,
        { companyId },
        {
          repeat: { every: 24 * 60 * 60 * 1000 },
          jobId: `rating-refresh:${companyId}`
        }
      )

      this.logger.log(`[YandexInit] repeat rating.refresh ensured companyId=${companyId}`)
    } catch (error) {
      this.logger.error(
        `[YandexInit] repeat rating.refresh failed companyId=${companyId}`,
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

    const normalizedYandexUrl = this.normalizeYandexUrl(dto.yandexUrl)

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
    await this.prisma.vkSearchProfile.deleteMany({ where: { companyId: id } })
    await this.prisma.vkTrackedCommunity.deleteMany({ where: { companyId: id } })
    await this.prisma.vkTrackedPost.deleteMany({ where: { companyId: id } })

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

    return this.prisma.companySourceTarget.update({
      where: { id: targetId },
      data: {
        ...(dto.externalPlaceId !== undefined ? { externalPlaceId: dto.externalPlaceId } : {}),
        ...(dto.externalUrl !== undefined ? { externalUrl: dto.externalUrl } : {}),
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.syncReviewsEnabled !== undefined ? { syncReviewsEnabled: dto.syncReviewsEnabled } : {}),
        ...(dto.syncRatingsEnabled !== undefined ? { syncRatingsEnabled: dto.syncRatingsEnabled } : {}),
        ...(dto.syncMentionsEnabled !== undefined ? { syncMentionsEnabled: dto.syncMentionsEnabled } : {}),
        ...(dto.config !== undefined ? { config: this.toInputJson(dto.config) } : {})
      }
    })
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

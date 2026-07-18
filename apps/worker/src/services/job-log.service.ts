import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'

type FinishJobLogParams = {
  companyId?: string | null
  queueName: string
  jobName: string
  bullJobId?: string | number | null
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL'
  startedAt?: Date | null
  finishedAt?: Date | null
  itemsDiscovered?: number | null
  itemsCreated?: number | null
  itemsUpdated?: number | null
  itemsDeduped?: number | null
  errorMessage?: string | null
  result?: Record<string, unknown> | null
}

@Injectable()
export class JobLogService {
  constructor(private readonly prisma: PrismaService) {}

  async finish(params: FinishJobLogParams) {
    const bullJobId = params.bullJobId === undefined || params.bullJobId === null
      ? null
      : String(params.bullJobId)

    const data = {
      jobStatus: params.status,
      startedAt: params.startedAt ?? undefined,
      finishedAt: params.finishedAt ?? new Date(),
      itemsDiscovered: params.itemsDiscovered ?? undefined,
      itemsCreated: params.itemsCreated ?? undefined,
      itemsUpdated: params.itemsUpdated ?? undefined,
      itemsDeduped: params.itemsDeduped ?? undefined,
      errorMessage: params.errorMessage ?? undefined,
      result: {
        ...(params.result || {}),
        ...(bullJobId ? { bullJobId } : {})
      }
    }

    if (bullJobId) {
      const existing = await this.prisma.jobLog.findFirst({
        where: {
          companyId: params.companyId || undefined,
          queueName: params.queueName,
          jobName: params.jobName,
          jobStatus: 'PENDING',
          result: {
            path: ['bullJobId'],
            equals: bullJobId
          }
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
      })

      if (existing) {
        return this.prisma.jobLog.update({
          where: { id: existing.id },
          data
        })
      }
    }

    return this.prisma.jobLog.create({
      data: {
        companyId: params.companyId || undefined,
        queueName: params.queueName,
        jobName: params.jobName,
        jobStatus: params.status,
        startedAt: params.startedAt ?? null,
        finishedAt: params.finishedAt ?? new Date(),
        itemsDiscovered: params.itemsDiscovered ?? null,
        itemsCreated: params.itemsCreated ?? null,
        itemsUpdated: params.itemsUpdated ?? null,
        itemsDeduped: params.itemsDeduped ?? null,
        errorMessage: params.errorMessage ?? null,
        result: data.result
      }
    })
  }
}

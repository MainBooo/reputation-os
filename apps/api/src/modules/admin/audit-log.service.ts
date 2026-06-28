import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

export interface AuditLogEntry {
  actorUserId?: string
  actorEmail?: string
  action: string
  entityType: string
  entityId?: string
  workspaceId?: string
  targetUserId?: string
  beforeJson?: unknown
  afterJson?: unknown
  metadata?: unknown
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        actorEmail: entry.actorEmail,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        workspaceId: entry.workspaceId,
        targetUserId: entry.targetUserId,
        beforeJson: entry.beforeJson as any,
        afterJson: entry.afterJson as any,
        metadata: entry.metadata as any
      }
    })
  }

  async query(params: {
    action?: string
    actorUserId?: string
    workspaceId?: string
    targetUserId?: string
    dateFrom?: string
    dateTo?: string
    page?: number
    limit?: number
  }) {
    const page = Math.max(1, params.page ?? 1)
    const limit = Math.min(100, Math.max(1, params.limit ?? 50))
    const skip = (page - 1) * limit

    const where: any = {}
    if (params.action) where.action = params.action
    if (params.actorUserId) where.actorUserId = params.actorUserId
    if (params.workspaceId) where.workspaceId = params.workspaceId
    if (params.targetUserId) where.targetUserId = params.targetUserId
    if (params.dateFrom || params.dateTo) {
      where.createdAt = {
        ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
        ...(params.dateTo ? { lte: new Date(params.dateTo) } : {})
      }
    }

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          actorUser: { select: { id: true, email: true, fullName: true } },
          targetUser: { select: { id: true, email: true, fullName: true } },
          workspace: { select: { id: true, name: true, slug: true } }
        }
      })
    ])

    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  }
}

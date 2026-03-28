import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { ListCompanyMentionsDto } from './dto/list-company-mentions.dto'
import { UpdateMentionStatusDto } from './dto/update-mention-status.dto'

@Injectable()
export class MentionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCompanyAccess(userId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true, workspaceId: true } })
    if (!company) throw new NotFoundException('Company not found')

    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: company.workspaceId }
    })
    if (!member) throw new ForbiddenException('No access to company')
    return company
  }

  async findByCompany(userId: string, companyId: string, query: ListCompanyMentionsDto) {
    await this.assertCompanyAccess(userId, companyId)

    const page = query.page || 1
    const limit = query.limit || 20
    const skip = (page - 1) * limit

    const where: Prisma.MentionWhereInput = {
      companyId,
      ...(query.platform ? { platform: query.platform } : {}),
      ...(query.sentiment ? { sentiment: query.sentiment } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.from || query.to ? {
        publishedAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {})
        }
      } : {})
    }

    const [items, total] = await Promise.all([
      this.prisma.mention.findMany({
        where,
        include: { source: true, vkTrackedPost: true },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.mention.count({ where })
    ])

    return { data: items, meta: { total, page, limit } }
  }

  async findOne(userId: string, id: string) {
    const mention = await this.prisma.mention.findUnique({
      where: { id },
      include: { source: true, company: true, vkTrackedPost: true, aiReplyDrafts: true }
    })
    if (!mention) throw new NotFoundException('Mention not found')
    await this.assertCompanyAccess(userId, mention.companyId)
    return mention
  }

  async updateStatus(userId: string, id: string, dto: UpdateMentionStatusDto) {
    const mention = await this.prisma.mention.findUnique({ where: { id } })
    if (!mention) throw new NotFoundException('Mention not found')
    await this.assertCompanyAccess(userId, mention.companyId)
    return this.prisma.mention.update({ where: { id }, data: { status: dto.status } })
  }
}

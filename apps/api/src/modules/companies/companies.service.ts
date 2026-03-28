import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CreateCompanyDto } from './dto/create-company.dto'
import { UpdateCompanyDto } from './dto/update-company.dto'
import { CreateCompanyAliasDto } from './dto/create-company-alias.dto'
import { CreateCompanySourceTargetDto } from './dto/create-company-source-target.dto'
import { UpdateCompanySourceTargetDto } from './dto/update-company-source-target.dto'

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalize(value?: string | null) {
    return value?.trim().toLowerCase() || null
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

    return this.prisma.company.create({
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

    return this.prisma.company.update({
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

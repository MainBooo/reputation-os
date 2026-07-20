import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { AuditLogService } from '../admin/audit-log.service'
import { ListCompanyMentionsDto } from './dto/list-company-mentions.dto'
import { UpdateMentionStatusDto } from './dto/update-mention-status.dto'
import { ResolveMentionReviewDto } from './dto/resolve-mention-review.dto'

// A human reviewDecision always takes priority over the model's own messageClassification
// when deciding which Inbox bucket a mention belongs to. These two fragments are exact
// logical complements for every reachable (messageClassification, reviewDecision) pair:
//  - reviewDecision=RELEVANT   → always RELEVANT_BUCKET, even if classification=IRRELEVANT.
//  - reviewDecision=IRRELEVANT → always IRRELEVANT_BUCKET, even if classification≠IRRELEVANT.
//  - reviewDecision=null       → falls back to messageClassification alone (the common case —
//    almost nothing has been through manual review yet).
//
// IMPORTANT: `NOT: { field: value }` on a *nullable* Prisma field compiles to raw SQL
// `NOT (field = value)`, which is NULL — not TRUE — when the column is NULL, so a bare NOT
// silently drops every never-reviewed row. Every NOT below is therefore paired with an
// explicit `{ field: null }` OR-branch. (Confirmed against production Postgres: `SELECT NOT
// (NULL = 'IRRELEVANT')` returns NULL, and a first version of this fragment without the
// null branch returned 0 rows for the entire company instead of the expected 638.)
export const IRRELEVANT_BUCKET: Prisma.MentionWhereInput = {
  OR: [
    {
      AND: [
        { messageClassification: 'IRRELEVANT' },
        { OR: [{ reviewDecision: null }, { NOT: { reviewDecision: 'RELEVANT' } }] }
      ]
    },
    { reviewDecision: 'IRRELEVANT' }
  ]
}

export const RELEVANT_BUCKET: Prisma.MentionWhereInput = {
  AND: [
    { OR: [{ reviewDecision: null }, { NOT: { reviewDecision: 'IRRELEVANT' } }] },
    {
      OR: [
        { messageClassification: null },
        { NOT: { messageClassification: 'IRRELEVANT' } },
        { reviewDecision: 'RELEVANT' }
      ]
    }
  ]
}

@Injectable()
export class MentionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService
  ) {}

  private async assertCompanyAccess(userId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true, workspaceId: true } })
    if (!company) throw new NotFoundException('Company not found')

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true, isActive: true }
    })

    if (user?.isActive && user.systemRole === 'SUPER_ADMIN') return company

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

    const platformFilter = query.platform

    // Three Inbox views share this one query path, distinguished by explicit params:
    //  - main Inbox (default): confirmed-relevant only — no IRRELEVANT, no pending review.
    //  - "На проверку" (needsManualReview=true): everything still awaiting a human call,
    //    regardless of what the model guessed.
    //  - "Не по теме" (onlyIrrelevant=true): confidently-IRRELEVANT or human-confirmed
    //    irrelevant, with pending-review items excluded (they belong in the review queue).
    const onlyIrrelevant = query.onlyIrrelevant === 'true'
    const needsManualReview = query.needsManualReview !== undefined ? query.needsManualReview === 'true' : false
    const includeHidden = query.includeHidden === 'true' || onlyIrrelevant

    const where: Prisma.MentionWhereInput = {
      companyId,
      ...(platformFilter ? { platform: platformFilter } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.rating ? { ratingValue: query.rating } : {}),
      ...(query.from || query.to ? {
        publishedAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {})
        }
      } : {}),
      ...(query.messageClassification ? { messageClassification: query.messageClassification } : {}),
      ...(query.messageUrgency ? { messageUrgency: query.messageUrgency } : {}),
      needsManualReview,
      ...(includeHidden ? {} : { isInboxVisible: true })
    }

    if (onlyIrrelevant) {
      // A human reviewDecision always wins over the model's own guess:
      //  - reviewDecision=RELEVANT excludes it here even if messageClassification=IRRELEVANT.
      //  - reviewDecision=IRRELEVANT includes it here even if the model called it something else.
      where.AND = [IRRELEVANT_BUCKET]
    } else if (needsManualReview) {
      // "На проверку" shows every still-pending item regardless of what the model
      // guessed — including ones it happened to (unconfidently) call IRRELEVANT — so
      // no classification/reviewDecision exclusion applies here. Once resolved,
      // needsManualReview flips to false and the record leaves this view on its own.
    } else if (!query.messageClassification) {
      // Default main-Inbox membership — same reviewDecision-priority rule as above,
      // just inverted: this is exactly the complement of IRRELEVANT_BUCKET.
      where.AND = [RELEVANT_BUCKET]
    }

      if (query.platform === 'WEB') {
        where.NOT = [
          { url: { contains: '2gis.ru' } },
          { url: { contains: 'yandex.ru/maps' } },
          { url: { contains: 'yandex.com/maps' } }
        ]
      }

    if (query.sentiment === 'POSITIVE') {
      where.OR = [
        { ratingValue: { gte: 4 } },
        { AND: [{ ratingValue: null }, { sentiment: 'POSITIVE' }] }
      ]
    }

    if (query.sentiment === 'NEGATIVE') {
      where.OR = [
        { ratingValue: { lte: 2 } },
        { AND: [{ ratingValue: null }, { sentiment: 'NEGATIVE' }] }
      ]
    }

    if (query.sentiment === 'NEUTRAL') {
      where.OR = [
        { ratingValue: { gt: 2, lt: 4 } },
        { AND: [{ ratingValue: null }, { sentiment: 'NEUTRAL' }] }
      ]
    }

    const ratingWhere: Prisma.MentionWhereInput = {
      AND: [
        where,
        { ratingValue: { not: null } }
      ]
    }

    // Tab badge counts share the same non-review filters (platform/status/date/etc.)
    // as `where`, but always count their own review-state slice regardless of which
    // view the caller actually requested — so switching tabs shows a live count.
    const { needsManualReview: _ignoredReview, isInboxVisible: _ignoredVisible, AND: _ignoredAnd, ...commonWhere } = where
    const needsReviewCountWhere: Prisma.MentionWhereInput = { ...commonWhere, needsManualReview: true }
    const irrelevantCountWhere: Prisma.MentionWhereInput = {
      ...commonWhere,
      needsManualReview: false,
      AND: [IRRELEVANT_BUCKET]
    }

    const [items, total, ratingAggregate, ratedCount, sourceTargets, needsReviewCount, irrelevantCount] = await Promise.all([
      this.prisma.mention.findMany({
        where,
        include: { source: true },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.mention.count({ where }),
      this.prisma.mention.aggregate({
        where: ratingWhere,
        _avg: { ratingValue: true }
      }),
      this.prisma.mention.count({ where: ratingWhere }),
      this.prisma.companySourceTarget.findMany({
        where: { companyId, isActive: true },
        include: { source: true }
      }),
      this.prisma.mention.count({ where: needsReviewCountWhere }),
      this.prisma.mention.count({ where: irrelevantCountWhere })
    ])

    const averageRatingRaw = ratingAggregate._avg.ratingValue
    const averageRating = averageRatingRaw === null ? null : Number(averageRatingRaw)

    const sourceUrlByPlatform = new Map(
      sourceTargets
        .filter((target) => target.externalUrl && target.source?.platform)
        .map((target) => [target.source.platform, target.externalUrl])
    )

    const data = items.map((item) => ({
      ...item,
      sourceUrl: item.url || sourceUrlByPlatform.get(item.platform) || item.source?.baseUrl || null
    }))

    return { data, meta: { total, page, limit, averageRating, ratedCount, needsReviewCount, irrelevantCount } }
  }

  async findOne(userId: string, id: string) {
    const mention = await this.prisma.mention.findUnique({
      where: { id },
      include: { source: true, company: true, aiReplyDrafts: true }
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

  /** Resolves a "На проверку" item. Only ever touches needsManualReview/reviewDecision/
   *  reviewedAt/reviewedByUserId — the model's own messageClassification/confidence/reason
   *  stay untouched so the AI's original verdict remains visible for audit, separate from
   *  the human's decision. Logged to AuditLog for traceability. */
  async resolveReview(userId: string, id: string, dto: ResolveMentionReviewDto) {
    const mention = await this.prisma.mention.findUnique({ where: { id } })
    if (!mention) throw new NotFoundException('Mention not found')
    const company = await this.assertCompanyAccess(userId, mention.companyId)

    const updated = await this.prisma.mention.update({
      where: { id },
      data: {
        needsManualReview: false,
        reviewDecision: dto.decision,
        reviewedAt: new Date(),
        reviewedByUserId: userId
      }
    })

    await this.auditLog.log({
      actorUserId: userId,
      action: 'mention.review_decision',
      entityType: 'Mention',
      entityId: id,
      workspaceId: company.workspaceId,
      beforeJson: {
        needsManualReview: mention.needsManualReview,
        reviewDecision: mention.reviewDecision,
        messageClassification: mention.messageClassification,
        messageClassConfidence: mention.messageClassConfidence
      },
      afterJson: {
        needsManualReview: updated.needsManualReview,
        reviewDecision: updated.reviewDecision
      }
    })

    return updated
  }

  async remove(userId: string, id: string) {
    const mention = await this.prisma.mention.findUnique({
      where: { id },
      select: { id: true, companyId: true }
    })

    if (!mention) throw new NotFoundException('Mention not found')

    await this.assertCompanyAccess(userId, mention.companyId)

    await this.prisma.$transaction([
      this.prisma.aIReplyDraft.deleteMany({ where: { mentionId: id } }),
      this.prisma.mention.delete({ where: { id } })
    ])

    return { ok: true }
  }
}

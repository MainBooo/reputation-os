import { Injectable, Logger } from '@nestjs/common'
import * as webPush from 'web-push'
import { PrismaService } from '../common/prisma/prisma.service'
import { TelegramNotificationsService } from '../telegram/telegram-notifications.service'

const ALLOWED_SENTIMENTS = ['NEGATIVE', 'POSITIVE', 'NEUTRAL'] as const
const ALERT_MAX_PUBLISHED_AGE_MS = 48 * 60 * 60 * 1000
const ALERT_INITIAL_LOOKBACK_MS = 24 * 60 * 60 * 1000

function sentimentLabel(sentiment: string) {
  if (sentiment === 'NEGATIVE') return 'негативный'
  if (sentiment === 'POSITIVE') return 'позитивный'
  if (sentiment === 'NEUTRAL') return 'нейтральный'
  return 'новый'
}

function notificationTypeForSentiment(sentiment: string | null | undefined) {
  if (sentiment === 'NEGATIVE') return 'NEW_NEGATIVE_MENTION'
  return 'NEW_REVIEW'
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramNotifications: TelegramNotificationsService,
  ) {
    const publicKey = process.env.WEB_PUSH_PUBLIC_KEY
    const privateKey = process.env.WEB_PUSH_PRIVATE_KEY
    const subject = process.env.WEB_PUSH_SUBJECT || 'mailto:admin@reputationos.local'

    if (publicKey && privateKey) {
      webPush.setVapidDetails(subject, publicKey, privateKey)
    } else {
      this.logger.warn('WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY are not configured for worker')
    }
  }

  private normalizeSentiments(value: string[] | null | undefined) {
    const list = Array.isArray(value) ? value : []
    const filtered = list.filter((item) => ALLOWED_SENTIMENTS.includes(item as any))

    return filtered.length ? filtered : ['NEGATIVE']
  }

  /** Возвращает true, если план workspace разрешает push-уведомления и подписка активна */
  private async isWorkspacePushEnabled(workspaceId: string, cache: Map<string, boolean>): Promise<boolean> {
    if (cache.has(workspaceId)) return cache.get(workspaceId)!
    const prismaAny = this.prisma as any
    const [workspace, sub] = await Promise.all([
      prismaAny.workspace.findUnique({ where: { id: workspaceId }, select: { isActive: true } }),
      prismaAny.subscription.findUnique({ where: { workspaceId }, include: { plan: true } })
    ])

    if (!workspace?.isActive) {
      this.logger.debug(`Push skip: workspaceId=${workspaceId} reason=workspace.isActive=false`)
      cache.set(workspaceId, false)
      return false
    }

    const now = new Date()
    const isSubActive =
      sub &&
      ((sub.status === 'ACTIVE' && sub.currentPeriodEnd != null && new Date(sub.currentPeriodEnd) > now) ||
        sub.status === 'MANUAL' ||
        (sub.status === 'TRIAL' && sub.trialEndsAt != null && new Date(sub.trialEndsAt) > now))

    if (!isSubActive) {
      this.logger.debug(`Push skip: workspaceId=${workspaceId} reason=subscription.status=${sub?.status ?? 'none'}`)
      cache.set(workspaceId, false)
      return false
    }

    const limits = (sub?.plan?.limits ?? {}) as Record<string, unknown>
    const enabled = limits.pushNotificationsEnabled === true
    cache.set(workspaceId, enabled)
    return enabled
  }

  async checkAndSend() {
    const prismaAny = this.prisma as any
    const now = new Date()

    const subscriptions = await prismaAny.webPushSubscription.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: 'asc' }
    })

    let checked = 0
    let sent = 0
    let failed = 0
    let skippedNoPlan = 0
    const pushEnabledCache = new Map<string, boolean>()

    for (const subscription of subscriptions) {
      checked += 1

      const pushAllowed = await this.isWorkspacePushEnabled(subscription.workspaceId, pushEnabledCache)
      if (!pushAllowed) {
        skippedNoPlan += 1
        this.logger.debug(`Push skip: workspaceId=${subscription.workspaceId} reason=pushNotificationsEnabled=false`)
        await prismaAny.webPushSubscription.update({
          where: { id: subscription.id },
          data: { lastAlertCheckedAt: now }
        }).catch(() => null)
        continue
      }

      const sentiments = this.normalizeSentiments(subscription.alertSentiments)
      const since = subscription.lastAlertCheckedAt || new Date(now.getTime() - ALERT_INITIAL_LOOKBACK_MS)
      const minPublishedAt = new Date(now.getTime() - ALERT_MAX_PUBLISHED_AGE_MS)

      const mentions = await prismaAny.mention.findMany({
        where: {
          createdAt: { gt: since },
          publishedAt: { gte: minPublishedAt },
          sentiment: { in: sentiments },
          company: {
            workspaceId: subscription.workspaceId,
            isActive: true
          }
        },
        include: {
          source: {
            select: {
              platform: true
            }
          },
          company: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'asc' },
        take: 10
      })

      if (!mentions.length) {
        await prismaAny.webPushSubscription.update({
          where: { id: subscription.id },
          data: { lastAlertCheckedAt: now }
        }).catch(() => null)

        continue
      }

      for (const mention of mentions) {
        try {
          const title = `Новый ${sentimentLabel(mention.sentiment)} отзыв`
          const companyName = mention.company?.name || 'Компания'
          const content = String(mention.content || '').replace(/\s+/g, ' ').trim()
          const body = `${companyName}: ${content.slice(0, 140)}`

          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
              }
            },
            JSON.stringify({
              title,
              body,
              url: `/companies/${mention.companyId}/inbox`,
              tag: `mention-${mention.id}`
            })
          )

          sent += 1
        } catch (error: any) {
          failed += 1

          const statusCode = Number(error?.statusCode || 0)
          this.logger.warn(
            `Alert push failed subscriptionId=${subscription.id} mentionId=${mention.id} status=${statusCode || 'unknown'} body=${String(error?.body || '')}`
          )

          if (statusCode === 404 || statusCode === 410) {
            await prismaAny.webPushSubscription.update({
              where: { id: subscription.id },
              data: { isActive: false }
            }).catch(() => null)

            break
          }
        }
      }

      const latestCreatedAt = mentions[mentions.length - 1]?.createdAt || now

      await prismaAny.webPushSubscription.update({
        where: { id: subscription.id },
        data: {
          lastAlertCheckedAt: latestCreatedAt,
          lastUsedAt: sent > 0 ? now : subscription.lastUsedAt
        }
      }).catch(() => null)
    }

    const { telegramSent, telegramFailed } = await this.checkAndSendTelegram()

    this.logger.log(
      `Alert check finished subscriptions=${subscriptions.length} checked=${checked} skippedNoPlan=${skippedNoPlan} sent=${sent} failed=${failed} telegramSent=${telegramSent} telegramFailed=${telegramFailed}`
    )

    return { subscriptions: subscriptions.length, checked, skippedNoPlan, sent, failed, telegramSent, telegramFailed }
  }

  private async checkAndSendTelegram() {
    const prismaAny = this.prisma as any
    const now = new Date()
    const minPublishedAt = new Date(now.getTime() - ALERT_MAX_PUBLISHED_AGE_MS)
    const lookbackSince = new Date(now.getTime() - ALERT_INITIAL_LOOKBACK_MS)

    let telegramSent = 0
    let telegramFailed = 0

    const rules = await prismaAny.notificationRule.findMany({
      where: { channel: 'TELEGRAM', isActive: true },
    })

    for (const rule of rules) {
      // Проверяем workspace.isActive, subscription.status и entitlements перед отправкой в Telegram
      const [wsData, workspaceSub] = await Promise.all([
        prismaAny.workspace.findUnique({ where: { id: rule.workspaceId }, select: { isActive: true } }),
        prismaAny.subscription.findUnique({ where: { workspaceId: rule.workspaceId }, include: { plan: true } })
      ])

      if (!wsData?.isActive) {
        this.logger.debug(`Telegram skip: workspaceId=${rule.workspaceId} reason=workspace.isActive=false`)
        continue
      }

      const isSubActive =
        workspaceSub &&
        ((workspaceSub.status === 'ACTIVE' && workspaceSub.currentPeriodEnd != null && new Date(workspaceSub.currentPeriodEnd) > now) ||
          workspaceSub.status === 'MANUAL' ||
          (workspaceSub.status === 'TRIAL' && workspaceSub.trialEndsAt != null && new Date(workspaceSub.trialEndsAt) > now))

      if (!isSubActive) {
        this.logger.debug(`Telegram skip: workspaceId=${rule.workspaceId} reason=subscription.status=${workspaceSub?.status ?? 'none'}`)
        continue
      }

      const wLimits = (workspaceSub?.plan?.limits ?? {}) as Record<string, unknown>
      if (!wLimits.telegramNotifications) {
        this.logger.debug(`Telegram skip: workspaceId=${rule.workspaceId} reason=telegramNotifications=false`)
        continue
      }

      const recipients = await prismaAny.user.findMany({
        where: {
          telegramChatId: { not: null },
          workspaceMembers: { some: { workspaceId: rule.workspaceId } },
        },
        select: { id: true, telegramChatId: true },
      })

      if (!recipients.length) continue

      const mentions = await prismaAny.mention.findMany({
        where: {
          createdAt: { gt: lookbackSince },
          ...(rule.companyId ? { companyId: rule.companyId } : {}),
          company: { workspaceId: rule.workspaceId, isActive: true },
          NOT: {
            telegramDeliveries: {
              some: {
                userId: { in: recipients.map((r: any) => r.id) },
                status: 'SENT',
              },
            },
          },
        },
        include: {
          source: { select: { platform: true } },
          company: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      })

      for (const mention of mentions) {
        if (notificationTypeForSentiment(mention.sentiment) !== rule.type) continue

        for (const recipient of recipients) {
          const existing = await prismaAny.telegramMentionDelivery.findUnique({
            where: { mentionId_userId: { mentionId: mention.id, userId: recipient.id } },
          })

          if (existing?.status === 'SENT') continue

          const ok = await this.telegramNotifications.sendReviewNotification(recipient.telegramChatId, {
            id: mention.id,
            companyId: mention.companyId,
            content: mention.content,
            ratingValue: mention.ratingValue,
            sentiment: mention.sentiment,
            source: mention.source || { platform: 'UNKNOWN' },
            company: mention.company || { name: 'Компания' },
          })

          await prismaAny.telegramMentionDelivery.upsert({
            where: { mentionId_userId: { mentionId: mention.id, userId: recipient.id } },
            create: {
              mentionId: mention.id,
              userId: recipient.id,
              chatId: recipient.telegramChatId,
              status: ok ? 'SENT' : 'FAILED',
              attempts: 1,
              sentAt: ok ? now : null,
            },
            update: {
              status: ok ? 'SENT' : 'FAILED',
              attempts: { increment: 1 },
              sentAt: ok ? now : null,
            },
          })

          if (ok) telegramSent += 1
          else telegramFailed += 1
        }
      }
    }

    return { telegramSent, telegramFailed }
  }
}

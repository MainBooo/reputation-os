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

    for (const subscription of subscriptions) {
      checked += 1

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
      `Alert check finished subscriptions=${subscriptions.length} checked=${checked} sent=${sent} failed=${failed} telegramSent=${telegramSent} telegramFailed=${telegramFailed}`
    )

    return { subscriptions: subscriptions.length, checked, sent, failed, telegramSent, telegramFailed }
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
          publishedAt: { gte: minPublishedAt },
          ...(rule.companyId ? { companyId: rule.companyId } : {}),
          company: { workspaceId: rule.workspaceId, isActive: true },
        },
        include: {
          source: { select: { platform: true } },
          company: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
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

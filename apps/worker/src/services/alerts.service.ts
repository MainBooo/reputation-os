import { Injectable, Logger } from '@nestjs/common'
import * as webPush from 'web-push'
import { PrismaService } from '../common/prisma/prisma.service'

const ALLOWED_SENTIMENTS = ['NEGATIVE', 'POSITIVE', 'NEUTRAL'] as const

function sentimentLabel(sentiment: string) {
  if (sentiment === 'NEGATIVE') return 'негативный'
  if (sentiment === 'POSITIVE') return 'позитивный'
  if (sentiment === 'NEUTRAL') return 'нейтральный'
  return 'новый'
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name)

  constructor(private readonly prisma: PrismaService) {
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
      const since = subscription.lastAlertCheckedAt || subscription.createdAt || new Date(Date.now() - 10 * 60 * 1000)

      const mentions = await prismaAny.mention.findMany({
        where: {
          createdAt: { gt: since },
          sentiment: { in: sentiments },
          company: {
            workspaceId: subscription.workspaceId,
            isActive: true
          }
        },
        include: {
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

    this.logger.log(`Alert check finished subscriptions=${subscriptions.length} checked=${checked} sent=${sent} failed=${failed}`)

    return { subscriptions: subscriptions.length, checked, sent, failed }
  }
}

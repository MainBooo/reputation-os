import { ForbiddenException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import * as webPush from 'web-push'
import { PrismaService } from '../../common/prisma/prisma.service'
import { SubscribePushDto } from './dto/subscribe-push.dto'
import { UnsubscribePushDto } from './dto/unsubscribe-push.dto'
import { TestPushDto } from './dto/test-push.dto'

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name)

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.WEB_PUSH_PUBLIC_KEY
    const privateKey = process.env.WEB_PUSH_PRIVATE_KEY
    const subject = process.env.WEB_PUSH_SUBJECT || 'mailto:admin@reputationos.local'

    if (publicKey && privateKey) {
      webPush.setVapidDetails(subject, publicKey, privateKey)
    }
  }

  getPublicKey() {
    const publicKey = process.env.WEB_PUSH_PUBLIC_KEY

    if (!publicKey) {
      throw new InternalServerErrorException('WEB_PUSH_PUBLIC_KEY is not configured')
    }

    return { publicKey }
  }

  private normalizeAlertSentiments(value?: string[]) {
    const allowed = ['NEGATIVE', 'POSITIVE', 'NEUTRAL']
    const list = Array.isArray(value) ? value : []
    const filtered = list.filter((item) => allowed.includes(item))

    return filtered.length ? filtered : ['NEGATIVE']
  }

  private async assertWorkspaceAccess(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId }
    })

    if (!member) {
      throw new ForbiddenException('No access to workspace')
    }
  }

  async listSubscriptions(userId: string) {
    const data = await this.prisma.webPushSubscription.findMany({
      where: {
        userId,
        isActive: true
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        alertSentiments: true,
        userAgent: true,
        lastUsedAt: true,
        lastAlertCheckedAt: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return { data }
  }

  async subscribe(userId: string, dto: SubscribePushDto) {
    await this.assertWorkspaceAccess(userId, dto.workspaceId)

    const alertSentiments = this.normalizeAlertSentiments(dto.alertSentiments)

    return this.prisma.webPushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: {
        workspaceId: dto.workspaceId,
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent || null,
        alertSentiments,
        isActive: true,
        lastUsedAt: new Date()
      },
      create: {
        workspaceId: dto.workspaceId,
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent || null,
        alertSentiments,
        isActive: true,
        lastUsedAt: new Date()
      }
    })
  }

  async unsubscribe(userId: string, dto: UnsubscribePushDto) {
    const existing = await this.prisma.webPushSubscription.findUnique({
      where: { endpoint: dto.endpoint }
    })

    if (!existing || existing.userId !== userId) {
      return { ok: true }
    }

    await this.prisma.webPushSubscription.update({
      where: { endpoint: dto.endpoint },
      data: { isActive: false }
    })

    return { ok: true }
  }

  async sendTest(userId: string, dto: TestPushDto) {
    const subscriptions = await this.prisma.webPushSubscription.findMany({
      where: {
        userId,
        isActive: true,
        ...(dto.workspaceId ? { workspaceId: dto.workspaceId } : {})
      }
    })

    let sent = 0
    let failed = 0

    for (const item of subscriptions) {
      try {
        await webPush.sendNotification(
          {
            endpoint: item.endpoint,
            keys: {
              p256dh: item.p256dh,
              auth: item.auth
            }
          },
          JSON.stringify({
            title: 'Reputation OS',
            body: 'Тестовое push-уведомление работает.',
            url: '/settings',
            tag: 'reputation-os-test'
          })
        )

        sent += 1

        await this.prisma.webPushSubscription.update({
          where: { id: item.id },
          data: { lastUsedAt: new Date() }
        })
      } catch (error: any) {
        failed += 1
        const statusCode = Number(error?.statusCode || 0)

        this.logger.warn(`Push test failed subscriptionId=${item.id} status=${statusCode || 'unknown'} body=${String(error?.body || '')} endpoint=${String(item.endpoint || '').slice(0, 90)}`)

        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.webPushSubscription.update({
            where: { id: item.id },
            data: { isActive: false }
          })
        }
      }
    }

    return {
      ok: true,
      subscriptions: subscriptions.length,
      sent,
      failed
    }
  }
}

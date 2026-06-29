import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import * as webPush from 'web-push'
import { PrismaService } from '../common/prisma/prisma.service'
import { TelegramNotificationsService } from '../telegram/telegram-notifications.service'
import { QUEUES } from '../queues/queue.names'

const DEMO_WORKSPACE_SLUG = 'demo-workspace'

type ReminderType = 'TRIAL_ENDING' | 'SUBSCRIPTION_ENDING'

interface ReminderTarget {
  subscriptionId: string
  workspaceId: string
  reminderType: ReminderType
  daysBefore: number
  periodEndDate: Date
  planName: string
  isTrial: boolean
}

@Injectable()
export class SubscriptionReminderProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionReminderProcessor.name)
  private worker!: Worker
  private pushConfigured = false

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramNotificationsService
  ) {
    const publicKey = process.env.WEB_PUSH_PUBLIC_KEY
    const privateKey = process.env.WEB_PUSH_PRIVATE_KEY
    const subject = process.env.WEB_PUSH_SUBJECT || 'mailto:admin@reputationos.local'

    if (publicKey && privateKey) {
      webPush.setVapidDetails(subject, publicKey, privateKey)
      this.pushConfigured = true
    } else {
      this.logger.warn('WEB_PUSH keys not configured — push reminders disabled')
    }
  }

  onModuleInit() {
    this.worker = new Worker(
      QUEUES.SUBSCRIPTION_REMINDER,
      async (job: Job) => this.handle(job),
      { connection: this.connection }
    )
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(_job: Job) {
    this.logger.log('Starting subscription reminder check')
    const targets = await this.collectTargets()
    this.logger.log(`Found ${targets.length} reminders to process`)

    let sent = 0
    let skipped = 0

    for (const target of targets) {
      const alreadySent = await this.isAlreadySent(target)
      if (alreadySent) {
        skipped++
        continue
      }

      const channels = await this.sendReminder(target)
      await this.logReminder(target, channels)
      sent++
    }

    this.logger.log(`Subscription reminder check done: sent=${sent} skipped=${skipped}`)
    return { sent, skipped }
  }

  private async collectTargets(): Promise<ReminderTarget[]> {
    const now = new Date()
    const targets: ReminderTarget[] = []

    const thresholds = [3, 1, 0]

    for (const daysBefore of thresholds) {
      const windowStart = new Date(now.getTime() + daysBefore * 86_400_000)
      const windowEnd = new Date(windowStart.getTime() + 86_400_000)

      // TRIAL subscriptions
      const trialSubs = await this.prisma.subscription.findMany({
        where: {
          status: 'TRIAL',
          trialEndsAt: { gte: windowStart, lt: windowEnd }
        },
        include: {
          plan: { select: { name: true } },
          workspace: { select: { slug: true } }
        }
      })

      for (const sub of trialSubs) {
        if (sub.workspace.slug === DEMO_WORKSPACE_SLUG) continue
        targets.push({
          subscriptionId: sub.id,
          workspaceId: sub.workspaceId,
          reminderType: 'TRIAL_ENDING',
          daysBefore,
          periodEndDate: sub.trialEndsAt!,
          planName: sub.plan.name,
          isTrial: true
        })
      }

      // ACTIVE subscriptions
      const activeSubs = await this.prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          currentPeriodEnd: { gte: windowStart, lt: windowEnd }
        },
        include: {
          plan: { select: { name: true } },
          workspace: { select: { slug: true } }
        }
      })

      for (const sub of activeSubs) {
        if (sub.workspace.slug === DEMO_WORKSPACE_SLUG) continue
        targets.push({
          subscriptionId: sub.id,
          workspaceId: sub.workspaceId,
          reminderType: 'SUBSCRIPTION_ENDING',
          daysBefore,
          periodEndDate: sub.currentPeriodEnd!,
          planName: sub.plan.name,
          isTrial: false
        })
      }
    }

    return targets
  }

  private async isAlreadySent(target: ReminderTarget): Promise<boolean> {
    const existing = await this.prisma.subscriptionReminderLog.findUnique({
      where: {
        subscriptionId_reminderType_daysBefore_periodEndDate: {
          subscriptionId: target.subscriptionId,
          reminderType: target.reminderType,
          daysBefore: target.daysBefore,
          periodEndDate: target.periodEndDate
        }
      }
    })
    return Boolean(existing)
  }

  private buildMessage(target: ReminderTarget): string {
    const { daysBefore, isTrial, planName } = target

    if (isTrial) {
      if (daysBefore === 0) {
        return (
          `⏰ *Пробный период ReputationOS закончился.*\n\n` +
          `Доступ переведён на бесплатный тариф. Чтобы вернуть функции тарифа «${planName}», оформите подписку.`
        )
      }
      const daysLabel = daysBefore === 1 ? '1 день' : `${daysBefore} дня`
      return (
        `⏳ *Пробный период ReputationOS закончится через ${daysLabel}.*\n\n` +
        `Чтобы сохранить доступ к функциям тарифа «${planName}», выберите тариф.`
      )
    }

    if (daysBefore === 0) {
      return (
        `⚠️ *Подписка ReputationOS закончилась.*\n\n` +
        `Доступ ограничен текущим тарифом. Продлите подписку, чтобы вернуть полный доступ.`
      )
    }
    const daysLabel = daysBefore === 1 ? '1 день' : `${daysBefore} дня`
    return (
      `📅 *Подписка ReputationOS закончится через ${daysLabel}.*\n\n` +
      `Продлите тариф «${planName}», чтобы мониторинг и уведомления продолжили работать без перерыва.`
    )
  }

  private async sendReminder(target: ReminderTarget): Promise<string[]> {
    const channels: string[] = []
    const message = this.buildMessage(target)

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: target.workspaceId, role: { in: ['OWNER', 'ADMIN'] } },
      include: {
        user: {
          select: {
            id: true,
            telegramChatId: true,
            telegramLinkedAt: true
          }
        }
      }
    })

    for (const member of members) {
      // Telegram (billing reminders bypass plan restrictions — это системное уведомление)
      if (member.user.telegramChatId) {
        const ok = await this.telegram.sendBillingReminder(member.user.telegramChatId, message)
        if (ok && !channels.includes('TELEGRAM')) channels.push('TELEGRAM')
      }

      // Web Push
      if (this.pushConfigured) {
        await this.sendPushToUser(member.user.id, target, message, channels)
      }
    }

    this.logger.log(
      `Reminder sent workspaceId=${target.workspaceId} type=${target.reminderType} daysBefore=${target.daysBefore} channels=[${channels.join(',')}]`
    )
    return channels
  }

  private async sendPushToUser(userId: string, target: ReminderTarget, message: string, channels: string[]) {
    const pushSubs = await this.prisma.webPushSubscription.findMany({
      where: { userId, isActive: true }
    })

    const title = target.isTrial ? 'Пробный период заканчивается' : 'Подписка заканчивается'
    const body = message.replace(/\*([^*]+)\*/g, '$1').slice(0, 250)

    for (const sub of pushSubs) {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url: '/billing/checkout', tag: `billing-${target.subscriptionId}-${target.daysBefore}` })
        )
        if (!channels.includes('PUSH')) channels.push('PUSH')
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await this.prisma.webPushSubscription.update({
            where: { id: sub.id },
            data: { isActive: false }
          })
        } else {
          this.logger.warn(`Push reminder failed userId=${userId}: ${err?.message}`)
        }
      }
    }
  }

  private async logReminder(target: ReminderTarget, channels: string[]) {
    await this.prisma.subscriptionReminderLog.create({
      data: {
        subscriptionId: target.subscriptionId,
        reminderType: target.reminderType,
        daysBefore: target.daysBefore,
        periodEndDate: target.periodEndDate,
        channels
      }
    })
  }
}

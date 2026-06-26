import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async getNotificationRules(workspaceId: string) {
    return this.prisma.notificationRule.findMany({
      where: {
        workspaceId,
        channel: 'TELEGRAM',
      },
    })
  }

  async toggleRule(workspaceId: string, eventType: string): Promise<boolean> {
    const existing = await this.prisma.notificationRule.findFirst({
      where: {
        workspaceId,
        type: eventType as any,
        channel: 'TELEGRAM',
      },
    })

    if (existing) {
      await this.prisma.notificationRule.delete({ where: { id: existing.id } })
      this.logger.log(`Отключено правило ${eventType} для workspaceId=${workspaceId}`)
      return false
    } else {
      await this.prisma.notificationRule.create({
        data: {
          workspaceId,
          name: `Telegram: ${eventType}`,
          type: eventType as any,
          channel: 'TELEGRAM',
          isActive: true,
        },
      })
      this.logger.log(`Включено правило ${eventType} для workspaceId=${workspaceId}`)
      return true
    }
  }

  async disableAll(workspaceId: string): Promise<void> {
    await this.prisma.notificationRule.deleteMany({
      where: { workspaceId, channel: 'TELEGRAM' },
    })
    this.logger.log(`Все TELEGRAM-правила отключены для workspaceId=${workspaceId}`)
  }

  async enableAll(workspaceId: string): Promise<void> {
    const eventTypes = ['NEW_NEGATIVE_MENTION', 'NEW_REVIEW']
    for (const type of eventTypes) {
      const existing = await this.prisma.notificationRule.findFirst({
        where: { workspaceId, type: type as any, channel: 'TELEGRAM' },
      })
      if (!existing) {
        await this.prisma.notificationRule.create({
          data: {
            workspaceId,
            name: `Telegram: ${type}`,
            type: type as any,
            channel: 'TELEGRAM',
            isActive: true,
          },
        })
      }
    }
    this.logger.log(`Все TELEGRAM-правила включены для workspaceId=${workspaceId}`)
  }
}

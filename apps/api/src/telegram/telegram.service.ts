import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../common/prisma/prisma.service' // путь к вашему prisma.service

const TOKEN_TTL_MINUTES = 15

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async generateLinkToken(userId: string): Promise<{ url: string }> {
    // Удаляем старый токен если есть
    await this.prisma.telegramLinkToken.deleteMany({ where: { userId } })

    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)

    const linkToken = await this.prisma.telegramLinkToken.create({
      data: { userId, expiresAt },
    })

    const botUsername = this.config.getOrThrow<string>('TELEGRAM_BOT_USERNAME')
    const url = `https://t.me/${botUsername}?start=${linkToken.token}`

    this.logger.log(`Сгенерирован link-token для userId=${userId}`)
    return { url }
  }

  async unlink(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { telegramChatId: null, telegramLinkedAt: null },
      }),
      this.prisma.telegramLinkToken.deleteMany({ where: { userId } }),
    ])
    this.logger.log(`Telegram отвязан для userId=${userId}`)
  }

  async getStatus(userId: string): Promise<{ linked: boolean; linkedAt: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true, telegramLinkedAt: true },
    })

    return {
      linked: !!user?.telegramChatId,
      linkedAt: user?.telegramLinkedAt?.toISOString() ?? null,
    }
  }
}

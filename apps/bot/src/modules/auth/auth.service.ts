import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { Context } from 'telegraf'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(private readonly prisma: PrismaService) {}

  async linkAccount(chatId: number, token: string, ctx: Context): Promise<void> {
    // Найти токен
    const linkToken = await this.prisma.telegramLinkToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!linkToken) {
      await ctx.reply('❌ Ссылка недействительна. Запросите новую в личном кабинете.')
      return
    }

    // Проверить срок действия
    if (linkToken.expiresAt < new Date()) {
      await this.prisma.telegramLinkToken.delete({ where: { token } })
      await ctx.reply(
        '⏰ Ссылка устарела (действует 15 минут).\n\n' +
        'Запросите новую в личном кабинете: Настройки → Профиль → Telegram-уведомления',
      )
      return
    }

    // Проверить: уже привязан?
    const existingUser = await this.prisma.user.findUnique({
      where: { telegramChatId: BigInt(chatId) },
    })

    if (existingUser) {
      if (existingUser.id === linkToken.userId) {
        await ctx.reply('✅ Ваш аккаунт уже привязан к этому Telegram.')
      } else {
        await ctx.reply(
          '❌ Этот Telegram-аккаунт уже привязан к другому пользователю ReputationOS.',
        )
      }
      return
    }

    // Привязать
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: linkToken.userId },
        data: {
          telegramChatId: BigInt(chatId),
          telegramLinkedAt: new Date(),
        },
      }),
      this.prisma.telegramLinkToken.delete({ where: { token } }),
    ])

    this.logger.log(`Привязан chatId=${chatId} к userId=${linkToken.userId}`)

    await ctx.reply(
      '✅ *Telegram успешно привязан!*\n\n' +
      'Теперь вы будете получать уведомления о новых отзывах прямо здесь.\n\n' +
      'Доступные команды:\n' +
      '/companies — управление компаниями\n' +
      '/settings — настройки уведомлений\n' +
      '/me — информация об аккаунте\n' +
      '/help — справка',
      { parse_mode: 'Markdown' },
    )
  }

  async unlinkAccount(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { telegramChatId: null, telegramLinkedAt: null },
      }),
      this.prisma.telegramLinkToken.deleteMany({ where: { userId } }),
    ])
    this.logger.log(`Отвязан userId=${userId}`)
  }
}

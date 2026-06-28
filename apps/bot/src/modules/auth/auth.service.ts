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

    // Проверить entitlements workspace: telegramNotifications
    const workspaceMember = await this.prisma.workspaceMember.findFirst({
      where: { userId: linkToken.userId },
      orderBy: { createdAt: 'asc' },
      select: { workspaceId: true }
    })
    if (workspaceMember) {
      const workspaceSub = await (this.prisma as any).subscription.findUnique({
        where: { workspaceId: workspaceMember.workspaceId },
        include: { plan: true }
      })
      const wLimits = (workspaceSub?.plan?.limits ?? {}) as Record<string, unknown>
      if (!wLimits.telegramNotifications) {
        await ctx.reply(
          '❌ *Telegram-уведомления недоступны на вашем текущем тарифе.*\n\n' +
          'Для подключения Telegram обновите тариф в личном кабинете.',
          { parse_mode: 'Markdown' }
        )
        return
      }
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
      '✅ *Telegram успешно подключён*\n\n' +
      'Теперь вы можете управлять репутацией бизнеса прямо из Telegram.\n\n' +
      '*Доступно:*\n\n' +
      '📊 Просмотр рейтингов компаний\n' +
      '📝 Новые отзывы и упоминания\n' +
      '🤖 AI-ответы на отзывы\n' +
      '⚠️ Уведомления о негативе\n' +
      '➕ Добавление компаний\n' +
      '🗑️ Удаление компаний\n' +
      '⚙️ Настройка уведомлений\n\n' +
      'Откройте меню ниже и выберите нужный раздел.',
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

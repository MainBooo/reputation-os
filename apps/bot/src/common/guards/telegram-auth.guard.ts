import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { TelegrafExecutionContext } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { PrismaService } from '../prisma/prisma.service'

const APP_URL = process.env.API_INTERNAL_URL?.replace('/api', '') ?? 'https://reputation.generationweb.ru'

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name)

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const telegrafCtx = TelegrafExecutionContext.create(context)
    const ctx = telegrafCtx.getContext<Context & { state: { user: any } }>()

    const chatId = ctx.from?.id
    if (!chatId) return false

    const user = await this.prisma.user.findUnique({
      where: { telegramChatId: BigInt(chatId) },
      include: {
        workspaceMembers: {
          include: {
            workspace: {
              include: { subscription: { include: { plan: true } } },
            },
          },
        },
      },
    })

    if (!user) {
      this.logger.warn(`Неизвестный chatId: ${chatId}`)
      await ctx.reply(
        `❌ Аккаунт не привязан.\n\nПерейдите в личный кабинет и подключите Telegram:\n${APP_URL}/settings/profile`,
      )
      return false
    }

    ctx.state.user = user
    return true
  }
}

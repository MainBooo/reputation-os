import { Logger } from '@nestjs/common'
import { Start, Command, Update, Ctx } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { AuthService } from './auth.service'

@Update()
export class AuthUpdate {
  private readonly logger = new Logger(AuthUpdate.name)

  constructor(private readonly authService: AuthService) {}

  @Command('help')
  async onHelp(@Ctx() ctx: Context) {
    await ctx.reply(
      '📖 *Доступные команды*\n\n' +
      '/companies — список компаний и управление\n' +
      '/settings — настройки уведомлений\n' +
      '/me — информация об аккаунте\n' +
      '/help — эта справка\n\n' +
      '💡 Привяжите аккаунт через личный кабинет: Настройки → Профиль',
      { parse_mode: 'Markdown' },
    )
  }

  @Start()
  async onStart(@Ctx() ctx: Context & { startPayload?: string }) {
    const payload = ctx.startPayload
    const chatId = ctx.from?.id

    if (!chatId) return

    this.logger.log(`/start от chatId=${chatId}, payload="${payload}"`)

    if (!payload) {
      await ctx.reply(
        '👋 *Добро пожаловать в ReputationOS!*\n\n' +
        'Этот бот отправляет уведомления о новых отзывах и упоминаниях вашего бизнеса.\n\n' +
        'Для начала привяжите аккаунт:\n' +
        '1. Войдите в личный кабинет\n' +
        '2. Перейдите в Настройки → Профиль\n' +
        '3. Нажмите «Подключить Telegram»',
        { parse_mode: 'Markdown' },
      )
      return
    }

    await this.authService.linkAccount(chatId, payload, ctx)
  }
}

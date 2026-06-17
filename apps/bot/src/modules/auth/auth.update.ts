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
      '❓ *Справка ReputationOS*\n\n' +
      'ReputationOS — платформа мониторинга репутации бизнеса.\n\n' +
      'Бот помогает контролировать отзывы и упоминания компаний прямо в Telegram.\n\n' +
      '*Возможности:*\n\n' +
      '📊 Просмотр рейтинга компаний\n' +
      '📝 Просмотр последних отзывов\n' +
      '🤖 AI-генерация ответов на отзывы\n' +
      '🔔 Уведомления о новых отзывах\n' +
      '⚠️ Мгновенные уведомления о негативных отзывах\n' +
      '➕ Добавление компаний в мониторинг\n' +
      '🗑️ Удаление компаний\n' +
      '⚙️ Управление уведомлениями\n\n' +
      '*Источники мониторинга:*\n\n' +
      '⭐ Яндекс Карты\n' +
      '📍 2ГИС\n' +
      '🌐 Интернет и упоминания в сети\n\n' +
      'Используйте кнопки меню для управления компаниями и настройками уведомлений.',
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
        '👋 *Добро пожаловать в ReputationOS*\n\n' +
        'ReputationOS — платформа мониторинга репутации бизнеса.\n\n' +
        '*С помощью бота вы можете:*\n\n' +
        '📊 Контролировать рейтинг компаний\n' +
        '📝 Следить за новыми отзывами\n' +
        '🤖 Генерировать AI-ответы на отзывы\n' +
        '⚠️ Мгновенно узнавать о негативных отзывах\n' +
        '🔔 Настраивать уведомления\n' +
        '🏢 Добавлять и удалять компании\n\n' +
        '*Источники мониторинга:*\n\n' +
        '⭐ Яндекс Карты\n' +
        '📍 2ГИС\n' +
        '🌐 Интернет и упоминания в сети\n\n' +
        'Используйте кнопки меню внизу экрана для управления компаниями и настройками.',
        { parse_mode: 'Markdown' },
      )
      return
    }

    await this.authService.linkAccount(chatId, payload, ctx)
  }
}

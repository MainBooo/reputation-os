import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const APP_URL = 'https://reputation.generationweb.ru'

@Injectable()
export class TelegramNotificationsService {
  private readonly logger = new Logger(TelegramNotificationsService.name)
  private readonly token?: string

  constructor(private readonly config: ConfigService) {
    this.token = config.get<string>('TELEGRAM_BOT_TOKEN') || process.env.BOT_TOKEN
  }

  async sendReviewNotification(
    chatId: bigint,
    review: {
      id: string
      content: string | null
      ratingValue: number | null
      sentiment: string | null
      source: { platform: string }
      company: { name: string }
    },
  ): Promise<boolean> {
    if (!this.token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not configured, Telegram notification skipped')
      return false
    }

    const sentimentMap: Record<string, string> = {
      POSITIVE: '😊 Позитивный',
      NEGATIVE: '😞 Негативный',
      NEUTRAL: '😐 Нейтральный',
    }

    const stars = '⭐'.repeat(Math.min(5, Math.max(0, Math.round(review.ratingValue ?? 0))))
    const sentiment = sentimentMap[review.sentiment ?? ''] ?? '❓'
    const content = (review.content ?? '(без текста)').slice(0, 500)

    const text =
      `🔔 *Новый отзыв — ${this.escapeMarkdown(review.company.name)}*\n\n` +
      `${stars} ${review.source.platform} · только что\n` +
      `${this.escapeMarkdown(content)}\n\n` +
      `${sentiment}`

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId.toString(),
            text,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🤖 Сгенерировать ответ', callback_data: `ai:reply:${review.id}` },
                  {
                    text: '👁️ Открыть в кабинете',
                    url: `${APP_URL}/reviews/${review.id}`,
                  },
                ],
              ],
            },
          }),
        },
      )

      if (!res.ok) {
        const body = await res.text()
        this.logger.error(`Telegram API error: ${res.status} ${body}`)
        return false
      }

      this.logger.log(`Уведомление отправлено chatId=${chatId}, reviewId=${review.id}`)
      return true
    } catch (err) {
      this.logger.error(`Ошибка отправки уведомления в Telegram: ${err}`)
      return false
    }
  }

  private escapeMarkdown(text: string): string {
    // Экранируем только символы, ломающие Markdown v1
    return text.replace(/([_*`\[])/g, '\\$1')
  }
}

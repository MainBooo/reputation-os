import { Logger, UseGuards } from '@nestjs/common'
import { Action, Command, Ctx, Update } from 'nestjs-telegraf'
import { Context, Markup } from 'telegraf'
import { CompaniesService } from './companies.service'
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard'
import { PlanFeatureGuard } from '../../common/guards/plan-feature.guard'
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard'
import { formatDistanceToNow } from '../../common/utils/date.util'

// Простое in-memory хранилище состояния wizard (заменить на Redis при масштабировании)
const wizardState = new Map<number, { step: number; name?: string; platforms?: string[]; workspaceId?: string }>()
const deleteConfirm = new Map<number, string>() // chatId → companyId

@Update()
@UseGuards(TelegramAuthGuard, PlanFeatureGuard)
export class CompaniesUpdate {
  private readonly logger = new Logger(CompaniesUpdate.name)

  constructor(private readonly companiesService: CompaniesService) {}

  // ── /companies ──────────────────────────────────────────────
  @Command('companies')
  async onCompanies(@Ctx() ctx: Context & { state: { user: any } }) {
    const user = ctx.state.user
    const companies = await this.companiesService.getCompaniesForUser(user.id)

    if (companies.length === 0) {
      await ctx.reply(
        '📋 У вас пока нет компаний.\n\nНажмите кнопку ниже, чтобы добавить первую.',
        Markup.inlineKeyboard([
          [Markup.button.callback('➕ Добавить компанию', 'company:add')],
        ]),
      )
      return
    }

    const buttons = companies.map((c: any) => {
      const avgRating = c.mentions?.length
        ? (c.mentions.reduce((sum: number, r: any) => sum + Number(r.ratingValue ?? 0), 0) / c.mentions.length).toFixed(1)
        : '—'
      const label = `${c.name} ⭐ ${avgRating}`
      return [Markup.button.callback(label, `company:view:${c.id}`)]
    })

    buttons.push([Markup.button.callback('➕ Добавить компанию', 'company:add')])
    buttons.push([Markup.button.callback('⚙️ Настройки уведомлений', 'goto:settings')])

    await ctx.reply('📋 *Ваши компании*', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    })
  }

  // ── Просмотр компании ────────────────────────────────────────
  @Action(/^company:view:(.+)$/)
  async onViewCompany(@Ctx() ctx: Context & { state: { user: any }; match: RegExpMatchArray }) {
    await ctx.answerCbQuery()
    const companyId = ctx.match[1]
    const user = ctx.state.user

    const company = await this.companiesService.getCompanyById(companyId, user.id)
    if (!company) {
      await ctx.reply('❌ Компания не найдена.')
      return
    }

    const lastReview = company.mentions?.[0]
    const avgRating = company.mentions?.length
      ? (company.mentions.reduce((s: number, r: any) => s + Number(r.ratingValue ?? 0), 0) / company.mentions.length).toFixed(1)
      : '—'

    const lastReviewText = lastReview?.publishedAt
      ? formatDistanceToNow(lastReview.publishedAt)
      : 'нет данных'

    const text =
      `🏢 *${company.name}*\n\n` +
      `📊 Рейтинг: ⭐ ${avgRating} (${company.mentions?.length ?? 0} отз.)\n` +
      `📅 Последний отзыв: ${lastReviewText}\n` +
      `🟢 Мониторинг: активен`

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('📝 Последние отзывы', `mentions:list:${companyId}`),
          Markup.button.callback('🔔 Уведомления', `notify:company:${companyId}`),
        ],
        [
          Markup.button.callback('🗑️ Удалить', `company:delete:${companyId}`),
          Markup.button.callback('← Назад', 'companies:list'),
        ],
      ]),
    })
  }

  // ── Список компаний (кнопка «назад») ────────────────────────
  @Action('companies:list')
  async onBackToList(@Ctx() ctx: Context & { state: { user: any } }) {
    await ctx.answerCbQuery()
    await ctx.deleteMessage().catch(() => null)
    await this.onCompanies(ctx)
  }

  // ── Переход в настройки ──────────────────────────────────────
  @Action('goto:settings')
  async onGotoSettings(@Ctx() ctx: Context) {
    await ctx.answerCbQuery()
    await ctx.reply('Введите /settings для управления уведомлениями.')
  }

  // ── Добавить компанию: шаг 1 ─────────────────────────────────
  @Action('company:add')
  async onAddCompany(@Ctx() ctx: Context & { state: { user: any } }) {
    await ctx.answerCbQuery()
    const chatId = ctx.from!.id

    // Определяем workspaceId (первый workspace пользователя с ролью OWNER/ADMIN)
    const member = ctx.state.user?.workspaceMembers?.find((m: any) =>
      ['OWNER', 'ADMIN'].includes(m.role),
    )

    if (!member) {
      await ctx.reply('⛔ У вас нет прав для добавления компаний.')
      return
    }

    wizardState.set(chatId, { step: 1, workspaceId: member.workspaceId })
    await ctx.reply('📝 *Добавление компании*\n\nШаг 1/3: Введите название компании', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'company:wizard:cancel')]]),
    })
  }

  // ── Wizard: обработка текстового ввода ──────────────────────
  // Этот хендлер подключается через on('text') в bot.module
  // Здесь — шаги 2 и 3 через callback_query, текст ловим в on('text')
  @Action(/^company:platforms:(.+)$/)
  async onSelectPlatform(@Ctx() ctx: Context & { state: { user: any }; match: RegExpMatchArray }) {
    await ctx.answerCbQuery()
    const chatId = ctx.from!.id
    const platform = ctx.match[1]
    const state = wizardState.get(chatId)

    if (!state || state.step !== 2) return

    const platforms = state.platforms ?? []
    const idx = platforms.indexOf(platform)
    if (idx >= 0) {
      platforms.splice(idx, 1)
    } else {
      platforms.push(platform)
    }

    wizardState.set(chatId, { ...state, platforms })
    await this.showPlatformStep(ctx, platforms)
  }

  @Action('company:wizard:platforms:next')
  async onPlatformsNext(@Ctx() ctx: Context) {
    await ctx.answerCbQuery()
    const chatId = ctx.from!.id
    const state = wizardState.get(chatId)

    if (!state || state.step !== 2) return
    if (!state.platforms?.length) {
      await ctx.answerCbQuery('Выберите хотя бы одну платформу', { show_alert: true })
      return
    }

    wizardState.set(chatId, { ...state, step: 3 })
    await ctx.editMessageText(
      '📝 *Добавление компании*\n\nШаг 3/3: Введите URL компании на Яндекс Картах\n(или нажмите «Пропустить»)',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Пропустить →', 'company:wizard:skip_url')],
          [Markup.button.callback('❌ Отмена', 'company:wizard:cancel')],
        ]),
      },
    )
  }

  @Action('company:wizard:skip_url')
  async onSkipUrl(@Ctx() ctx: Context & { state: { user: any } }) {
    await ctx.answerCbQuery()
    await this.finishWizard(ctx, undefined)
  }

  @Action('company:wizard:cancel')
  async onCancelWizard(@Ctx() ctx: Context) {
    await ctx.answerCbQuery()
    wizardState.delete(ctx.from!.id)
    await ctx.editMessageText('❌ Добавление компании отменено.')
  }

  // ── Удаление компании: запрос подтверждения ─────────────────
  @Action(/^company:delete:(.+)$/)
  @UseGuards(WorkspaceRoleGuard)
  async onDeleteCompanyConfirm(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    await ctx.answerCbQuery()
    const companyId = ctx.match[1]
    deleteConfirm.set(ctx.from!.id, companyId)

    // Получаем название
    const company = await (this.companiesService as any).prisma.company.findUnique({
      where: { id: companyId },
    })

    await ctx.editMessageText(
      `⚠️ *Удалить «${company?.name ?? companyId}»?*\n\nВсе данные будут потеряны безвозвратно.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Да, удалить', `company:delete:confirm:${companyId}`),
            Markup.button.callback('❌ Отмена', `company:view:${companyId}`),
          ],
        ]),
      },
    )
  }

  @Action(/^company:delete:confirm:(.+)$/)
  async onDeleteCompanyExecute(
    @Ctx() ctx: Context & { state: { user: any }; match: RegExpMatchArray },
  ) {
    await ctx.answerCbQuery()
    const companyId = ctx.match[1]
    const user = ctx.state.user

    const ok = await this.companiesService.deleteCompany(companyId, user.id)
    deleteConfirm.delete(ctx.from!.id)

    if (ok) {
      await ctx.editMessageText('✅ Компания успешно удалена.')
    } else {
      await ctx.editMessageText('❌ Не удалось удалить компанию. Проверьте права доступа.')
    }
  }

  // ── Последние отзывы ─────────────────────────────────────────
  @Action(/^mentions:list:(.+)$/)
  async onReviewsList(@Ctx() ctx: Context & { state: { user: any }; match: RegExpMatchArray }) {
    await ctx.answerCbQuery()
    const companyId = ctx.match[1]
    const user = ctx.state.user

    const reviews = await this.companiesService.getRecentMentions(companyId, user.id, 5)

    if (!reviews.length) {
      await ctx.editMessageText('📭 Отзывов пока нет.', {
        ...Markup.inlineKeyboard([[Markup.button.callback('← Назад', `company:view:${companyId}`)]]),
      })
      return
    }

    const sentimentMap: Record<string, string> = {
      POSITIVE: '😊 Позитивный',
      NEGATIVE: '😞 Негативный',
      NEUTRAL: '😐 Нейтральный',
    }

    const lines: string[] = [`📝 *Последние отзывы*\n`]
    const aiButtons: any[][] = []

    for (const r of reviews) {
      const stars = '⭐'.repeat(Math.round(Number(r.ratingValue ?? 0)))
      const when = r.publishedAt ? formatDistanceToNow(r.publishedAt) : 'дата неизвестна'
      const platform = r.source?.platform ?? 'Источник'
      const sentiment = sentimentMap[r.sentiment ?? ''] ?? '❓'
      const content = (r.content ?? '(без текста)').slice(0, 200)

      lines.push(`${stars} ${platform} · ${when}\n${content}\n${sentiment}\n`)

      if (r.sentiment === 'NEGATIVE') {
        aiButtons.push([Markup.button.callback(`🤖 AI-ответ на отзыв`, `ai:reply:${r.id}`)])
      }
    }

    aiButtons.push([Markup.button.callback('← Назад', `company:view:${companyId}`)])

    await ctx.editMessageText(lines.join('\n'), {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(aiButtons),
    })
  }

  // ── AI-ответ на отзыв ────────────────────────────────────────
  @Action(/^ai:reply:(.+)$/)
  async onAiReply(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    await ctx.answerCbQuery('Генерирую ответ...')
    const mentionId = ctx.match[1]

    const text = await this.companiesService.generateAiReply(mentionId)

    await ctx.reply(
      `🤖 *AI-черновик ответа:*\n\n${text}`,
      { parse_mode: 'Markdown' },
    )
  }

  // ── Helpers ──────────────────────────────────────────────────
  private async showPlatformStep(ctx: Context, selected: string[]) {
    const platforms = [
      { key: 'YANDEX_MAPS', label: 'Яндекс Карты' },
      { key: 'TWOGIS', label: '2ГИС' },
      { key: 'WEB', label: 'Веб-поиск' },
    ]

    const buttons = platforms.map((p) => {
      const isSelected = selected.includes(p.key)
      return [Markup.button.callback(
        `${isSelected ? '✅' : '☐'} ${p.label}`,
        `company:platforms:${p.key}`,
      )]
    })

    buttons.push([Markup.button.callback('Далее →', 'company:wizard:platforms:next')])
    buttons.push([Markup.button.callback('❌ Отмена', 'company:wizard:cancel')])

    const text = '📝 *Добавление компании*\n\nШаг 2/3: Выберите платформы для мониторинга'

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      })
    } catch {
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      })
    }
  }

  async finishWizard(ctx: Context & { state?: { user?: any } }, yandexUrl?: string) {
    const chatId = ctx.from!.id
    const state = wizardState.get(chatId)

    if (!state?.name || !state.platforms?.length || !state.workspaceId) {
      await ctx.reply('❌ Ошибка: данные формы потеряны. Начните заново с /companies.')
      wizardState.delete(chatId)
      return
    }

    const user = ctx.state?.user
    const company = await this.companiesService.createCompany({
      name: state.name,
      platforms: state.platforms,
      yandexUrl,
      userId: user?.id,
      workspaceId: state.workspaceId,
    })

    wizardState.delete(chatId)

    await ctx.reply(
      `✅ Компания *«${company.name}»* добавлена!\n\nМониторинг запущен. Первые отзывы появятся в течение нескольких часов.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📋 К списку компаний', 'companies:list')],
        ]),
      },
    )
  }

  getWizardState(chatId: number) {
    return wizardState.get(chatId)
  }

  setWizardState(chatId: number, data: any) {
    wizardState.set(chatId, data)
  }
}

import { Logger, UseGuards } from '@nestjs/common'
import { Action, Command, Ctx, Update } from 'nestjs-telegraf'
import { Context, Markup } from 'telegraf'
import { SettingsService } from './settings.service'
import { AuthService } from '../auth/auth.service'
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard'
import { PlanFeatureGuard } from '../../common/guards/plan-feature.guard'

const EVENT_TYPES = [
  { key: 'NEW_REVIEW', label: 'Новые отзывы' },
  { key: 'NEW_MENTION', label: 'Упоминания' },
  { key: 'NEGATIVE_REVIEW', label: 'Негативные отзывы' },
  { key: 'POSITIVE_REVIEW', label: 'Позитивные отзывы' },
]

@Update()
@UseGuards(TelegramAuthGuard)
export class SettingsUpdate {
  private readonly logger = new Logger(SettingsUpdate.name)

  constructor(
    private readonly settingsService: SettingsService,
    private readonly authService: AuthService,
  ) {}

  // ── /settings ────────────────────────────────────────────────
  @Command('settings')
  @UseGuards(PlanFeatureGuard)
  async onSettings(@Ctx() ctx: Context & { state: { user: any } }) {
    const user = ctx.state.user
    const member = user.workspaceMembers?.[0]
    const workspaceId = member?.workspaceId ?? ""
    const rules = await this.settingsService.getNotificationRules(workspaceId)
    const activeTypes = new Set(rules.map((r: any) => r.type))

    const companies = user.workspaceMembers?.flatMap((m: any) => m.workspace?.companies ?? []) ?? []

    const eventButtons = EVENT_TYPES.map((e) =>
      [Markup.button.callback(
        `${activeTypes.has(e.key) ? '✅' : '❌'} ${e.label}`,
        `settings:toggle:event:${e.key}`,
      )],
    )

    const companyButtons = companies.slice(0, 5).map((c: any) =>
      [Markup.button.callback(`✅ ${c.name}`, `settings:toggle:company:${c.id}`)],
    )

    const keyboard = [
      ...eventButtons,
      ...companyButtons,
      [Markup.button.callback('🔕 Отключить всё', 'settings:disable:all')],
    ]

    await ctx.reply('⚙️ *Настройки уведомлений*\n\nПолучать уведомления о:', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(keyboard),
    })
  }

  @Action(/^settings:toggle:event:(.+)$/)
  async onToggleEvent(@Ctx() ctx: Context & { state: { user: any }; match: RegExpMatchArray }) {
    await ctx.answerCbQuery()
    const user = ctx.state.user
    const eventType = ctx.match[1]

    // Применяем ко всем компаниям пользователя
    const companies = user.workspaceMembers?.flatMap((m: any) => m.workspace?.companies ?? []) ?? []

    for (const c of companies) {
      await this.settingsService.toggleRule(user.workspaceMembers?.[0]?.workspaceId ?? "", eventType)
    }

    await ctx.answerCbQuery('✅ Настройка сохранена', { show_alert: false })
    // Обновляем меню
    await ctx.deleteMessage().catch(() => null)
    await this.onSettings(ctx)
  }

  @Action('settings:disable:all')
  async onDisableAll(@Ctx() ctx: Context & { state: { user: any } }) {
    await ctx.answerCbQuery()
    await this.settingsService.disableAll(ctx.state.user.workspaceMembers?.[0]?.workspaceId ?? "")
    await ctx.editMessageText('🔕 Все уведомления отключены.\n\nВключить снова: /settings')
  }

  // ── /me ──────────────────────────────────────────────────────
  @Command('me')
  async onMe(@Ctx() ctx: Context & { state: { user: any } }) {
    const user = ctx.state.user
    const member = user.workspaceMembers?.[0]
    const workspace = member?.workspace
    const plan = workspace?.subscription?.plan

    const roleMap: Record<string, string> = {
      OWNER: 'Владелец',
      ADMIN: 'Администратор',
      MEMBER: 'Участник',
      VIEWER: 'Наблюдатель',
    }

    const text =
      `👤 *Ваш аккаунт*\n\n` +
      `Email: ${user.email}\n` +
      `Workspace: ${workspace?.name ?? '—'}\n` +
      `Роль: ${roleMap[member?.role] ?? member?.role ?? '—'}\n` +
      `Тариф: ${plan?.name ?? '—'}\n` +
      `Telegram: ✅ привязан`

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔓 Отвязать Telegram', 'settings:unlink')],
      ]),
    })
  }

  @Action('settings:unlink')
  async onUnlink(@Ctx() ctx: Context & { state: { user: any } }) {
    await ctx.answerCbQuery()
    await ctx.editMessageText(
      '⚠️ *Отвязать Telegram?*\n\nВы перестанете получать уведомления в этом чате.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Да, отвязать', 'settings:unlink:confirm'),
            Markup.button.callback('❌ Отмена', 'settings:unlink:cancel'),
          ],
        ]),
      },
    )
  }

  @Action('settings:unlink:confirm')
  async onUnlinkConfirm(@Ctx() ctx: Context & { state: { user: any } }) {
    await ctx.answerCbQuery()
    await this.authService.unlinkAccount(ctx.state.user.id)
    await ctx.editMessageText(
      '✅ Telegram успешно отвязан.\n\nДля повторной привязки перейдите в личный кабинет: Настройки → Профиль.',
    )
  }

  @Action('settings:unlink:cancel')
  async onUnlinkCancel(@Ctx() ctx: Context) {
    await ctx.answerCbQuery()
    await ctx.deleteMessage().catch(() => null)
  }

}

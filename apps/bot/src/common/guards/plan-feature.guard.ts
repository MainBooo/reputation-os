import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { TelegrafExecutionContext } from 'nestjs-telegraf'
import { Context } from 'telegraf'

const BILLING_URL = 'https://reputation.generationweb.ru/billing'

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  private readonly logger = new Logger(PlanFeatureGuard.name)

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const telegrafCtx = TelegrafExecutionContext.create(context)
    const ctx = telegrafCtx.getContext<Context & { state: { user: any } }>()
    const user = ctx.state?.user

    // Проверяем хотя бы один workspace с планом, разрешающим telegramNotifications
    const hasAccess = user?.workspaceMembers?.some((m: any) => {
      const limits = m.workspace?.plan?.limits as Record<string, any> | null
      return limits?.telegramNotifications === true
    })

    if (!hasAccess) {
      this.logger.warn(`chatId ${ctx.from?.id}: нет доступа к Telegram-уведомлениям по тарифу`)
      await ctx.reply(
        '⛔ Telegram-уведомления недоступны на вашем тарифе.\n\n' +
        `Обновите подписку: ${BILLING_URL}`,
      )
      return false
    }

    return true
  }
}

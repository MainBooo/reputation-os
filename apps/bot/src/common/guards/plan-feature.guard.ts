import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { TelegrafExecutionContext } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { hasTelegramNotificationEntitlement } from '../telegram-entitlement'

const BILLING_URL = 'https://reputation.generationweb.ru/billing'

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  private readonly logger = new Logger(PlanFeatureGuard.name)

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const telegrafCtx = TelegrafExecutionContext.create(context)
    const ctx = telegrafCtx.getContext<Context & { state: { user: any } }>()
    const user = ctx.state?.user

    const hasAccess = hasTelegramNotificationEntitlement(user?.workspaceMembers)

    if (!hasAccess) {
      this.logger.warn('Telegram command rejected: feature is unavailable for active workspaces')
      await ctx.reply(
        '⛔ Telegram-уведомления недоступны на вашем тарифе.\n\n' +
        `Обновите подписку: ${BILLING_URL}`,
      )
      return false
    }

    return true
  }
}

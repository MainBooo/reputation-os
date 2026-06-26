import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { TelegrafExecutionContext } from 'nestjs-telegraf'
import { Context } from 'telegraf'

export const REQUIRED_ROLES_KEY = 'requiredRoles'

/** Декоратор для указания допустимых ролей */
export const RequireRoles = (...roles: string[]) =>
  Reflect.metadata(REQUIRED_ROLES_KEY, roles)

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  private readonly logger = new Logger(WorkspaceRoleGuard.name)

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required: string[] = this.reflector.get(REQUIRED_ROLES_KEY, context.getHandler()) ?? []
    if (required.length === 0) return true

    const telegrafCtx = TelegrafExecutionContext.create(context)
    const ctx = telegrafCtx.getContext<Context & { state: { user: any } }>()
    const user = ctx.state?.user

    if (!user?.workspaceMembers?.length) {
      await ctx.reply('❌ Вы не состоите ни в одном рабочем пространстве.')
      return false
    }

    const hasRole = user.workspaceMembers.some((m: any) => required.includes(m.role))
    if (!hasRole) {
      await ctx.reply('⛔ Недостаточно прав для этого действия.')
      return false
    }

    return true
  }
}

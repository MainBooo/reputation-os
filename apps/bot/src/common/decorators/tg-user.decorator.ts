import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { TelegrafExecutionContext } from 'nestjs-telegraf'
import { Context } from 'telegraf'

export const TgUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const telegrafCtx = TelegrafExecutionContext.create(ctx)
    const context = telegrafCtx.getContext<Context & { state: { user: any } }>()
    return context.state?.user ?? null
  },
)

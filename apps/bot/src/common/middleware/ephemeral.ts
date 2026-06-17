import type { Context, MiddlewareFn } from 'telegraf'

// Удаляет входящее сообщение пользователя (команды, ввод визарда) в личном чате
// после отработки хендлера. Уведомления об отзывах шлёт воркер из другого процесса.
export const dropIncoming: MiddlewareFn<Context> = async (ctx, next) => {
  await next()
  const chatId = ctx.chat?.id
  const messageId = (ctx.message as any)?.message_id
  if (ctx.chat?.type === 'private' && chatId && messageId) {
    await ctx.telegram.deleteMessage(chatId, messageId).catch(() => {})
  }
}

// Каждый трекер получает express Request и возвращает ключ, по которому
// AppThrottlerGuard считает попытки в Redis. generateKey() гарда уже
// хэширует ключ вместе с именем контроллера/метода, поэтому здесь не нужно
// вручную намешивать префикс эндпоинта — коллизий между разными роутами нет.

function clientIp(req: Record<string, any>): string {
  return req.ip || req.ips?.[0] || 'unknown-ip'
}

/** IP клиента (register, reset-password — лимит не должен зависеть от email/данных в теле). */
export function ipTracker(req: Record<string, any>): string {
  return clientIp(req)
}

/** IP + email из тела запроса (login, forgot-password). */
export function ipAndEmailTracker(req: Record<string, any>): string {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'no-email'
  return `${clientIp(req)}:${email}`
}

/** userId из JWT (требует, чтобы JwtAuthGuard шёл ПЕРЕД AppThrottlerGuard в @UseGuards). */
export function userTracker(req: Record<string, any>): string {
  return req.user?.id ?? clientIp(req)
}

/** userId + workspaceId из тела запроса (создание компании). */
export function userAndWorkspaceTracker(req: Record<string, any>): string {
  const workspaceId = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : 'no-workspace'
  return `${req.user?.id ?? clientIp(req)}:${workspaceId}`
}

/** userId + companyId из параметра маршрута (discover-sources). */
export function userAndCompanyTracker(req: Record<string, any>): string {
  const companyId = req.params?.id ?? 'no-company'
  return `${req.user?.id ?? clientIp(req)}:${companyId}`
}

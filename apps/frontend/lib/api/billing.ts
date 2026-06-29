import { apiFetch } from './client'

// ─── Shared types ──────────────────────────────────────────────────────────

export interface PlanLimits {
  maxCompanies: number
  maxAiRepliesPerMonth: number // -1 = безлимит
  platforms: string[]
  telegramNotifications: boolean
  advancedAnalytics: boolean
  webMonitoringEnabled?: boolean
  pushNotificationsEnabled?: boolean
  maxSources?: number
  maxMembers?: number
  maxWebPages?: number
}

export interface BillingPlan {
  code: string
  name: string
  priceMonthly: number
  priceYearly?: number | null
  limits: PlanLimits
}

export interface BillingEntitlements {
  workspaceId: string
  planCode: string
  planName: string
  priceMonthly: number
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  trialEndsAt?: string | null
  workspaceActive: boolean
  effective: PlanLimits
  limits: PlanLimits
  usage: {
    companiesCount: number
    aiRepliesThisMonth: number
  }
}

export function isSubscriptionActive(ent: BillingEntitlements | null): boolean {
  if (!ent) return false
  const s = ent.subscriptionStatus
  return s === 'ACTIVE' || s === 'MANUAL' || s === 'TRIAL'
}

export function getTrialDaysLeft(ent: BillingEntitlements | null): number | null {
  if (!ent || ent.subscriptionStatus !== 'TRIAL' || !ent.trialEndsAt) return null
  const ms = new Date(ent.trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

export function getPlanBadgeLabel(ent: BillingEntitlements | null): string {
  if (!ent || !isSubscriptionActive(ent)) return 'Нет тарифа'
  if (ent.subscriptionStatus === 'TRIAL') {
    const days = getTrialDaysLeft(ent)
    if (days === null) return 'Триал'
    if (days === 0) return 'Триал: сегодня'
    if (days === 1) return 'Триал: 1 день'
    return `Триал: ${days} дн.`
  }
  return ent.planName || ent.planCode || 'Нет тарифа'
}

export interface CheckoutResult {
  confirmationUrl: string
  paymentId: string
}

export interface AdminBillingWorkspace {
  id: string
  name: string
  slug: string
  planCode: string
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  overrides: Record<string, unknown>
}

// ─── User-facing ───────────────────────────────────────────────────────────

/** GET /billing/plans — публичный, без авторизации */
export function getBillingPlans() {
  return apiFetch<BillingPlan[]>('/billing/plans', undefined, [])
}

/** GET /billing/entitlements — текущий тариф + usage текущего пользователя */
export function getMyEntitlements() {
  return apiFetch<BillingEntitlements | null>('/billing/entitlements', undefined, null)
}

/** POST /billing/yookassa/create-payment — создаёт платёж через ЮKassa, возвращает confirmationUrl */
export function createCheckout(planCode: string, period: 'monthly' | 'yearly' = 'monthly') {
  return apiFetch<CheckoutResult>('/billing/yookassa/create-payment', {
    method: 'POST',
    body: JSON.stringify({ planCode, period }),
  })
}

/** POST /billing/yookassa/sync — синхронизирует PENDING-платежи с ЮKassa (вызывать при открытии биллинга) */
export function syncPendingPayments() {
  return apiFetch<{ synced: number }>('/billing/yookassa/sync', { method: 'POST' })
}

// ─── Admin ─────────────────────────────────────────────────────────────────

/** GET /admin/billing/workspaces — только SUPER_ADMIN */
export function getAdminBillingWorkspaces() {
  return apiFetch<AdminBillingWorkspace[]>('/admin/billing/workspaces', undefined, [])
}

/** GET /admin/billing/plans — все планы включая неактивные */
export function getAdminBillingPlans() {
  return apiFetch<BillingPlan[]>('/admin/billing/plans', undefined, [])
}

/** PATCH /admin/billing/workspaces/:id/subscription */
export function adminUpdateSubscription(
  workspaceId: string,
  payload: { planCode: string; status?: string; currentPeriodEnd?: string | null },
) {
  return apiFetch(`/admin/billing/workspaces/${workspaceId}/subscription`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

/** PUT /admin/billing/workspaces/:id/overrides */
export function adminSetOverride(
  workspaceId: string,
  payload: { feature: string; value: unknown },
) {
  return apiFetch(`/admin/billing/workspaces/${workspaceId}/overrides`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

import { apiFetch } from './client'

// ─── Shared types ──────────────────────────────────────────────────────────

export interface PlanLimits {
  maxCompanies: number
  maxAiRepliesPerMonth: number // -1 = безлимит
  platforms: string[]
  telegramNotifications: boolean
  advancedAnalytics: boolean
}

export interface BillingPlan {
  code: string
  name: string
  priceMonthly: number
  limits: PlanLimits
}

export interface BillingEntitlements {
  planCode: string
  planName: string
  effective: PlanLimits
  usage: {
    companiesCount: number
    aiRepliesThisMonth: number
  }
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

/** POST /billing/checkout — создаёт платёж, возвращает confirmationUrl */
export function createCheckout(planCode: string) {
  return apiFetch<CheckoutResult>('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ planCode }),
  })
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

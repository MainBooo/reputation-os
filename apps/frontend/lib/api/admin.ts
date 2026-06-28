import { apiFetch } from './client'

export type AdminSystemRole = 'USER' | 'SUPER_ADMIN'

export interface AdminOverview {
  users: {
    total: { value: number; scope: string }
    active: { value: number; scope: string }
    disabled: { value: number; scope: string }
    newLast30d: { value: number; scope: string }
  }
  workspaces: {
    total: { value: number; scope: string }
    active: { value: number; scope: string }
  }
  companies: { total: { value: number; scope: string } }
  mentions: {
    allTime: { value: number; scope: string }
    last30d: { value: number; scope: string }
    last24h: { value: number; scope: string }
    negativeLast24h: { value: number; scope: string }
  }
  averageRating: { value: number | null; scope: string }
  failedJobsLast24h: { value: number; scope: string }
}

export interface AdminUser {
  id: string
  email: string
  fullName: string | null
  isActive: boolean
  systemRole: AdminSystemRole
  lastLoginAt: string | null
  createdAt: string
  telegramConnected: boolean
  pushConnected: boolean
  workspaceMembers: Array<{
    id: string
    role: string
    workspace: { id: string; name: string; slug: string }
  }>
}

export interface AdminWorkspace {
  id: string
  name: string
  slug: string
  isActive: boolean
  createdAt: string
  owner: { id: string; email: string; fullName: string | null } | null
  membersCount: number
  companiesCount: number
  sourcesCount: number
  planCode: string
  planName: string
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  overridesCount: number
}

export interface AdminBillingRow {
  id: string
  name: string
  slug: string
  isActive: boolean
  owner: { id: string; email: string; fullName: string | null } | null
  membersCount: number
  companiesCount: number
  sourcesCount: number
  planCode: string
  planName: string
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  adminNote: string | null
  updatedByAdmin: { id: string; email: string } | null
  overrides: Record<string, unknown>
}

export interface AuditLogItem {
  id: string
  actorUserId: string | null
  actorEmail: string | null
  action: string
  entityType: string
  entityId: string | null
  workspaceId: string | null
  targetUserId: string | null
  beforeJson: unknown
  afterJson: unknown
  createdAt: string
  actorUser: { id: string; email: string; fullName: string | null } | null
  targetUser: { id: string; email: string; fullName: string | null } | null
  workspace: { id: string; name: string; slug: string } | null
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface SystemHealth {
  api: { status: string }
  database: { status: string; reason?: string }
  redis: { status: string; reason?: string }
  queues: Record<string, { status: string; waiting?: number; active?: number; completed?: number; failed?: number; delayed?: number; reason?: string }>
  failedJobs: { count: number; window: string }
  lastSync: { lastSyncedAt: string | null; company?: string; lastJobAt?: string | null; lastJobQueue?: string }
  worker: { status: string; reason?: string; lastHeartbeatAgo?: number }
  telegram: { status: string; reason?: string }
  push: { status: string; reason?: string }
}

export interface WorkspaceBillingUpdate {
  planCode?: string
  status?: string
  currentPeriodEnd?: string
  trialEndsAt?: string
  maxCompanies?: number
  maxSources?: number
  maxMembers?: number
  maxAiRepliesPerMonth?: number
  maxWebPages?: number
  webMonitoringEnabled?: boolean
  telegramNotificationsEnabled?: boolean
  pushNotificationsEnabled?: boolean
  adminNote?: string
}

// ─── API calls ───────────────────────────────────────────────────────────────

export function getAdminOverview() {
  return apiFetch<AdminOverview>('/admin/overview')
}

export function getAdminUsers(params?: Record<string, string>) {
  const q = params && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''
  return apiFetch<Paginated<AdminUser>>(`/admin/users${q}`)
}

export function updateAdminUser(userId: string, payload: { isActive?: boolean; systemRole?: AdminSystemRole }) {
  return apiFetch(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function updateUserRole(userId: string, systemRole: AdminSystemRole) {
  return apiFetch(`/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ systemRole }) })
}

export function updateUserStatus(userId: string, isActive: boolean) {
  return apiFetch(`/admin/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) })
}

export function getAdminWorkspaces(params?: Record<string, string>) {
  const q = params && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''
  return apiFetch<Paginated<AdminWorkspace>>(`/admin/workspaces${q}`)
}

export function updateWorkspaceStatus(workspaceId: string, isActive: boolean) {
  return apiFetch(`/admin/workspaces/${workspaceId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) })
}

export function getAdminBilling() {
  return apiFetch<AdminBillingRow[]>('/admin/billing', undefined, [])
}

export function updateWorkspaceBilling(workspaceId: string, payload: WorkspaceBillingUpdate) {
  return apiFetch(`/admin/workspaces/${workspaceId}/billing`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function getAuditLogs(params?: Record<string, string>) {
  const q = params && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''
  return apiFetch<Paginated<AuditLogItem>>(`/admin/audit-logs${q}`)
}

export function getSystemHealth() {
  return apiFetch<SystemHealth>('/admin/system-health')
}

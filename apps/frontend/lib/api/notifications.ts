import { apiFetch } from './client'

export interface AppNotification {
  id: string
  type: string
  title: string
  body?: string | null
  data?: any
  readAt?: string | null
  createdAt: string
}

export interface NotificationsResponse {
  items: AppNotification[]
  unreadCount: number
}

export async function getNotifications() {
  return apiFetch<NotificationsResponse>('/notifications')
}

export async function markNotificationRead(id: string) {
  return apiFetch(`/notifications/${id}/read`, {
    method: 'PATCH'
  })
}

export async function markAllNotificationsRead() {
  return apiFetch('/notifications/read-all', {
    method: 'POST'
  })
}

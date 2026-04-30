import { apiFetch } from './client'

export function getWebPushPublicKey() {
  return apiFetch<{ publicKey: string }>('/push/public-key')
}

export function subscribeWebPush(payload: {
  workspaceId: string
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  alertSentiments?: string[]
  userAgent?: string
}) {
  return apiFetch('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function unsubscribeWebPush(payload: { endpoint: string }) {
  return apiFetch('/push/unsubscribe', {
    method: 'DELETE',
    body: JSON.stringify(payload)
  })
}

export function sendTestWebPush(payload: { workspaceId?: string }) {
  return apiFetch<{ ok: boolean; subscriptions: number; sent: number; failed: number }>('/push/test', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}


export function getWebPushSubscriptions() {
  return apiFetch<{
    data: Array<{
      id: string
      workspaceId: string
      alertSentiments?: string[] | null
      lastAlertCheckedAt?: string | null
      updatedAt?: string
    }>
  }>('/push/subscriptions')
}

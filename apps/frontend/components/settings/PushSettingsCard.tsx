'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { getWorkspaces } from '@/lib/api/companies'
import { getWebPushPublicKey, getWebPushSubscriptions, sendTestWebPush, subscribeWebPush, unsubscribeWebPush } from '@/lib/api/push'

type Workspace = {
  id: string
  name: string
}

const SENTIMENT_OPTIONS = [
  { value: 'NEGATIVE', label: 'Негативные' },
  { value: 'POSITIVE', label: 'Позитивные' },
  { value: 'NEUTRAL', label: 'Нейтральные' }
]

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

function normalizeAlertSentiments(value: unknown) {
  const list = Array.isArray(value) ? value : []
  const allowed = SENTIMENT_OPTIONS.map((item) => item.value)
  const filtered = list.filter((item): item is string => typeof item === 'string' && allowed.includes(item))

  return filtered.length ? filtered : ['NEGATIVE']
}

function getPushSupportLabel() {
  if (typeof window === 'undefined') return 'Проверка поддержки...'
  if (!('serviceWorker' in navigator)) return 'Service Worker не поддерживается'
  if (!('PushManager' in window)) return 'Push API не поддерживается'
  if (!('Notification' in window)) return 'Notifications API не поддерживается'
  return 'Push поддерживается'
}

export default function PushSettingsCard() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [permission, setPermission] = useState<string>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [supportLabel, setSupportLabel] = useState('Проверка поддержки...')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [alertSentiments, setAlertSentiments] = useState<string[]>(['NEGATIVE'])

  const canUsePush = useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  }, [])

  useEffect(() => {
    setSupportLabel(getPushSupportLabel())

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }

    getWorkspaces()
      .then((data: Workspace[]) => {
        const list = Array.isArray(data) ? data : []
        setWorkspaces(list)
        if (list[0]?.id) setWorkspaceId(list[0].id)
      })
      .catch(() => null)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('/sw.js')
        .then(async (registration) => {
          const activeRegistration = registration || await navigator.serviceWorker.getRegistration()
          const subscription = await activeRegistration?.pushManager.getSubscription()
          setSubscribed(Boolean(subscription))
        })
        .catch(() => null)
    }
  }, [])

  useEffect(() => {
    if (!workspaceId) return

    getWebPushSubscriptions()
      .then((result) => {
        const list = Array.isArray(result?.data) ? result.data : []
        const current = list.find((item) => item.workspaceId === workspaceId) || list[0]

        if (current?.alertSentiments) {
          setAlertSentiments(normalizeAlertSentiments(current.alertSentiments))
        }
      })
      .catch(() => null)
  }, [workspaceId])

  function toggleSentiment(value: string) {
    setAlertSentiments((current) => {
      if (current.includes(value)) {
        const next = current.filter((item) => item !== value)
        return next.length ? next : current
      }

      return [...current, value]
    })
  }

  async function enablePush() {
    if (!canUsePush) {
      setMessage('Этот браузер не поддерживает web push.')
      return
    }

    if (!workspaceId) {
      setMessage('Не найдено рабочее пространство для подписки.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const permissionResult = await Notification.requestPermission()
      setPermission(permissionResult)

      if (permissionResult !== 'granted') {
        setMessage('Разрешение на уведомления не выдано.')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const existing = await registration.pushManager.getSubscription()
      if (existing) {
        await existing.unsubscribe().catch(() => null)
      }

      const { publicKey } = await getWebPushPublicKey()
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      })

      const json = subscription.toJSON()

      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('Push subscription is incomplete')
      }

      await subscribeWebPush({
        workspaceId,
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth
        },
        alertSentiments,
        userAgent: navigator.userAgent
      })

      setSubscribed(true)
      setMessage('Push-уведомления включены. Настройки тональности сохранены.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось включить push-уведомления.')
    } finally {
      setLoading(false)
    }
  }

  async function disablePush() {
    setLoading(true)
    setMessage('')

    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js') || await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()

      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe().catch(() => null)
        await unsubscribeWebPush({ endpoint }).catch(() => null)
      }

      setSubscribed(false)
      setMessage('Push-уведомления отключены на этом устройстве.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось отключить push-уведомления.')
    } finally {
      setLoading(false)
    }
  }

  async function sendTest() {
    setLoading(true)
    setMessage('')

    try {
      const result = await sendTestWebPush({ workspaceId: workspaceId || undefined })
      setMessage(`Тест отправлен: ${result.sent}/${result.subscriptions}. Ошибок: ${result.failed}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось отправить тестовый push.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="text-base font-semibold text-brand">Push-уведомления</div>
      <div className="mt-2 text-sm leading-6 text-muted">
        Получайте уведомления о новых отзывах по выбранной тональности. На iPhone сайт должен быть открыт как PWA с экрана “Домой”.
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">Поддержка браузера</span>
          <span className="text-brand">{supportLabel}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">Разрешение</span>
          <span className="text-brand">{permission}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">Статус</span>
          <span className={subscribed ? 'text-emerald-300' : 'text-muted'}>
            {subscribed ? 'Включено' : 'Не включено'}
          </span>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.16em] text-muted">Оповещать о</div>
          <div className="grid gap-2">
            {SENTIMENT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-panel/50 px-3 py-2"
              >
                <span className="text-brand">{option.label}</span>
                <input
                  type="checkbox"
                  checked={alertSentiments.includes(option.value)}
                  onChange={() => toggleSentiment(option.value)}
                  className="h-5 w-5 accent-emerald-400"
                />
              </label>
            ))}
          </div>
        </div>

        {workspaces.length > 1 ? (
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-muted">Workspace</span>
            <select
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm text-brand outline-none"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {message ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-muted">
          {message}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={enablePush} disabled={loading || !canUsePush}>
          {loading ? 'Подождите...' : subscribed ? 'Обновить подписку' : 'Включить push'}
        </Button>

        <Button type="button" variant="secondary" onClick={sendTest} disabled={loading || !subscribed}>
          Тест push
        </Button>

        <Button type="button" variant="ghost" onClick={disablePush} disabled={loading || !subscribed}>
          Отключить
        </Button>
      </div>
    </Card>
  )
}

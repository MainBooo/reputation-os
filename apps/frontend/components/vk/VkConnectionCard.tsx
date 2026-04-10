'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { disconnectVk, startVkConnect } from '@/lib/api/vk'

type VkSessionState = {
  connected: boolean
  updatedAt?: string | null
}

export default function VkConnectionCard({
  companyId,
  session,
  sessionError
}: {
  companyId: string
  session: VkSessionState | null
  sessionError?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const statusUnavailable = !session && Boolean(sessionError)
  const connected = session?.connected === true

  async function onConnect() {
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const started = await startVkConnect(companyId)
      if (!started?.attemptToken) {
        throw new Error('Не удалось запустить VK connect flow')
      }

      router.push(`/companies/${companyId}/vk/connect?attemptToken=${encodeURIComponent(started.attemptToken)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось запустить подключение VK')
    } finally {
      setLoading(false)
    }
  }

  async function onDisconnect() {
    setLoading(true)
    setMessage('')
    setError('')

    try {
      await disconnectVk(companyId)
      setMessage('VK отключён')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отключить VK')
    } finally {
      setLoading(false)
    }
  }

  function onRefreshStatus() {
    setMessage('')
    setError('')
    router.refresh()
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium text-muted">VK-сессия</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={connected ? 'SUCCESS' : 'PENDING'}>
              {statusUnavailable ? 'Статус недоступен' : connected ? 'Подключено' : 'Не подключено'}
            </Badge>
            {connected && session?.updatedAt ? (
              <span className="text-xs text-muted">
                {`Обновлено ${new Date(session.updatedAt).toLocaleString()}`}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {statusUnavailable ? (
            <Button type="button" variant="secondary" disabled={loading} onClick={onRefreshStatus}>
              Обновить статус
            </Button>
          ) : connected ? (
            <Button type="button" variant="secondary" disabled={loading} onClick={onDisconnect}>
              {loading ? 'Отключение...' : 'Отключить'}
            </Button>
          ) : (
            <Button type="button" disabled={loading} onClick={onConnect}>
              {loading ? 'Подготовка...' : 'Подключить VK'}
            </Button>
          )}
        </div>
      </div>

      {statusUnavailable ? (
        <div className="mt-3 text-sm text-muted">
          Не удалось получить актуальное состояние VK-сессии.
          {sessionError ? ` ${sessionError}.` : ''}
        </div>
      ) : !connected ? (
        <div className="mt-3 text-sm text-muted">
          Поиск запускается только после подключения VK. На телефоне откроется отдельная страница с удалённым окном VK.
        </div>
      ) : null}

      {error ? <div className="mt-3 text-sm text-red-400">{error}</div> : null}
      {message ? <div className="mt-3 text-sm text-emerald-400">{message}</div> : null}
    </Card>
  )
}

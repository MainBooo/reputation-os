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
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-brand">Подключение VK</div>
          <div className="mt-1 text-sm text-muted">
            Здесь показывается только состояние текущей VK-сессии для Playwright-поиска.
          </div>
        </div>

        <Badge tone={connected ? 'SUCCESS' : 'PENDING'}>
          {statusUnavailable ? 'Статус недоступен' : connected ? 'Подключено' : 'Не подключено'}
        </Badge>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-panel2 p-4 text-sm text-muted">
        {statusUnavailable ? (
          <>
            Не удалось получить актуальное состояние VK-сессии.
            {sessionError ? ` ${sessionError}.` : ''}
          </>
        ) : connected ? (
          <>
            VK-сессия активна.
            {session?.updatedAt ? ` Последнее обновление: ${new Date(session.updatedAt).toLocaleString()}.` : ''}
          </>
        ) : (
          <>
            VK-сессия сейчас недоступна. Поиск можно запускать только после повторного подключения VK.
            <div className="mt-2 text-xs text-muted">
              На телефоне откроется отдельная страница с удалённым окном VK и явной кнопкой для клавиатуры.
            </div>
          </>
        )}
      </div>

      {error ? <div className="mt-4 text-sm text-red-400">{error}</div> : null}
      {message ? <div className="mt-4 text-sm text-emerald-400">{message}</div> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        {statusUnavailable ? (
          <Button type="button" variant="secondary" disabled={loading} onClick={onRefreshStatus}>
            Обновить статус
          </Button>
        ) : connected ? (
          <Button type="button" variant="secondary" disabled={loading} onClick={onDisconnect}>
            {loading ? 'Отключение...' : 'Отключить VK'}
          </Button>
        ) : (
          <Button type="button" disabled={loading} onClick={onConnect}>
            {loading ? 'Подготовка окна...' : 'Авторизоваться в VK'}
          </Button>
        )}
      </div>
    </Card>
  )
}

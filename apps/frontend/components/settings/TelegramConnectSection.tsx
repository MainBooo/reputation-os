'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

interface TelegramStatus {
  linked: boolean
  linkedAt: string | null
}

const API_BASE = '/api/telegram'

export function TelegramConnectSection() {
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/status`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
        return data as TelegramStatus
      }
    } catch {
      // ignore
    }
    return null
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      const data = await fetchStatus()
      if (data?.linked) {
        stopPolling()
        setConnecting(false)
      }
    }, 3000)
  }, [fetchStatus, stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  const handleConnect = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/link-token`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('error')
      const { url } = await res.json()
      window.open(url, '_blank', 'noopener,noreferrer')
      setConnecting(true)
      startPolling()
    } catch {
      alert('Не удалось создать ссылку. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlink = async () => {
    if (!confirm('Отвязать Telegram?')) return
    setLoading(true)
    try {
      await fetch(`${API_BASE}/unlink`, { method: 'DELETE', credentials: 'include' })
      setStatus({ linked: false, linkedAt: null })
    } catch {
      alert('Ошибка отвязки.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="text-base font-semibold text-brand">Telegram-уведомления</div>
      <div className="mt-2 text-sm leading-6 text-zinc-300">
        Получайте мгновенные уведомления о новых отзывах прямо в Telegram.
      </div>

      {status === null ? (
        <div className="mt-4 h-12 animate-pulse rounded-2xl bg-white/[0.04]" />
      ) : status.linked ? (
        <>
          <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-300">Статус</span>
              <span className="text-emerald-300">Подключён ✓</span>
            </div>
            {status.linkedAt && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-300">Привязан</span>
                <span className="text-brand">
                  {new Date(status.linkedAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
            )}
          </div>
          <div className="mt-4">
            <Button type="button" variant="ghost" onClick={handleUnlink} disabled={loading}>
              {loading ? 'Отключение...' : 'Отвязать Telegram'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-300">Статус</span>
              <span className="text-zinc-400">Не подключён</span>
            </div>
          </div>

          {connecting && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                Откройте бота и нажмите{' '}
                <strong className="text-white">Старт</strong>.{' '}
                Ожидаем подтверждения...
              </div>
              <button
                type="button"
                className="mt-2 text-xs text-zinc-500 underline hover:text-zinc-300"
                onClick={() => { stopPolling(); setConnecting(false) }}
              >
                Отмена
              </button>
            </div>
          )}

          <div className="mt-4">
            <Button type="button" onClick={handleConnect} disabled={loading || connecting}>
              {loading ? 'Создаём ссылку...' : '🔗 Подключить Telegram'}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}

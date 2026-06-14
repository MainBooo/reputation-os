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
      alert('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0443. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlink = async () => {
    if (!confirm('\u041e\u0442\u0432\u044f\u0437\u0430\u0442\u044c Telegram?')) return
    setLoading(true)
    try {
      await fetch(`${API_BASE}/unlink`, { method: 'DELETE', credentials: 'include' })
      setStatus({ linked: false, linkedAt: null })
    } catch {
      alert('\u041e\u0448\u0438\u0431\u043a\u0430 \u043e\u0442\u0432\u044f\u0437\u043a\u0438.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="text-base font-semibold text-brand">Telegram-\u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f</div>
      <div className="mt-2 text-sm leading-6 text-zinc-300">
        \u041f\u043e\u043b\u0443\u0447\u0430\u0439\u0442\u0435 \u043c\u0433\u043d\u043e\u0432\u0435\u043d\u043d\u044b\u0435 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u043e \u043d\u043e\u0432\u044b\u0445 \u043e\u0442\u0437\u044b\u0432\u0430\u0445 \u043f\u0440\u044f\u043c\u043e \u0432 Telegram.
      </div>

      {status === null ? (
        <div className="mt-4 h-12 animate-pulse rounded-2xl bg-white/[0.04]" />
      ) : status.linked ? (
        <>
          <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-300">\u0421\u0442\u0430\u0442\u0443\u0441</span>
              <span className="text-emerald-300">\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0451\u043d \u2713</span>
            </div>
            {status.linkedAt && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-300">\u041f\u0440\u0438\u0432\u044f\u0437\u0430\u043d</span>
                <span className="text-brand">
                  {new Date(status.linkedAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
            )}
          </div>
          <div className="mt-4">
            <Button type="button" variant="ghost" onClick={handleUnlink} disabled={loading}>
              {loading ? '\u041e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435...' : '\u041e\u0442\u0432\u044f\u0437\u0430\u0442\u044c Telegram'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-300">\u0421\u0442\u0430\u0442\u0443\u0441</span>
              <span className="text-zinc-400">\u041d\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0451\u043d</span>
            </div>
          </div>

          {connecting && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                \u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0431\u043e\u0442\u0430 \u0438 \u043d\u0430\u0436\u043c\u0438\u0442\u0435{' '}
                <strong className="text-white">\u0421\u0442\u0430\u0440\u0442</strong>.{' '}
                \u041e\u0436\u0438\u0434\u0430\u0435\u043c \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f...
              </div>
              <button
                type="button"
                className="mt-2 text-xs text-zinc-500 underline hover:text-zinc-300"
                onClick={() => { stopPolling(); setConnecting(false) }}
              >
                \u041e\u0442\u043c\u0435\u043d\u0430
              </button>
            </div>
          )}

          <div className="mt-4">
            <Button type="button" onClick={handleConnect} disabled={loading || connecting}>
              {loading ? '\u0421\u043e\u0437\u0434\u0430\u0451\u043c \u0441\u0441\u044b\u043b\u043a\u0443...' : '\uD83D\uDD17 \u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0438\u0442\u044c Telegram'}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}

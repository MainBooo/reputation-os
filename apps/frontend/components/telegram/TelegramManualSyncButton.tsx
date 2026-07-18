'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { startTelegramSync } from '@/lib/api/telegram-channels'

export default function TelegramManualSyncButton({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function onClick() {
    if (loading) return
    setLoading(true)
    setMessage(null)
    try {
      await startTelegramSync(companyId)
      setMessage('Поиск запущен — результаты появятся через несколько минут.')
      router.refresh()
    } catch (error: any) {
      // apiFetch throws a plain Error whose .message is data.code when the API
      // returns a non-string message body (see lib/api/client.ts) — matches the
      // existing PLAN_LIMIT convention used by CompaniesCreateForm.tsx.
      const isPlanLimit = String(error?.message || '').includes('PLAN_LIMIT')
      setMessage(
        isPlanLimit
          ? 'Telegram Scout недоступен на вашем тарифе.'
          : 'Не удалось запустить поиск, попробуйте ещё раз.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" onClick={onClick} disabled={loading}>
        {loading ? 'Запуск…' : 'Запустить поиск'}
      </Button>
      {message ? <div className="text-xs text-zinc-400">{message}</div> : null}
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import { startCompanySync } from '@/lib/api/companies'

export default function CompanyManualSyncButton({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleClick() {
    if (loading) return

    setLoading(true)
    setMessage('')
    setError('')

    try {
      await startCompanySync(companyId)
      setMessage('Сбор запущен. Статус обновится после обработки очереди.')
      router.refresh()
    } catch (e) {
      const nextError = e instanceof Error ? e.message : 'Не удалось запустить сбор'
      setError(nextError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" onClick={handleClick} disabled={loading}>
        {loading ? 'Запускаем...' : 'Запустить сбор'}
      </Button>

      {message ? <div className="text-xs text-emerald-300">{message}</div> : null}
      {error ? <div className="text-xs text-red-300">{error}</div> : null}
    </div>
  )
}

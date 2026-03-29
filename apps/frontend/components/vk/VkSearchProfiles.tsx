'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { deleteVkSearchProfile } from '@/lib/api/vk'

export default function VkSearchProfiles({
  companyId,
  profiles
}: {
  companyId: string
  profiles: any[]
}) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function onDelete(profileId: string, query: string) {
    const ok = window.confirm(`Удалить поисковый запрос "${query}"?`)
    if (!ok) return

    setDeletingId(profileId)
    setMessage('')
    setError('')

    try {
      await deleteVkSearchProfile(companyId, profileId)
      setMessage('Поисковый запрос удалён')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить поисковый запрос')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-2 text-base font-semibold text-brand">Глобальные поисковые запросы</div>
      <div className="mb-4 text-sm text-muted">
        Используются для прогона по открытому VK. Это настройки поиска, а не найденные посты.
      </div>

      {error ? <div className="mb-3 text-sm text-red-400">{error}</div> : null}
      {message ? <div className="mb-3 text-sm text-emerald-400">{message}</div> : null}

      {profiles.length ? (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel2 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-brand">{profile.query}</div>
                <div className="mt-1 text-xs text-muted">
                  {profile.isActive ? 'Активен' : 'Неактивен'}
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                disabled={deletingId === profile.id}
                onClick={() => onDelete(profile.id, profile.query)}
              >
                {deletingId === profile.id ? 'Удаление...' : 'Удалить'}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted">Глобальных поисковых запросов пока нет.</div>
      )}
    </Card>
  )
}

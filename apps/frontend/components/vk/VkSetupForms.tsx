'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createVkCommunity, createVkSearchProfile } from '@/lib/api/vk'

export default function VkSetupForms({ companyId }: { companyId: string }) {
  const router = useRouter()

  const [brandQuery, setBrandQuery] = useState('')
  const [brandLoading, setBrandLoading] = useState(false)
  const [brandMessage, setBrandMessage] = useState('')
  const [brandError, setBrandError] = useState('')

  const [communityMode, setCommunityMode] = useState<'PRIORITY_COMMUNITY' | 'OWNED_COMMUNITY'>('PRIORITY_COMMUNITY')
  const [communityId, setCommunityId] = useState('')
  const [screenName, setScreenName] = useState('')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [communityLoading, setCommunityLoading] = useState(false)
  const [communityMessage, setCommunityMessage] = useState('')
  const [communityError, setCommunityError] = useState('')

  async function onSubmitBrand(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBrandError('')
    setBrandMessage('')

    const query = brandQuery.trim()

    if (!query) {
      setBrandError('Введите запрос для поиска по открытому VK')
      return
    }

    setBrandLoading(true)

    try {
      await createVkSearchProfile(companyId, {
        query,
        priority: 100,
        isActive: true,
        mode: 'BRAND_SEARCH'
      })

      setBrandMessage('Запрос добавлен в настройки глобального VK-поиска')
      setBrandQuery('')
      router.refresh()
    } catch (e) {
      setBrandError(e instanceof Error ? e.message : 'Не удалось добавить запрос')
    } finally {
      setBrandLoading(false)
    }
  }

  async function onSubmitCommunity(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCommunityError('')
    setCommunityMessage('')

    const vkCommunityId = communityId.trim()

    if (!vkCommunityId) {
      setCommunityError('Введите vkCommunityId сообщества')
      return
    }

    setCommunityLoading(true)

    try {
      await createVkCommunity(companyId, {
        mode: communityMode,
        vkCommunityId,
        screenName: screenName.trim() || undefined,
        title: title.trim() || undefined,
        url: url.trim() || undefined,
        isActive: true
      })

      setCommunityMessage('Сообщество добавлено в настройки мониторинга')
      setCommunityId('')
      setScreenName('')
      setTitle('')
      setUrl('')
      setCommunityMode('PRIORITY_COMMUNITY')
      router.refresh()
    } catch (e) {
      setCommunityError(e instanceof Error ? e.message : 'Не удалось добавить сообщество')
    } finally {
      setCommunityLoading(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="p-5">
        <div className="mb-4">
          <div className="text-base font-semibold text-brand">Глобальный поиск по открытому VK</div>
          <div className="mt-1 text-sm text-muted">
            Здесь добавляется запрос для прогона по открытым постам и комментариям VK. Это настройка мониторинга, а не найденные результаты.
          </div>
        </div>

        <form onSubmit={onSubmitBrand} className="space-y-3">
          <label className="block space-y-2">
            <span className="text-sm text-muted">Поисковый запрос</span>
            <Input
              value={brandQuery}
              onChange={(e) => setBrandQuery(e.target.value)}
              placeholder="Например: Acme Corp"
            />
          </label>

          {brandError ? <div className="text-sm text-red-400">{brandError}</div> : null}
          {brandMessage ? <div className="text-sm text-emerald-400">{brandMessage}</div> : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={brandLoading}>
              {brandLoading ? 'Добавление...' : 'Добавить запрос'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <div className="mb-4">
          <div className="text-base font-semibold text-brand">Прогон по выбранным сообществам</div>
          <div className="mt-1 text-sm text-muted">
            Здесь добавляются сообщества для отдельного мониторинга по конкретным пабликам.
          </div>
        </div>

        <form onSubmit={onSubmitCommunity} className="space-y-3">
          <Select
            label="Тип сообщества"
            value={communityMode}
            onChange={(e) => setCommunityMode(e.target.value as 'PRIORITY_COMMUNITY' | 'OWNED_COMMUNITY')}
          >
            <option value="PRIORITY_COMMUNITY">Выбранное сообщество</option>
            <option value="OWNED_COMMUNITY">Собственное сообщество</option>
          </Select>

          <label className="block space-y-2">
            <span className="text-sm text-muted">vkCommunityId</span>
            <Input
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              placeholder="Например: club123456789 или public123456789"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-muted">screenName</span>
            <Input
              value={screenName}
              onChange={(e) => setScreenName(e.target.value)}
              placeholder="Например: acme_official"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-muted">Название</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Acme Official"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-muted">URL</span>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Например: https://vk.com/acme_official"
            />
          </label>

          {communityError ? <div className="text-sm text-red-400">{communityError}</div> : null}
          {communityMessage ? <div className="text-sm text-emerald-400">{communityMessage}</div> : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={communityLoading}>
              {communityLoading ? 'Добавление...' : 'Добавить сообщество'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import {
  checkTelegramChannelNow,
  createTelegramChannel,
  deleteTelegramChannel,
  getTelegramChannels,
  updateTelegramChannel,
  type TelegramChannelDto
} from '@/lib/api/telegram-channels'

const ENTITY_TYPE_LABEL: Record<string, string> = {
  channel: 'Канал',
  group: 'Группа',
  supergroup: 'Супергруппа'
}

const DISCOVERY_METHOD_LABEL: Record<string, string> = {
  GLOBAL_CHANNEL_SEARCH: 'Глобальный поиск (каналы)',
  GLOBAL_GROUP_SEARCH: 'Глобальный поиск (группы)',
  PUBLIC_POST_SEARCH: 'Поиск по хэштегу',
  ENTITY_SEARCH: 'Поиск по названию',
  WEB_DISCOVERY: 'Найден через WEB',
  MANUAL: 'Добавлено вручную',
  AI_DISCOVERY: 'Найдено ИИ'
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function TelegramChannelsManager({ companyId }: { companyId: string }) {
  const [channels, setChannels] = useState<TelegramChannelDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function load() {
    setLoading(true)
    getTelegramChannels(companyId)
      .then((rows) => setChannels(rows))
      .catch(() => setError('Не удалось загрузить список источников'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  async function onAdd(event: React.FormEvent) {
    event.preventDefault()
    if (adding || !username.trim()) return
    setAdding(true)
    setAddError(null)
    try {
      const result: any = await createTelegramChannel(companyId, username.trim())
      if (result?.stillProcessing) {
        setAddError('Источник проверяется, обновите список через несколько секунд.')
      } else {
        setUsername('')
      }
      load()
    } catch (error: any) {
      setAddError(error?.message || 'Не удалось добавить источник')
    } finally {
      setAdding(false)
    }
  }

  async function onToggle(channel: TelegramChannelDto) {
    setBusyId(channel.id)
    try {
      await updateTelegramChannel(companyId, channel.id, { enabled: !channel.enabled })
      load()
    } finally {
      setBusyId(null)
    }
  }

  async function onCheckNow(channel: TelegramChannelDto) {
    setBusyId(channel.id)
    try {
      await checkTelegramChannelNow(companyId, channel.id)
      load()
    } finally {
      setBusyId(null)
    }
  }

  async function onDelete(channel: TelegramChannelDto) {
    setBusyId(channel.id)
    try {
      await deleteTelegramChannel(companyId, channel.id)
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Каналы и группы Telegram</h3>
      </div>

      <form onSubmit={onAdd} className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@username канала или группы"
          className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-sky-400/40 focus:outline-none"
        />
        <Button type="submit" disabled={adding || !username.trim()}>
          {adding ? 'Добавление…' : 'Добавить'}
        </Button>
      </form>
      {addError ? <div className="mb-4 text-xs text-red-300">{addError}</div> : null}

      {loading ? (
        <div className="py-8 text-center text-sm text-zinc-500">Загрузка…</div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-red-300">{error}</div>
      ) : channels.length === 0 ? (
        <EmptyState title="Пока нет добавленных источников" description="Telegram Scout найдёт каналы и группы автоматически, либо добавьте их вручную по username." />
      ) : (
        <div className="flex flex-col gap-3">
          {channels.map((channel) => (
            <div key={channel.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">{channel.title || channel.username || channel.chatId}</span>
                    {channel.username ? <span className="text-xs text-zinc-500">@{channel.username}</span> : null}
                    <Badge>{ENTITY_TYPE_LABEL[channel.entityType] || channel.entityType}</Badge>
                    <Badge tone={channel.enabled ? 'POSITIVE' : undefined}>{channel.enabled ? 'Включён' : 'Выключен'}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {DISCOVERY_METHOD_LABEL[channel.discoveryMethod] || channel.discoveryMethod}
                    {channel.matchedQuery ? ` · по запросу "${channel.matchedQuery}"` : ''}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-zinc-500">
                    <span>Найдено упоминаний: {channel.mentionsFoundCount}</span>
                    {channel.relevanceScore !== null ? <span>Релевантность: {Number(channel.relevanceScore).toFixed(1)}</span> : null}
                    <span>Последняя проверка: {formatDate(channel.lastCheckedAt)}</span>
                    <span>Следующая: {formatDate(channel.nextCheckAt)}</span>
                  </div>
                  {channel.lastError ? (
                    <div className="mt-1 text-[11px] text-red-300">Ошибка: {channel.lastError}</div>
                  ) : null}
                  {channel.lastDecisionReason ? (
                    <div className="mt-1 text-[11px] text-amber-300">{channel.lastDecisionReason}</div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="ghost" onClick={() => onCheckNow(channel)} disabled={busyId === channel.id}>
                    Проверить сейчас
                  </Button>
                  <Button variant="secondary" onClick={() => onToggle(channel)} disabled={busyId === channel.id}>
                    {channel.enabled ? 'Выключить' : 'Включить'}
                  </Button>
                  <Button variant="ghost" onClick={() => onDelete(channel)} disabled={busyId === channel.id}>
                    Удалить
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

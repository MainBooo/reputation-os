'use client'

import { useMemo, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { runVkPostSearch, updateVkCompanySearchProfile } from '@/lib/api/vk'

type SearchProfile = {
  includeKeywords: string[]
  excludeKeywords: string[]
  contextKeywords: string[]
  geoKeywords: string[]
  category: string | null
}

function normalizeKeyword(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function ChipsInput({
  label,
  placeholder,
  values,
  onChange
}: {
  label: string
  placeholder: string
  values: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function addValue(raw: string) {
    const value = normalizeKeyword(raw)
    if (!value) return

    const next = Array.from(new Set([...values, value]))
    onChange(next)
    setDraft('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addValue(draft)
    }

    if (event.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <label className="block space-y-2">
      <span className="text-sm text-muted">{label}</span>

      <div className="rounded-xl border border-line bg-panel2 px-3 py-3">
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white/5 px-3 py-1 text-xs text-brand transition hover:bg-white/10"
              title="Удалить"
            >
              <span>{value}</span>
              <span className="text-muted">×</span>
            </button>
          ))}

          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => addValue(draft)}
            placeholder={placeholder}
            className="min-w-[180px] flex-1 bg-transparent text-sm text-brand outline-none placeholder:text-muted"
          />
        </div>
      </div>
    </label>
  )
}

export default function VkPostSearchPanel({
  companyId,
  initialProfile,
  runs
}: {
  companyId: string
  initialProfile: SearchProfile
  runs: any[]
}) {
  const router = useRouter()

  const [profile, setProfile] = useState<SearchProfile>({
    includeKeywords: initialProfile.includeKeywords || [],
    excludeKeywords: initialProfile.excludeKeywords || [],
    contextKeywords: initialProfile.contextKeywords || [],
    geoKeywords: initialProfile.geoKeywords || [],
    category: initialProfile.category || null
  })

  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const totalKeywords = useMemo(
    () =>
      profile.includeKeywords.length +
      profile.excludeKeywords.length +
      profile.contextKeywords.length +
      profile.geoKeywords.length,
    [profile]
  )

  async function saveProfile() {
    setSaving(true)
    setMessage('')
    setError('')

    try {
      await updateVkCompanySearchProfile(companyId, profile)
      setMessage('Профиль поиска VK сохранён')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить профиль поиска')
    } finally {
      setSaving(false)
    }
  }

  async function runSearch() {
    setRunning(true)
    setMessage('')
    setError('')

    try {
      const result = await runVkPostSearch(companyId) as { jobId?: string | null }
      setMessage(`Поиск постов VK запущен${result?.jobId ? ` · job ${result.jobId}` : ''}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось запустить поиск постов VK')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr,0.9fr]">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-brand">Профиль поиска по постам VK</div>
            <div className="mt-1 text-sm text-muted">
              Используется Playwright-поиском постов и комментариев. Алиасы компании уже учитываются отдельно.
            </div>
          </div>

          <Badge>{`Ключей: ${totalKeywords}`}</Badge>
        </div>

        <div className="mt-5 space-y-4">
          <ChipsInput
            label="Include keywords"
            placeholder="Добавить ключевое слово"
            values={profile.includeKeywords}
            onChange={(next) => setProfile((prev) => ({ ...prev, includeKeywords: next }))}
          />

          <ChipsInput
            label="Exclude keywords"
            placeholder="Добавить стоп-слово"
            values={profile.excludeKeywords}
            onChange={(next) => setProfile((prev) => ({ ...prev, excludeKeywords: next }))}
          />

          <ChipsInput
            label="Context keywords"
            placeholder="Например: отзыв, бар, меню"
            values={profile.contextKeywords}
            onChange={(next) => setProfile((prev) => ({ ...prev, contextKeywords: next }))}
          />

          <ChipsInput
            label="Geo keywords"
            placeholder="Например: Москва, Питер"
            values={profile.geoKeywords}
            onChange={(next) => setProfile((prev) => ({ ...prev, geoKeywords: next }))}
          />

          <label className="block space-y-2">
            <span className="text-sm text-muted">Категория</span>
            <Input
              value={profile.category || ''}
              onChange={(e) =>
                setProfile((prev) => ({
                  ...prev,
                  category: normalizeKeyword(e.target.value) || null
                }))
              }
              placeholder="Например: бар, ресторан, клуб"
            />
          </label>
        </div>

        {error ? <div className="mt-4 text-sm text-red-400">{error}</div> : null}
        {message ? <div className="mt-4 text-sm text-emerald-400">{message}</div> : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" disabled={saving || running} onClick={saveProfile}>
            {saving ? 'Сохранение...' : 'Сохранить профиль'}
          </Button>

          <Button type="button" disabled={saving || running} onClick={runSearch}>
            {running ? 'Запуск...' : 'Запустить поиск постов VK'}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-base font-semibold text-brand">Последние запуски</div>
        <div className="mt-1 text-sm text-muted">
          История задач очереди <span className="font-medium text-brand">vk_post_search</span>.
        </div>

        <div className="mt-4 space-y-3">
          {runs.length ? (
            runs.map((run) => (
              <div key={run.id} className="rounded-xl border border-line bg-panel2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={run.jobStatus}>{run.jobStatus || 'UNKNOWN'}</Badge>
                  {run.itemsCreated !== undefined ? <Badge>{`created: ${run.itemsCreated}`}</Badge> : null}
                  {run.itemsDiscovered !== undefined ? <Badge>{`found: ${run.itemsDiscovered}`}</Badge> : null}
                </div>

                <div className="mt-3 text-xs text-muted">
                  {run.jobName || 'vk.post-search'}
                  {run.createdAt ? ` · ${new Date(run.createdAt).toLocaleString()}` : ''}
                </div>

                {run.result ? (
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-black/20 p-3 text-xs text-muted">
                    {JSON.stringify(run.result, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))
          ) : (
            <div className="text-sm text-muted">Запусков пока нет.</div>
          )}
        </div>
      </Card>
    </div>
  )
}

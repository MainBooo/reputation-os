'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { updateCompany } from '@/lib/api/companies'

type ResponsePreset = 'FORMAL' | 'FRIENDLY' | 'CONCISE'

const RESPONSE_PRESETS: Array<{ value: ResponsePreset; label: string; hint: string }> = [
  { value: 'FORMAL', label: 'Официальный', hint: 'Сдержанно, официально-деловой тон' },
  { value: 'FRIENDLY', label: 'Дружелюбный', hint: 'Тепло и по-человечески' },
  { value: 'CONCISE', label: 'Кратко', hint: '1-2 предложения, только суть' }
]

function normalizeKeyword(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function getInitialKeywords(company: any) {
  if (!Array.isArray(company?.aliases)) return []

  const seen = new Set<string>()

  return company.aliases
    .map((alias: any) => normalizeKeyword(alias?.value || ''))
    .filter(Boolean)
    .filter((value: string) => {
      const key = value.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 20)
}

export default function CompanyEditPanel({
  company,
  yandexUrl,
  twoGisUrl
}: {
  company: any
  yandexUrl?: string | null
  twoGisUrl?: string | null
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [keywords, setKeywords] = useState<string[]>(() => getInitialKeywords(company))
  const [form, setForm] = useState({
    name: company?.name || '',
    website: company?.website || '',
    city: company?.city || '',
    industry: company?.industry || '',
    yandexUrl: yandexUrl || '',
    twoGisUrl: twoGisUrl || ''
  })
  const [responsePreset, setResponsePreset] = useState<ResponsePreset>(
    RESPONSE_PRESETS.some((item) => item.value === company?.responsePreset) ? company.responsePreset : 'FORMAL'
  )

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function addKeyword(value: string) {
    const keyword = normalizeKeyword(value)
    if (!keyword) return

    setKeywords((current) => {
      const exists = current.some((item) => item.toLowerCase() === keyword.toLowerCase())
      if (exists) return current
      return [...current, keyword].slice(0, 20)
    })

    setKeywordInput('')
  }

  function removeKeyword(value: string) {
    setKeywords((current) => current.filter((item) => item !== value))
  }

  function handleKeywordKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()
    addKeyword(keywordInput)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    setError('')

    try {
      await updateCompany(company.id, {
        name: form.name.trim(),
        website: form.website.trim() || undefined,
        city: form.city.trim() || undefined,
        industry: form.industry.trim() || undefined,
        yandexUrl: form.yandexUrl.trim() || undefined,
        twoGisUrl: form.twoGisUrl.trim() || undefined,
        keywords,
        responsePreset
      })

      setIsOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить компанию')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div id="company-edit" className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-brand">Редактирование компании</div>
          <div className="mt-1 text-xs text-zinc-300">
            Название, сайт, город, сфера, Яндекс Карты, 2GIS и ключевые слова мониторинга.
          </div>
        </div>

        <Button type="button" variant="secondary" onClick={() => setIsOpen((value) => !value)}>
          {isOpen ? 'Скрыть форму' : 'Редактировать'}
        </Button>
      </div>

      {isOpen ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-zinc-300">Название</span>
            <input
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-[#050816] px-4 text-sm text-brand outline-none transition focus:border-cyan-400/50"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-zinc-300">Сайт</span>
            <input
              value={form.website}
              onChange={(event) => setField('website', event.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-[#050816] px-4 text-sm text-brand outline-none transition focus:border-cyan-400/50"
              placeholder="https://example.ru"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-zinc-300">Город</span>
              <input
                value={form.city}
                onChange={(event) => setField('city', event.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-[#050816] px-4 text-sm text-brand outline-none transition focus:border-cyan-400/50"
                placeholder="Москва"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-zinc-300">Сфера</span>
              <input
                value={form.industry}
                onChange={(event) => setField('industry', event.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-[#050816] px-4 text-sm text-brand outline-none transition focus:border-cyan-400/50"
                placeholder="Бар / клуб / концертная площадка"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-zinc-300">Yandex Maps URL</span>
            <input
              value={form.yandexUrl}
              onChange={(event) => setField('yandexUrl', event.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-[#050816] px-4 text-sm text-brand outline-none transition focus:border-cyan-400/50"
              placeholder="https://yandex.ru/maps/org/..."
            />
          </label>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-zinc-300">2GIS URL</span>
              <input
                value={form.twoGisUrl}
                onChange={(event) => setField('twoGisUrl', event.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-[#050816] px-4 text-sm text-brand outline-none transition focus:border-cyan-400/50"
                placeholder="https://2gis.ru/..."
              />
            </label>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-brand">Ключевые слова мониторинга</div>
                <div className="mt-1 text-xs leading-5 text-zinc-300">
                  Эти слова сохраняются как алиасы компании и используются для поиска упоминаний.
                </div>
              </div>

              <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300">
                {keywords.length}/20
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => removeKeyword(keyword)}
                  className="rounded-full border border-violet-400/40 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-100 transition hover:bg-cyan-500/20"
                  title="Нажмите, чтобы удалить"
                >
                  {keyword} ×
                </button>
              ))}

              {!keywords.length ? (
                <div className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-zinc-300">
                  Пока нет ключевых слов
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                onKeyDown={handleKeywordKeyDown}
                className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-[#050816] px-4 text-sm text-brand outline-none transition focus:border-cyan-400/50"
                placeholder="Например: Stereopeople отзывы"
              />
              <Button type="button" variant="secondary" onClick={() => addKeyword(keywordInput)}>
                Добавить
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="text-sm font-semibold text-brand">Тон AI-ответов</div>
            <div className="mt-1 text-xs leading-5 text-zinc-300">
              Используется по умолчанию при генерации ответов на отзывы этой компании.
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Тон AI-ответов">
              {RESPONSE_PRESETS.map((item) => (
                <label
                  key={item.value}
                  className={
                    responsePreset === item.value
                      ? 'cursor-pointer rounded-xl border border-cyan-400/50 bg-cyan-400/10 px-3 py-2.5 transition'
                      : 'cursor-pointer rounded-xl border border-line bg-[#050816] px-3 py-2.5 transition hover:border-cyan-400/30'
                  }
                >
                  <input
                    type="radio"
                    name="responsePreset"
                    value={item.value}
                    checked={responsePreset === item.value}
                    onChange={() => setResponsePreset(item.value)}
                    className="sr-only"
                  />
                  <div className={responsePreset === item.value ? 'text-sm font-medium text-cyan-100' : 'text-sm font-medium text-brand'}>
                    {item.label}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-400">{item.hint}</div>
                </label>
              ))}
            </div>
          </div>

          {error ? <div className="text-sm text-red-400">{error}</div> : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)} disabled={saving}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

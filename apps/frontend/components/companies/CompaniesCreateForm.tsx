'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { createCompany, getWorkspaces } from '@/lib/api/companies'

type Workspace = {
  id: string
  name: string
}

type CreatedCompany = {
  id: string
}

function formatCreateCompanyError(message: string) {
  if (message.includes('Workspace company limit reached')) {
    return 'Лимит тарифа: максимум 3 компании в workspace.'
  }

  return message || 'Не удалось создать компанию'
}

function normalizeKeyword(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function getDomainKeyword(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  }
}

function getReadinessScore(params: {
  name: string
  keywords: string[]
  yandexUrl: string
  twoGisUrl?: string
}) {
  let score = 0
  if (params.name.trim()) score += 40
  if (params.keywords.length > 0) score += 30
  if (params.yandexUrl.trim() || params.twoGisUrl?.trim()) score += 30
  return Math.min(score, 100)
}

export default function CompaniesCreateForm() {
  const router = useRouter()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [industry, setIndustry] = useState('')
  const [yandexUrl, setYandexUrl] = useState('')
  const [twoGisUrl, setTwoGisUrl] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [planLimitHit, setPlanLimitHit] = useState(false)

  useEffect(() => {
    let active = true

    getWorkspaces()
      .then((data: Workspace[]) => {
        if (!active) return
        setWorkspaces(Array.isArray(data) ? data : [])
        if (Array.isArray(data) && data.length > 0) {
          setWorkspaceId(data[0].id)
        }
      })
      .catch((e: Error) => {
        if (!active) return
        setError(e.message || 'Не удалось загрузить рабочие пространства')
      })

    return () => {
      active = false
    }
  }, [])

  const suggestedKeywords = useMemo(() => {
    const result: string[] = []
    const companyName = normalizeKeyword(name)
    const cityName = normalizeKeyword(city)
    const industryName = normalizeKeyword(industry)

    if (companyName) {
      result.push(companyName)
      if (cityName) result.push(`${companyName} ${cityName}`)
      if (industryName) result.push(`${companyName} ${industryName}`)
      result.push(`${companyName} отзывы`)
    }


    const existing = new Set(keywords.map((item) => item.toLowerCase()))
    return result
      .map(normalizeKeyword)
      .filter(Boolean)
      .filter((item, index, arr) => arr.findIndex((value) => value.toLowerCase() === item.toLowerCase()) === index)
      .filter((item) => !existing.has(item.toLowerCase()))
      .slice(0, 6)
  }, [name, city, industry, keywords])

  const readinessScore = useMemo(
    () => getReadinessScore({ name, keywords, yandexUrl, twoGisUrl }),
    [name, keywords, yandexUrl, twoGisUrl]
  )

  const canSubmit = useMemo(() => {
    return Boolean(workspaceId && name.trim()) && !loading
  }, [workspaceId, name, loading])

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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (!workspaceId) {
      setError('Не найден workspace для создания компании')
      return
    }

    if (!name.trim()) {
      setError('Введите название компании')
      return
    }

    setLoading(true)

    try {
      const company = (await createCompany({
        workspaceId,
        name: name.trim(),
        city: city.trim() || undefined,
        industry: industry.trim() || undefined,
        yandexUrl: yandexUrl.trim() || undefined,
        twoGisUrl: twoGisUrl.trim() || undefined,
        keywords
      })) as CreatedCompany

      router.push(`/companies/${company.id}`)
      router.refresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось создать компанию'
      if (message.includes('PLAN_LIMIT') || message.includes('Workspace company limit')) {
        setPlanLimitHit(true)
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.34),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.92))] p-5 sm:p-6">
        <div className="inline-flex rounded-full border border-violet-400/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
          Smart setup
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <div className="text-2xl font-semibold text-brand">Добавить компанию</div>
            <div className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
              Создайте карточку мониторинга: название, источники и ключевые слова сразу попадут в систему как рабочие алиасы.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-300">Готовность</div>
                <div className="mt-1 text-2xl font-semibold text-brand">{readinessScore}%</div>
              </div>
              <div className="text-right text-xs text-zinc-300">
                {readinessScore >= 90 ? 'Готово к запуску' : readinessScore >= 60 ? 'Почти готово' : 'Заполните основу'}
              </div>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-300 to-amber-300 transition-all"
                style={{ width: `${readinessScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название компании" />
            </div>

            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Город" />
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Отрасль / ниша" />
            <Input value={yandexUrl} onChange={(e) => setYandexUrl(e.target.value)} placeholder="Ссылка на Яндекс.Карты" />
              <Input value={twoGisUrl} onChange={(e) => setTwoGisUrl(e.target.value)} placeholder="Ссылка на 2GIS" />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-brand">Ключевые слова мониторинга</div>
                <div className="mt-1 text-xs leading-5 text-zinc-300">
                  Добавьте варианты названия, брендовые запросы, адресные или нишевые фразы.
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

            <div className="mt-3 flex gap-2">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                placeholder="Например: Stereopeople отзывы"
              />
              <Button type="button" variant="secondary" onClick={() => addKeyword(keywordInput)}>
                Добавить
              </Button>
            </div>

            {suggestedKeywords.length ? (
              <div className="mt-3">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-300">Умные подсказки</div>
                <div className="flex flex-wrap gap-2">
                  {suggestedKeywords.map((keyword) => (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => addKeyword(keyword)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-emerald-400/30 hover:bg-blue-500/10 hover:text-emerald-100"
                    >
                      + {keyword}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {workspaces.length > 1 ? (
            <select
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="h-12 w-full rounded-xl border border-line bg-[#050816]2 px-3 text-sm text-brand outline-none transition focus:border-cyan-400/50"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          ) : null}

          {planLimitHit ? (
            <div className="rounded-[1.35rem] border border-amber-400/20 bg-amber-500/[0.06] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">🔒 Лимит тарифа</div>
                  <div className="mt-1 text-xs text-zinc-400">Вы достигли максимального количества компаний на текущем плане. Перейдите на более высокий тариф.</div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/billing/checkout')}
                  className="shrink-0 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:brightness-110"
                >
                  Улучшить тариф
                </button>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <Button type="submit" disabled={!canSubmit} className="h-12 w-full">
            {loading ? 'Создание...' : 'Создать компанию и открыть карточку'}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-semibold text-brand">Превью мониторинга</div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-[#050816] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-brand">{name.trim() || 'Название компании'}</div>
                  <div className="mt-1 text-xs text-zinc-300">
                    {[city.trim() || 'Город не указан', industry.trim() || 'Отрасль не указана'].join(' · ')}
                  </div>
                </div>

                <div
                  className={clsx(
                    'rounded-full border px-2.5 py-1 text-xs font-medium',
                    readinessScore >= 70
                      ? 'border-emerald-400/25 bg-blue-500/10 text-emerald-200'
                      : 'border-amber-400/25 bg-amber-500/10 text-amber-100'
                  )}
                >
                  {readinessScore >= 70 ? 'Активна' : 'Черновик'}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="text-xs text-zinc-300">Ключи</div>
                  <div className="mt-1 text-xl font-semibold text-brand">{keywords.length}</div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="text-xs text-zinc-300">Источники</div>
                  <div className="mt-1 text-xl font-semibold text-brand">{[yandexUrl.trim(), twoGisUrl.trim()].filter(Boolean).length}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-semibold text-brand">Что будет создано</div>

            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-300">Карточка компании</span>
                <span className={name.trim() ? 'text-emerald-300' : 'text-zinc-300'}>{name.trim() ? 'готово' : 'ожидает'}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-300">Yandex Maps</span>
                <span className={yandexUrl.trim() ? 'text-emerald-300' : 'text-zinc-300'}>{yandexUrl.trim() ? 'подключён' : 'не указан'}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-300">2GIS</span>
                <span className={twoGisUrl.trim() ? 'text-emerald-300' : 'text-zinc-300'}>{twoGisUrl.trim() ? 'подключён' : 'не указан'}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-300">Алиасы / keywords</span>
                <span className={keywords.length ? 'text-emerald-300' : 'text-zinc-300'}>{keywords.length ? `${keywords.length} шт.` : 'не заданы'}</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Card>
  )
}

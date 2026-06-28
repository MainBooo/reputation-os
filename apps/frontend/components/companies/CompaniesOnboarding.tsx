'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Building2, CheckCircle2, Database, Inbox, ArrowRight, X } from 'lucide-react'

function getMentionsCount(company: any) {
  return Number(company?._count?.mentions || 0)
}

function getActiveSourceTargets(company: any) {
  if (!Array.isArray(company?.sourceTargets)) return []
  return company.sourceTargets.filter((target: any) => target?.isActive !== false)
}

export default function CompaniesOnboarding({ companies }: { companies: any[] }) {
  const safeCompanies = Array.isArray(companies) ? companies : []
  const firstCompany = safeCompanies[0] || null
  const workspaceId = firstCompany?.workspaceId || ''
  const storageKey = workspaceId ? `quick_start_dismissed_${workspaceId}` : ''

  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!storageKey) return
    setDismissed(localStorage.getItem(storageKey) === 'true')
  }, [storageKey])

  const hasCompany = safeCompanies.length > 0
  const hasSource = safeCompanies.some((company) => getActiveSourceTargets(company).length > 0)
  const hasSignal = safeCompanies.some((company) => getMentionsCount(company) > 0)

  const steps = [
    {
      title: 'Добавьте компанию',
      description: 'Укажите название, город, сайт и ключевые слова бренда.',
      done: hasCompany,
      icon: Building2,
      href: '#add-company'
    },
    {
      title: 'Подключите источник',
      description: 'Добавьте Яндекс, 2GIS или WEB-источники для мониторинга.',
      done: hasSource,
      icon: Database,
      href: firstCompany ? `/companies/${firstCompany.id}` : '#add-company'
    },
    {
      title: 'Получите первый сигнал',
      description: 'Новые отзывы и упоминания появятся в Inbox.',
      done: hasSignal,
      icon: Inbox,
      href: firstCompany ? `/companies/${firstCompany.id}/inbox` : '#add-company'
    }
  ]

  const completed = steps.filter((step) => step.done).length
  const allDone = completed === steps.length

  function handleDismiss() {
    if (storageKey) localStorage.setItem(storageKey, 'true')
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <section className="mb-6 overflow-hidden rounded-[32px] border border-cyan-400/20 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.18),transparent_34%),#070b16] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34),0_0_44px_rgba(34,211,238,0.08)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[28px] font-semibold leading-none tracking-[-0.04em] text-white">
            Быстрый старт
          </div>
          <div className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Пройдите 3 шага: добавьте компанию, подключите источник и получите первый сигнал репутации.
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-cyan-100">
            {completed}/3 готово
          </div>

          {allDone ? (
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-medium text-slate-400 transition hover:border-white/20 hover:text-white"
              title="Скрыть блок быстрого старта"
            >
              <X className="h-3.5 w-3.5" />
              Скрыть
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon

          return (
            <Link
              key={step.title}
              href={step.href}
              className="group rounded-[24px] border border-white/10 bg-white/[0.035] p-4 transition hover:border-cyan-400/25 hover:bg-cyan-500/[0.055]"
            >
              <div className="flex items-start gap-3">
                <span className={step.done
                  ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                  : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200'
                }>
                  {step.done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Шаг {index + 1}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">{step.title}</div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
                  </div>

                  <div className="mt-2 text-sm leading-5 text-slate-400">{step.description}</div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

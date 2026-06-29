'use client'

import Link from 'next/link'
import { CheckCircle2, Circle, ArrowRight, Inbox } from 'lucide-react'
import clsx from 'clsx'

interface OnboardingSteps {
  companyAdded: boolean
  sourcesConnected: boolean
  monitoringActive: boolean
  notificationsEnabled: boolean
}

interface QuickStartChecklistProps {
  steps: OnboardingSteps
  progress: number
}

const STEPS = [
  {
    key: 'companyAdded' as const,
    label: 'Добавьте компанию',
    href: '/companies',
    hintPending: 'Укажите название и сайт',
  },
  {
    key: 'sourcesConnected' as const,
    label: 'Подключите источники',
    href: '/companies',
    hintPending: 'Яндекс Карты, 2ГИС или веб-поиск',
  },
  {
    key: 'monitoringActive' as const,
    label: 'Мониторинг запущен',
    href: '/companies',
    hintPending: 'Автоматически после подключения источника',
  },
  {
    key: 'notificationsEnabled' as const,
    label: 'Настройте уведомления',
    href: '/settings',
    hintPending: 'Push или Telegram — достаточно одного',
  },
]

function microText(progress: number) {
  if (progress === 0)
    return 'Начните с добавления компании. Это займёт около 20&nbsp;секунд.'
  if (progress === 25)
    return 'Компания добавлена. Теперь подключите площадки, которые хотите отслеживать.'
  if (progress === 50 || progress === 75)
    return 'Источники подключены. Мы начинаем отслеживать новые отзывы и упоминания.'
  return 'Мониторинг уже работает. Осталось выбрать, как получать уведомления.'
}

export default function QuickStartChecklist({ steps, progress }: QuickStartChecklistProps) {
  if (progress >= 100) {
    return (
      <div className="animate-fade-slide-up mb-5 overflow-hidden rounded-[30px] border border-emerald-400/30 bg-[radial-gradient(ellipse_at_0%_0%,rgba(52,211,153,0.12),transparent_40%),#080e1b] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34),0_0_44px_rgba(52,211,153,0.08)] sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-300">
                ReputationOS уже работает
              </span>
            </div>
            <p className="mt-2.5 text-sm leading-6 text-slate-400">
              Мы автоматически отслеживаем новые отзывы и упоминания. Если появится новый отзыв — вы увидите его в Inbox и получите уведомление.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/companies"
              className="inline-flex items-center gap-2 rounded-[18px] border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 active:scale-[0.97]"
            >
              <Inbox className="h-4 w-4" />
              Открыть Inbox
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-slide-up mb-5 overflow-hidden rounded-[30px] border border-white/10 bg-[#080e1b]/95 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34)] sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
            Быстрый старт
          </div>
          <div className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
            Запуск мониторинга
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-sm font-semibold text-white">
          {progress}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.5)] transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p
        className="mb-5 mt-2 text-sm leading-6 text-slate-400"
        dangerouslySetInnerHTML={{ __html: microText(progress) }}
      />

      {/* Steps */}
      <div className="space-y-2">
        {STEPS.map((step, idx) => {
          const done = steps[step.key]
          const isCurrent = !done && STEPS.slice(0, idx).every((s) => steps[s.key])

          return (
            <Link
              key={step.key}
              href={done ? '#' : step.href}
              onClick={done ? (e) => e.preventDefault() : undefined}
              className={clsx(
                'group flex items-center gap-3.5 rounded-[20px] border px-4 py-3.5 transition-all duration-200',
                done
                  ? 'border-emerald-400/20 bg-emerald-500/[0.07] cursor-default'
                  : isCurrent
                    ? 'border-cyan-400/25 bg-cyan-500/[0.09] hover:border-cyan-400/40 hover:bg-cyan-500/[0.14] hover:-translate-y-0.5'
                    : 'border-white/8 bg-white/[0.025] opacity-60'
              )}
            >
              <span className={clsx('shrink-0', done && 'animate-check-bounce')}>
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Circle
                    className={clsx(
                      'h-5 w-5',
                      isCurrent ? 'text-cyan-400' : 'text-slate-600'
                    )}
                  />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={clsx(
                    'block text-sm font-semibold',
                    done ? 'text-emerald-200 line-through decoration-emerald-500/40' : isCurrent ? 'text-white' : 'text-slate-500'
                  )}
                >
                  {step.label}
                </span>
                {!done && (
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {step.hintPending}
                  </span>
                )}
              </span>

              {isCurrent && (
                <ArrowRight className="h-4 w-4 shrink-0 text-cyan-400/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-cyan-300" />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

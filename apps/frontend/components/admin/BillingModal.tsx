'use client'

import { useState } from 'react'
import type { AdminBillingRow, AdminPlan, WorkspaceBillingUpdate } from '@/lib/api/admin'
import { updateWorkspaceBilling } from '@/lib/api/admin'
import { AlertTriangle } from 'lucide-react'

const STATUSES = ['TRIAL', 'ACTIVE', 'MANUAL', 'PAUSED', 'PAST_DUE', 'CANCELED', 'EXPIRED']

function planPrice(plans: AdminPlan[], code: string): number {
  return plans.find((p) => p.code === code)?.priceMonthly ?? 0
}

function isDowngrade(plans: AdminPlan[], from: string, to: string): boolean {
  if (from === to || !from || !to) return false
  return planPrice(plans, to) < planPrice(plans, from)
}

function toDateInputValue(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 10)
}

const inputCls = 'w-full rounded-xl border border-white/10 bg-[#080d20]/85 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/40'
const selectCls = 'w-full rounded-xl border border-white/10 bg-[#080d20]/85 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/40'
const labelCls = 'mb-1 block text-xs uppercase tracking-[0.1em] text-zinc-500'
const checkboxCls = 'h-4 w-4 rounded border-white/20 bg-[#080d20] accent-cyan-400'

function validateLimits(fields: Record<string, string>): string | null {
  for (const [key, val] of Object.entries(fields)) {
    const n = Number(val)
    if (val === '' || isNaN(n)) continue
    if (!Number.isInteger(n)) return `Лимит «${key}» должен быть целым числом`
    if (n < -1) return `Лимит «${key}» не может быть меньше -1 (-1 = безлимит)`
  }
  return null
}

export default function BillingModal({
  workspace,
  plans,
  onClose,
  onSaved
}: {
  workspace: AdminBillingRow
  plans: AdminPlan[]
  onClose: () => void
  onSaved: (updated: AdminBillingRow) => void
}) {
  const ov = workspace.overrides as Record<string, any>
  const originalPlan = workspace.planCode || 'FREE'

  const [planCode, setPlanCode] = useState(originalPlan)
  const [status, setStatus] = useState(workspace.subscriptionStatus || 'MANUAL')
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState(toDateInputValue(workspace.currentPeriodEnd))
  const [trialEndsAt, setTrialEndsAt] = useState(toDateInputValue(workspace.trialEndsAt))
  const [maxCompanies, setMaxCompanies] = useState(String(ov.maxCompanies ?? -1))
  const [maxSources, setMaxSources] = useState(String(ov.maxSources ?? -1))
  const [maxMembers, setMaxMembers] = useState(String(ov.maxMembers ?? -1))
  const [maxAiReplies, setMaxAiReplies] = useState(String(ov.maxAiRepliesPerMonth ?? -1))
  const [maxWebPages, setMaxWebPages] = useState(String(ov.maxWebPages ?? 0))
  const [webMonitoring, setWebMonitoring] = useState(Boolean(ov.webMonitoringEnabled))
  const [telegramNotif, setTelegramNotif] = useState(Boolean(ov.telegramNotifications))
  const [pushNotif, setPushNotif] = useState(Boolean(ov.pushNotificationsEnabled))
  const [adminNote, setAdminNote] = useState(workspace.adminNote || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const downgradeWarning = isDowngrade(plans, originalPlan, planCode)

  function handlePlanChange(newCode: string) {
    setPlanCode(newCode)
    const plan = plans.find((p) => p.code === newCode)
    if (plan) {
      const l = plan.limits
      if (l.maxCompanies !== undefined) setMaxCompanies(String(l.maxCompanies))
      if (l.maxAiRepliesPerMonth !== undefined) setMaxAiReplies(String(l.maxAiRepliesPerMonth))
      if (l.telegramNotifications !== undefined) setTelegramNotif(Boolean(l.telegramNotifications))
    }
  }

  async function handleSave() {
    const limitsError = validateLimits({
      'Компании': maxCompanies,
      'Источники': maxSources,
      'Участники': maxMembers,
      'AI-ответы': maxAiReplies,
      'WEB-страницы': maxWebPages
    })
    if (limitsError) { setError(limitsError); return }

    setSaving(true)
    setError('')
    try {
      const payload: WorkspaceBillingUpdate = {
        planCode: planCode || undefined,
        status: status || undefined,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd).toISOString() : undefined,
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt).toISOString() : undefined,
        maxCompanies: maxCompanies !== '' ? Number(maxCompanies) : undefined,
        maxSources: maxSources !== '' ? Number(maxSources) : undefined,
        maxMembers: maxMembers !== '' ? Number(maxMembers) : undefined,
        maxAiRepliesPerMonth: maxAiReplies !== '' ? Number(maxAiReplies) : undefined,
        maxWebPages: maxWebPages !== '' ? Number(maxWebPages) : undefined,
        webMonitoringEnabled: webMonitoring,
        telegramNotificationsEnabled: telegramNotif,
        pushNotificationsEnabled: pushNotif,
        adminNote: adminNote || undefined
      }
      await updateWorkspaceBilling(workspace.id, payload)
      onSaved({
        ...workspace,
        planCode,
        subscriptionStatus: status,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd).toISOString() : null,
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
        adminNote: adminNote || null,
        overrides: {
          maxCompanies: Number(maxCompanies),
          maxSources: Number(maxSources),
          maxMembers: Number(maxMembers),
          maxAiRepliesPerMonth: Number(maxAiReplies),
          maxWebPages: Number(maxWebPages),
          webMonitoringEnabled: webMonitoring,
          telegramNotifications: telegramNotif,
          pushNotificationsEnabled: pushNotif
        }
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  if (plans.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="mx-4 w-full max-w-sm rounded-[24px] border border-white/10 bg-[#070b16] p-6 text-center">
          <div className="mb-3 text-amber-400"><AlertTriangle className="mx-auto h-8 w-8" /></div>
          <div className="text-sm font-medium text-white">Тарифы не настроены</div>
          <div className="mt-1 text-xs text-zinc-500">Проверьте таблицу Plan в базе данных</div>
          <button onClick={onClose} className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:text-white">Закрыть</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm py-10">
      <div className="mx-4 w-full max-w-lg rounded-[24px] border border-white/10 bg-[#070b16] shadow-2xl">
        <div className="border-b border-white/10 px-6 py-4">
          <div className="text-base font-semibold text-white">Подписка: {workspace.name}</div>
          <div className="mt-0.5 text-xs text-zinc-500">{workspace.slug}</div>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Тариф</label>
              <select value={planCode} onChange={(e) => handlePlanChange(e.target.value)} className={selectCls}>
                {plans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} ({p.code}) — {p.priceMonthly === 0 ? 'бесплатно' : `${p.priceMonthly.toLocaleString('ru-RU')} ₽/мес`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Статус</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {downgradeWarning && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <span className="font-medium">Понижение тарифа</span> с <span className="font-semibold">{plans.find(p => p.code === originalPlan)?.name ?? originalPlan}</span> до <span className="font-semibold">{plans.find(p => p.code === planCode)?.name ?? planCode}</span>.
                Это может ограничить доступ workspace к текущим функциям.
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Действует до</label>
              <input type="date" value={currentPeriodEnd} onChange={(e) => setCurrentPeriodEnd(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Trial до</label>
              <input type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">Лимиты (-1 = безлимит, 0 = отключено)</div>
            <div className="grid grid-cols-2 gap-4">
              {([
                ['Компании', maxCompanies, setMaxCompanies],
                ['Источники', maxSources, setMaxSources],
                ['Участники', maxMembers, setMaxMembers],
                ['AI-ответы/мес', maxAiReplies, setMaxAiReplies],
                ['WEB-страницы', maxWebPages, setMaxWebPages]
              ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => {
                const n = Number(val)
                const invalid = val !== '' && !isNaN(n) && (n < -1 || !Number.isInteger(n))
                return (
                  <div key={label}>
                    <label className={labelCls}>{label}</label>
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => setter(e.target.value)}
                      min={-1}
                      className={inputCls + (invalid ? ' border-red-500/50' : '')}
                    />
                    {invalid && <div className="mt-1 text-[11px] text-red-400">Мин. -1</div>}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">Функции</div>
            <div className="space-y-2">
              {([
                [webMonitoring, setWebMonitoring, 'WEB-мониторинг'],
                [telegramNotif, setTelegramNotif, 'Telegram уведомления'],
                [pushNotif, setPushNotif, 'Push уведомления']
              ] as [boolean, (v: boolean) => void, string][]).map(([val, setter, label]) => (
                <label key={label} className="flex cursor-pointer items-center gap-3 text-sm text-zinc-300">
                  <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} className={checkboxCls} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Комментарий администратора</label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={2}
              className={inputCls + ' resize-none'}
              placeholder="Заметка видна только в админке..."
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button onClick={onClose} disabled={saving} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-60">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
              downgradeWarning
                ? 'border-amber-400/25 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                : 'border-cyan-400/20 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25'
            }`}
          >
            {saving ? 'Сохраняем...' : downgradeWarning ? 'Подтвердить понижение' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMetrica } from 'next-yandex-metrica'
import { Globe2 } from 'lucide-react'
import {
  getCompanyWebSourcesOverview,
  startCompanyWebSync,
  updateCompanySourceTarget,
  type WebMonitoringStatus
} from '@/lib/api/companies'
import { useSubscription } from '@/lib/subscription/SubscriptionContext'
import SubscriptionRequiredModal from '@/components/billing/SubscriptionRequiredModal'
import NetworkMonitoringCard from './NetworkMonitoringCard'
import NetworkToggleSwitch from './NetworkToggleSwitch'

const SEARCH_STATE_LABEL: Record<WebMonitoringStatus['searchState'], string> = {
  disabled: 'Выключен',
  never_run: '⏳ Идёт первичный поиск…',
  error: '⚠️ Обнаружены ошибки',
  ok: '✅ Мониторинг активен'
}

// После включения первый чек делает дисптетчер WEB (тик раз в 5 минут, см.
// page-watch-dispatcher.processor.ts) — не мгновенно. Недолгий поллинг даёт
// пользователю живую обратную связь (never_run → ok/error) без ручного
// обновления страницы, вместо статичной надписи до следующего visit.
const POLL_INTERVAL_MS = 4000
const POLL_MAX_ATTEMPTS = 15

export default function WebMonitoringNetworkCard({
  companyId,
  canWrite
}: {
  companyId: string
  canWrite: boolean
}) {
  const router = useRouter()
  const { reachGoal } = useMetrica()
  const { entitlements } = useSubscription()
  const [status, setStatus] = useState<WebMonitoringStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function load() {
    return getCompanyWebSourcesOverview(companyId).then((data: any) => setStatus(data.status))
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function pollUntilSettled() {
    stopPolling()
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts += 1
      const data: any = await getCompanyWebSourcesOverview(companyId).catch(() => null)
      const nextStatus: WebMonitoringStatus | undefined = data?.status
      if (nextStatus) setStatus(nextStatus)
      if (!nextStatus || nextStatus.searchState !== 'never_run' || attempts >= POLL_MAX_ATTEMPTS) {
        stopPolling()
      }
    }, POLL_INTERVAL_MS)
  }

  useEffect(() => {
    let cancelled = false
    load().finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
      stopPolling()
    }
  }, [companyId])

  const allowed = Boolean(entitlements?.effective?.webMonitoringEnabled)
  const enabled = Boolean(status?.enabled)

  async function onToggle() {
    if (busy || loading || !canWrite) return

    if (!allowed) {
      setShowUpgrade(true)
      return
    }

    stopPolling()
    setBusy(true)
    try {
      let turnedOn = false

      if (!status?.hasRootTarget) {
        // Never started before — bootstrap creates the root target, runs the
        // first scan, and schedules the company for the regular WEB dispatcher.
        await startCompanyWebSync(companyId)
        reachGoal('monitoring_enabled')
        turnedOn = true
      } else {
        const next = !enabled
        await Promise.all(
          status.rootTargetIds.map((id) =>
            updateCompanySourceTarget(companyId, id, { syncMentionsEnabled: next, isActive: next })
          )
        )
        if (next) reachGoal('monitoring_enabled')
        turnedOn = next
      }
      await load()
      if (turnedOn) pollUntilSettled()
      router.refresh()
    } catch {
      // leave state unchanged on failure (e.g. plan limit) — surfaced via toast elsewhere
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <NetworkMonitoringCard
        icon={Globe2}
        title="WEB-мониторинг"
        description="Поиск упоминаний компании на внешних сайтах, в каталогах и статьях."
        status={!allowed ? 'locked' : enabled ? 'enabled' : 'disabled'}
        toggle={
          <NetworkToggleSwitch
            enabled={enabled}
            locked={!allowed}
            busy={busy || loading || !canWrite}
            onClick={onToggle}
          />
        }
        lastRunAt={status?.lastRunAt}
        mentionsFound={status?.totalMentionsFound ?? 0}
        stateLabel={loading ? '—' : SEARCH_STATE_LABEL[status?.searchState || 'never_run']}
      />
      <SubscriptionRequiredModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        title="WEB-мониторинг доступен начиная с тарифа «Бизнес»"
        description="Подключите тариф «Бизнес» или выше, чтобы искать упоминания компании на внешних сайтах, в каталогах и статьях."
      />
    </>
  )
}

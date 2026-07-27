'use client'

import { useEffect, useState } from 'react'
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
  never_run: 'Ожидает первого запуска',
  error: 'Обнаружены ошибки',
  ok: 'Работает по расписанию'
}

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

  function load() {
    return getCompanyWebSourcesOverview(companyId).then((data: any) => setStatus(data.status))
  }

  useEffect(() => {
    let cancelled = false
    load().finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
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

    setBusy(true)
    try {
      if (!status?.hasRootTarget) {
        // Never started before — bootstrap creates the root target, runs the
        // first scan, and schedules the company for the regular WEB dispatcher.
        await startCompanyWebSync(companyId)
        reachGoal('monitoring_enabled')
      } else {
        const next = !enabled
        await Promise.all(
          status.rootTargetIds.map((id) =>
            updateCompanySourceTarget(companyId, id, { syncMentionsEnabled: next, isActive: next })
          )
        )
        if (next) reachGoal('monitoring_enabled')
      }
      await load()
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

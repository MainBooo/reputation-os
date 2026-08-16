'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { getCompanySourceTargets, updateCompanySourceTarget } from '@/lib/api/companies'
import { getTelegramScoutStatus, startTelegramSync, type TelegramScoutStatus } from '@/lib/api/telegram-channels'
import { useSubscription } from '@/lib/subscription/SubscriptionContext'
import SubscriptionRequiredModal from '@/components/billing/SubscriptionRequiredModal'
import NetworkMonitoringCard from './NetworkMonitoringCard'
import NetworkToggleSwitch from './NetworkToggleSwitch'

const JOB_STATUS_LABEL: Record<string, string> = {
  SUCCESS: '✅ Мониторинг активен',
  PARTIAL: '⚠️ Частичный результат',
  FAILED: '⚠️ Не удалось подключиться',
  PENDING: '⏳ Ожидание в очереди',
  RUNNING: '🔍 Идёт поиск каналов…',
  SKIPPED_ALREADY_RUNNING: '🔍 Идёт поиск каналов…',
  BLOCKED_TELEGRAM_CONNECTION: '⚠️ Не удалось подключиться'
}

// Discovery запускается сразу при включении, но реально выполняется в
// воркере асинхронно — недолгий поллинг даёт видимый переход
// PENDING/RUNNING → SUCCESS/FAILED без ручного обновления страницы.
const POLL_INTERVAL_MS = 4000
const POLL_MAX_ATTEMPTS = 15
const TERMINAL_JOB_STATUSES = ['SUCCESS', 'PARTIAL', 'FAILED', 'BLOCKED_TELEGRAM_CONNECTION']

export default function TelegramMonitoringNetworkCard({
  companyId,
  canWrite
}: {
  companyId: string
  canWrite: boolean
}) {
  const router = useRouter()
  const { entitlements } = useSubscription()
  const [status, setStatus] = useState<TelegramScoutStatus | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function load() {
    return Promise.all([getTelegramScoutStatus(companyId), getCompanySourceTargets(companyId)]).then(
      ([scoutStatus, targets]: [TelegramScoutStatus, any[]]) => {
        setStatus(scoutStatus)
        const telegramTarget = targets.find((t) => t.source?.platform === 'TELEGRAM')
        if (telegramTarget) {
          setTargetId(telegramTarget.id)
          setEnabled(telegramTarget.isActive !== false && telegramTarget.syncMentionsEnabled !== false)
        } else {
          setTargetId(null)
          setEnabled(false)
        }
        return scoutStatus
      }
    )
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
      const scoutStatus = await load().catch(() => null)
      const jobStatus = scoutStatus?.latestLog?.jobStatus
      if (!scoutStatus || (jobStatus && TERMINAL_JOB_STATUSES.includes(jobStatus)) || attempts >= POLL_MAX_ATTEMPTS) {
        stopPolling()
      }
    }, POLL_INTERVAL_MS)
  }

  useEffect(() => {
    let cancelled = false
    load()
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
      stopPolling()
    }
  }, [companyId])

  const allowed = Boolean(entitlements?.effective?.telegramMonitoringEnabled)

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

      if (!targetId) {
        // Never started before — bootstraps the CompanySourceTarget and kicks off DISCOVERY.
        await startTelegramSync(companyId)
        turnedOn = true
      } else {
        const next = !enabled
        await updateCompanySourceTarget(companyId, targetId, { syncMentionsEnabled: next, isActive: next })
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

  const jobStatus = status?.latestLog?.jobStatus
  const stateLabel = loading
    ? '—'
    : !enabled
      ? 'Выключен'
      : jobStatus
        ? JOB_STATUS_LABEL[jobStatus] || jobStatus
        : '⏳ Ожидает первого запуска'

  return (
    <>
      <NetworkMonitoringCard
        icon={Send}
        title="Telegram-мониторинг"
        description="Telegram Scout ищет упоминания компании в публичных каналах, группах и супергруппах."
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
        stateLabel={stateLabel}
        detailHref={`/companies/${companyId}/telegram`}
      />
      <SubscriptionRequiredModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        title="Telegram-мониторинг доступен начиная с тарифа «Бизнес»"
        description="Подключите тариф «Бизнес» или выше, чтобы искать упоминания компании в публичных Telegram-каналах и группах."
      />
    </>
  )
}

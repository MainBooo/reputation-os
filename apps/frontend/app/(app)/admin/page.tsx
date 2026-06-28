'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { me } from '@/lib/api/auth'
import PageHeader from '@/components/ui/PageHeader'
import OverviewTab from '@/components/admin/OverviewTab'
import UsersTab from '@/components/admin/UsersTab'
import WorkspacesTab from '@/components/admin/WorkspacesTab'
import BillingTab from '@/components/admin/BillingTab'
import SystemTab from '@/components/admin/SystemTab'
import AuditLogsTab from '@/components/admin/AuditLogsTab'
import { ShieldAlert, LayoutDashboard, Users, Building2, CreditCard, Activity, ScrollText } from 'lucide-react'

type TabKey = 'overview' | 'users' | 'workspaces' | 'billing' | 'system' | 'logs'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { key: 'users', label: 'Пользователи', icon: Users },
  { key: 'workspaces', label: 'Workspace', icon: Building2 },
  { key: 'billing', label: 'Биллинг', icon: CreditCard },
  { key: 'system', label: 'Система', icon: Activity },
  { key: 'logs', label: 'Логи', icon: ScrollText }
]

export default function AdminPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [tab, setTab] = useState<TabKey>('overview')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    me()
      .then((user) => {
        if ((user as any)?.systemRole !== 'SUPER_ADMIN') {
          setForbidden(true)
        } else {
          setReady(true)
        }
      })
      .catch(() => router.replace('/login'))
  }, [router])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  if (forbidden) {
    return (
      <div>
        <PageHeader title="Админ-панель" />
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <ShieldAlert className="h-12 w-12 text-red-400" />
          <div className="text-lg font-semibold text-white">Доступ запрещён</div>
          <div className="text-sm text-zinc-500">Эта страница доступна только SUPER_ADMIN.</div>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div>
        <PageHeader title="Админ-панель" />
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Админ-панель"
        subtitle="Управление пользователями, workspace, биллингом и системой."
        actions={
          <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            SUPER ADMIN
          </span>
        }
      />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl transition-all ${
          toast.ok
            ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
            : 'border-red-500/30 bg-red-500/15 text-red-300'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-white/10 pb-px">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === key
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'users' && <UsersTab onToast={showToast} />}
      {tab === 'workspaces' && <WorkspacesTab onToast={showToast} />}
      {tab === 'billing' && <BillingTab onToast={showToast} />}
      {tab === 'system' && <SystemTab />}
      {tab === 'logs' && <AuditLogsTab />}
    </div>
  )
}

'use client'

import { useWorkspaceAccess } from '@/lib/hooks/useWorkspaceAccess'
import WebMonitoringNetworkCard from './WebMonitoringNetworkCard'
import TelegramMonitoringNetworkCard from './TelegramMonitoringNetworkCard'

export default function NetworkOverviewSection({
  companyId,
  workspaceId
}: {
  companyId: string
  workspaceId: string
}) {
  const { canWrite } = useWorkspaceAccess(workspaceId)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <WebMonitoringNetworkCard companyId={companyId} canWrite={canWrite} />
      <TelegramMonitoringNetworkCard companyId={companyId} canWrite={canWrite} />
    </div>
  )
}

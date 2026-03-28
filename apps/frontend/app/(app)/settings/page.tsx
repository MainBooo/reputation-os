import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Profile, notification rules and workspace settings." />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5">
          <div className="text-base font-semibold">Profile</div>
          <div className="mt-3 text-sm text-muted">Profile placeholder for authenticated user settings.</div>
        </Card>
        <Card className="p-5">
          <div className="text-base font-semibold">Notification rules</div>
          <div className="mt-3 text-sm text-muted">NotificationRule UI placeholder ready for backend integration.</div>
        </Card>
        <Card className="p-5">
          <div className="text-base font-semibold">Workspace settings</div>
          <div className="mt-3 text-sm text-muted">Workspace settings placeholder.</div>
        </Card>
      </div>
    </div>
  )
}

import Card from '../ui/Card'
import Badge from '../ui/Badge'

export default function VkSearchProfiles({
  profiles
}: {
  profiles: any[]
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-brand">BRAND_SEARCH</div>
          <div className="mt-1 text-sm text-muted">
            Поиск постов по brand queries, затем комментарии и relevance scoring.
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {profiles.map((profile) => (
          <div key={profile.id} className="flex items-center justify-between rounded-xl border border-line bg-panel2 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-brand">{profile.query}</div>
              <div className="mt-1 text-xs text-muted">priority: {profile.priority}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={profile.mode}>{profile.mode}</Badge>
              <Badge>{profile.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

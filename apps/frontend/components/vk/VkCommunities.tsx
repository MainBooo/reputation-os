import Card from '../ui/Card'
import Badge from '../ui/Badge'

export default function VkCommunities({
  title,
  description,
  communities
}: {
  title: string
  description: string
  communities: any[]
}) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <div className="text-base font-semibold text-brand">{title}</div>
        <div className="mt-1 text-sm text-muted">{description}</div>
      </div>

      <div className="space-y-3">
        {communities.map((community) => (
          <div key={community.id} className="flex items-center justify-between rounded-xl border border-line bg-panel2 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-brand">{community.title || community.screenName || community.vkCommunityId}</div>
              <div className="mt-1 text-xs text-muted">
                {community.url || community.screenName || community.vkCommunityId}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={community.mode}>{community.mode}</Badge>
              <Badge>{community.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import VkOverview from '@/components/vk/VkOverview'
import VkSearchProfiles from '@/components/vk/VkSearchProfiles'
import VkCommunities from '@/components/vk/VkCommunities'
import MentionRow from '@/components/mentions/MentionRow'
import VkActions from '@/components/vk/VkActions'
import { getVkCommunities, getVkOverview, getVkPosts, getVkSearchProfiles } from '@/lib/api/vk'

export default async function VkPage({ params }: { params: { id: string } }) {
  const overview: any = await getVkOverview(params.id)
  const profiles: any[] = await getVkSearchProfiles(params.id)
  const communities: any[] = await getVkCommunities(params.id)
  const posts: any[] = await getVkPosts(params.id)

  const priorityCommunities = communities.filter((item) => item.mode === 'PRIORITY_COMMUNITY')
  const ownedCommunities = communities.filter((item) => item.mode === 'OWNED_COMMUNITY')

  return (
    <div>
      <PageHeader
        title="VK monitoring"
        subtitle="Dedicated social monitoring pipeline with 3 modes and relevance-based persistence."
        actions={<VkActions companyId={params.id} />}
      />

      <VkOverview overview={overview} />

      <div className="mt-6 grid gap-6">
        <VkSearchProfiles profiles={profiles} />

        <VkCommunities
          title="PRIORITY_COMMUNITIES"
          description="Scans only configured communities, then comments for relevant/new posts."
          communities={priorityCommunities}
        />

        <VkCommunities
          title="OWNED_COMMUNITY"
          description="Frequent incremental sync, event-ready/callback-ready architecture."
          communities={ownedCommunities}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr,1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-base font-semibold">Recent VK tracked posts</div>
            <Badge tone="VK">VK</Badge>
          </div>
          <div className="space-y-3">
            {(overview.recentPosts || posts).map((post: any) => (
              <div key={post.id || `${post.ownerId}-${post.postId}`} className="rounded-xl border border-line bg-panel2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {post.trackedCommunity?.mode ? <Badge tone={post.trackedCommunity.mode}>{post.trackedCommunity.mode}</Badge> : null}
                  {post.discoveryStatus ? <Badge>{post.discoveryStatus}</Badge> : null}
                </div>
                <div className="mt-3 text-sm leading-6 text-brand">{post.text || 'No text'}</div>
                <div className="mt-3 text-xs text-muted">{post.url || 'No URL'} · {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : ''}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Recent VK mentions/comments</div>
          <div className="space-y-3">
            {(overview.recentMentions || []).map((mention: any) => (
              <MentionRow key={mention.id} mention={mention} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

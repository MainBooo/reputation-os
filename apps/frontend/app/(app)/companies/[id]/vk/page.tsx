import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import MentionRow from '@/components/mentions/MentionRow'
import VkActions from '@/components/vk/VkActions'
import { getVkOverview, getVkSearchProfiles, getVkCommunities, getVkPosts } from '@/lib/api/vk'

function OverviewCards({ overview }: { overview: any }) {
  const items = [
    ['Отслеживаемые сообщества', overview?.trackedCommunitiesCount ?? 0],
    ['Активные поисковые профили', overview?.activeSearchProfilesCount ?? 0],
    ['Найденные посты VK', overview?.discoveredVkPostsCount ?? 0],
    ['Релевантные упоминания VK', overview?.relevantVkMentionsCount ?? 0]
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <Card key={String(label)} className="p-5">
          <div className="text-sm text-muted">{label}</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-brand">{value}</div>
        </Card>
      ))}
    </div>
  )
}

export default async function CompanyVkPage({ params }: { params: { id: string } }) {
  let overview: any = null
  let profiles: any[] = []
  let communities: any[] = []
  let posts: any[] = []
  let authRequired = false

  try {
    overview = await getVkOverview(params.id)
    profiles = await getVkSearchProfiles(params.id)
    communities = await getVkCommunities(params.id)
    posts = await getVkPosts(params.id)
  } catch {
    authRequired = true
  }

  const priorityCommunities = communities.filter((c) => c.mode === 'PRIORITY_COMMUNITY')
  const ownedCommunities = communities.filter((c) => c.mode === 'OWNED_COMMUNITY')

  return (
    <div>
      <PageHeader
        title="Мониторинг VK"
        subtitle="Отдельный контур мониторинга ВКонтакте с 3 режимами и сохранением только релевантных данных."
        actions={!authRequired ? <VkActions companyId={params.id} /> : undefined}
      />

      {authRequired ? (
        <EmptyState
          title="Требуется авторизация"
          description="Войдите в систему, чтобы загрузить данные мониторинга VK из API."
        />
      ) : (
        <>
          <OverviewCards overview={overview} />

          <div className="mt-6 grid gap-6">
            <Card className="p-5">
              <div className="mb-4 text-base font-semibold text-brand">BRAND_SEARCH</div>
              {profiles.length ? (
                <div className="space-y-3">
                  {profiles.map((profile: any) => (
                    <div key={profile.id} className="flex items-center justify-between rounded-xl border border-line bg-panel2 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-brand">{profile.query}</div>
                        <div className="mt-1 text-xs text-muted">приоритет: {profile.priority}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={profile.mode}>{profile.mode}</Badge>
                        <Badge>{profile.isActive ? 'АКТИВЕН' : 'НЕАКТИВЕН'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted">Поисковых профилей пока нет.</div>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-4 text-base font-semibold text-brand">PRIORITY_COMMUNITIES</div>
              {priorityCommunities.length ? (
                <div className="space-y-3">
                  {priorityCommunities.map((community: any) => (
                    <div key={community.id} className="flex items-center justify-between rounded-xl border border-line bg-panel2 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-brand">
                          {community.title || community.screenName || community.vkCommunityId}
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          {community.url || community.screenName || community.vkCommunityId}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={community.mode}>{community.mode}</Badge>
                        <Badge>{community.isActive ? 'АКТИВЕН' : 'НЕАКТИВЕН'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted">Приоритетных сообществ пока нет.</div>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-4 text-base font-semibold text-brand">OWNED_COMMUNITY</div>
              {ownedCommunities.length ? (
                <div className="space-y-3">
                  {ownedCommunities.map((community: any) => (
                    <div key={community.id} className="flex items-center justify-between rounded-xl border border-line bg-panel2 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-brand">
                          {community.title || community.screenName || community.vkCommunityId}
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          {community.url || community.screenName || community.vkCommunityId}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={community.mode}>{community.mode}</Badge>
                        <Badge>{community.isActive ? 'АКТИВЕН' : 'НЕАКТИВЕН'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted">Собственное сообщество пока не настроено.</div>
              )}
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.1fr,1fr]">
              <Card className="p-5">
                <div className="mb-4 text-base font-semibold">Последние отслеживаемые посты VK</div>
                {posts.length ? (
                  <div className="space-y-3">
                    {posts.map((post: any) => (
                      <div key={post.id || `${post.ownerId}-${post.postId}`} className="rounded-xl border border-line bg-panel2 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {post.trackedCommunity?.mode ? <Badge tone={post.trackedCommunity.mode}>{post.trackedCommunity.mode}</Badge> : null}
                          {post.discoveryStatus ? <Badge>{post.discoveryStatus}</Badge> : null}
                        </div>
                        <div className="mt-3 text-sm leading-6 text-brand">{post.text || 'Нет текста'}</div>
                        <div className="mt-3 text-xs text-muted">
                          {post.url || 'Нет URL'} · {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted">Отслеживаемых постов VK пока нет.</div>
                )}
              </Card>

              <Card className="p-5">
                <div className="mb-4 text-base font-semibold">Последние упоминания и комментарии VK</div>
                {(overview?.recentMentions || []).length ? (
                  <div className="space-y-3">
                    {(overview.recentMentions || []).map((mention: any) => (
                      <MentionRow key={mention.id} mention={mention} />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted">Свежих упоминаний VK пока нет.</div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

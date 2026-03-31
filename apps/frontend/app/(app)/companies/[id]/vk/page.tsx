import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import MentionRow from '@/components/mentions/MentionRow'
import VkActions from '@/components/vk/VkActions'
import VkSetupForms from '@/components/vk/VkSetupForms'
import VkSearchProfiles from '@/components/vk/VkSearchProfiles'
import VkPostSearchPanel from '@/components/vk/VkPostSearchPanel'
import {
  getVkOverview,
  getVkSearchProfiles,
  getVkCommunities,
  getVkPosts,
  getVkCompanySearchProfile,
  getVkPostSearchRuns
} from '@/lib/api/vk'

function OverviewCards({ overview }: { overview: any }) {
  const items = [
    ['Выбранные сообщества', overview?.trackedCommunitiesCount ?? 0],
    ['Активные поисковые запросы', overview?.activeSearchProfilesCount ?? 0],
    ['Найденные посты VK', overview?.discoveredVkPostsCount ?? 0],
    ['Найденные упоминания VK', overview?.relevantVkMentionsCount ?? 0]
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

function communityLabel(mode: string) {
  if (mode === 'OWNED_COMMUNITY') return 'Собственное сообщество'
  if (mode === 'PRIORITY_COMMUNITY') return 'Выбранное сообщество'
  return mode
}

export default async function CompanyVkPage({ params }: { params: { id: string } }) {
  const [
    overviewRes,
    profilesRes,
    communitiesRes,
    postsRes,
    companySearchProfileRes,
    postSearchRunsRes
  ] = await Promise.allSettled([
    getVkOverview(params.id),
    getVkSearchProfiles(params.id),
    getVkCommunities(params.id),
    getVkPosts(params.id),
    getVkCompanySearchProfile(params.id),
    getVkPostSearchRuns(params.id)
  ])

  const overview: any =
    overviewRes.status === 'fulfilled'
      ? overviewRes.value
      : {
          trackedCommunitiesCount: 0,
          activeSearchProfilesCount: 0,
          discoveredVkPostsCount: 0,
          relevantVkMentionsCount: 0,
          recentPosts: [],
          recentMentions: []
        }

  const profiles: any[] = profilesRes.status === 'fulfilled' ? profilesRes.value : []
  const communities: any[] = communitiesRes.status === 'fulfilled' ? communitiesRes.value : []
  const posts: any[] = postsRes.status === 'fulfilled' ? postsRes.value : []
  const companySearchProfile: any =
    companySearchProfileRes.status === 'fulfilled'
      ? companySearchProfileRes.value
      : {
          includeKeywords: [],
          excludeKeywords: [],
          contextKeywords: [],
          geoKeywords: [],
          category: null
        }

  const postSearchRuns: any[] = postSearchRunsRes.status === 'fulfilled' ? postSearchRunsRes.value : []

  const priorityCommunities = communities.filter((c) => c.mode === 'PRIORITY_COMMUNITY')
  const ownedCommunities = communities.filter((c) => c.mode === 'OWNED_COMMUNITY')
  const mentions = overview?.recentMentions || []

  return (
    <div>
      <PageHeader
        title="Мониторинг VK"
        subtitle="Сверху показываются найденные посты и упоминания. Ниже — настройки поиска, Playwright-поиск постов и сообщества."
        actions={<VkActions companyId={params.id} />}
      />

      <div className="mt-6">
        <OverviewCards overview={overview} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
        <VkPostSearchPanel
          companyId={params.id}
          initialProfile={companySearchProfile}
          runs={postSearchRuns}
        />

        <Card className="p-5">
          <div className="text-base font-semibold text-brand">Важно</div>
          <div className="mt-2 text-sm text-muted">
            Playwright-поиск постов работает как основной механизм для нового модуля. Старый глобальный поиск через VK API
            остаётся рядом как отдельный режим и fallback.
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr,1fr]">
        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Найденные посты VK</div>
          {posts.length ? (
            <div className="space-y-3">
              {posts.map((post: any) => (
                <div key={post.id || `${post.ownerId}-${post.postId}`} className="rounded-xl border border-line bg-panel2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {post.trackedCommunity?.mode ? (
                      <Badge>{communityLabel(post.trackedCommunity.mode)}</Badge>
                    ) : null}
                    {post.discoveryStatus ? <Badge>{post.discoveryStatus}</Badge> : null}
                  </div>

                  <div className="mt-3 text-sm leading-6 text-brand">
                    {post.text || 'Нет текста'}
                  </div>

                  <div className="mt-3 text-xs text-muted">
                    {post.url || 'Нет URL'}
                    {post.publishedAt ? ` · ${new Date(post.publishedAt).toLocaleString()}` : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Постов пока нет"
              description="Здесь будут появляться найденные VK-посты после успешного прогона мониторинга."
            />
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Найденные комментарии и упоминания VK</div>
          {mentions.length ? (
            <div className="space-y-3">
              {mentions.map((mention: any) => (
                <MentionRow key={mention.id} mention={mention} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Комментариев и упоминаний пока нет"
              description="Здесь будут появляться найденные комментарии и релевантные упоминания VK."
            />
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card className="p-5">
          <div className="text-base font-semibold text-brand">Настройки VK-мониторинга</div>
          <div className="mt-1 text-sm text-muted">
            Это настройки поиска и источников. Они не являются найденными результатами.
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <VkSetupForms companyId={params.id} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <VkSearchProfiles companyId={params.id} profiles={profiles} />

        <Card className="p-5">
          <div className="mb-2 text-base font-semibold text-brand">Выбранные сообщества</div>
          <div className="mb-4 text-sm text-muted">
            Отдельный прогон по конкретным пабликам.
          </div>

          {priorityCommunities.length ? (
            <div className="space-y-3">
              {priorityCommunities.map((community: any) => (
                <div key={community.id} className="rounded-xl border border-line bg-panel2 px-4 py-3">
                  <div className="text-sm font-medium text-brand">
                    {community.title || community.screenName || community.vkCommunityId}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {community.url || community.screenName || community.vkCommunityId}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted">Выбранных сообществ пока нет.</div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-2 text-base font-semibold text-brand">Собственное сообщество</div>
          <div className="mb-4 text-sm text-muted">
            Прогон по собственному сообществу компании.
          </div>

          {ownedCommunities.length ? (
            <div className="space-y-3">
              {ownedCommunities.map((community: any) => (
                <div key={community.id} className="rounded-xl border border-line bg-panel2 px-4 py-3">
                  <div className="text-sm font-medium text-brand">
                    {community.title || community.screenName || community.vkCommunityId}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {community.url || community.screenName || community.vkCommunityId}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted">Собственное сообщество пока не настроено.</div>
          )}
        </Card>
      </div>
    </div>
  )
}

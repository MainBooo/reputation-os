export const dynamic = 'force-dynamic'

import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import MentionRow from '@/components/mentions/MentionRow'
import VkPostSearchPanel from '@/components/vk/VkPostSearchPanel'
import VkConnectionCard from '@/components/vk/VkConnectionCard'
import {
  getVkOverview,
  getVkPosts,
  getVkCompanySearchProfile,
  getVkPostSearchRuns,
  getVkSession
} from '@/lib/api/vk'

function OverviewCards({ overview }: { overview: any }) {
  const items = [
    ['Найденные посты VK', overview?.discoveredVkPostsCount ?? 0],
    ['Найденные комментарии VK', overview?.relevantVkMentionsCount ?? 0]
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2">
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
  const [overviewRes, postsRes, companySearchProfileRes, postSearchRunsRes, sessionRes] = await Promise.allSettled([
    getVkOverview(params.id),
    getVkPosts(params.id),
    getVkCompanySearchProfile(params.id),
    getVkPostSearchRuns(params.id),
    getVkSession(params.id)
  ])

  const overview: any =
    overviewRes.status === 'fulfilled'
      ? overviewRes.value
      : {
          discoveredVkPostsCount: 0,
          relevantVkMentionsCount: 0,
          recentMentions: []
        }

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

  const sessionError =
    sessionRes.status === 'rejected'
      ? sessionRes.reason instanceof Error
        ? sessionRes.reason.message
        : 'Не удалось получить состояние VK-сессии'
      : ''

  const session =
    sessionRes.status === 'fulfilled'
      ? sessionRes.value
      : null

  const mentions = Array.isArray(overview?.recentMentions) ? overview.recentMentions : []
  const showMentions = posts.length > 0 && mentions.length > 0

  return (
    <div>
      <PageHeader
        title="Мониторинг VK"
        subtitle="Здесь доступны подключение VK, запуск Playwright-поиска по названию компании и просмотр найденных комментариев."
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr,1fr]">
        <VkConnectionCard companyId={params.id} session={session} sessionError={sessionError} />
        <VkPostSearchPanel
          companyId={params.id}
          initialProfile={companySearchProfile}
          runs={postSearchRuns}
          sessionConnected={session?.connected === true}
        />
      </div>

      <div className="mt-6">
        <OverviewCards overview={overview} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr,1fr]">
        <Card className="p-5">
          <div className="mb-4 text-base font-semibold">Найденные посты VK</div>
          {posts.length ? (
            <div className="space-y-3">
              {posts.map((post: any) => (
                <div key={post.id || `${post.ownerId}-${post.postId}`} className="rounded-xl border border-line bg-panel2 p-4">
                  <div className="text-sm leading-6 text-brand">
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
          {showMentions ? (
            <div className="space-y-3">
              {mentions.map((mention: any) => (
                <MentionRow key={mention.id} mention={mention} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Подтверждённых комментариев пока нет"
              description="Комментарии будут показаны здесь после появления привязанных найденных VK-постов."
            />
          )}
        </Card>
      </div>
    </div>
  )
}

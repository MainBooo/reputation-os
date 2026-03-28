import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import MentionRow from '@/components/mentions/MentionRow'
import EmptyState from '@/components/ui/EmptyState'
import MentionCard from '@/components/inbox/MentionCard'
import { getCompanyMentions } from '@/lib/api/mentions'

export default async function CompanyInboxPage({ params }: { params: { id: string } }) {
  let response: any = { data: [], meta: { total: 0, page: 1, limit: 20 } }
  let authRequired = false

  try {
    response = await getCompanyMentions(params.id)
  } catch {
    authRequired = true
  }

  const mentions = response.data || []

  return (
    <div>
      <PageHeader
        title="Входящие"
        subtitle="Отзывы, упоминания, посты VK и комментарии VK в одной очереди."
      />

      <Card className="mb-6 p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Input placeholder="Площадка" />
          <Input placeholder="Тональность" />
          <Input placeholder="Статус" />
          <Input placeholder="Тип" />
          <Input placeholder="Дата от" />
          <Input placeholder="Дата до" />
        </div>
      </Card>

      {authRequired ? (
        <EmptyState
          title="Требуется авторизация"
          description="Войдите в систему, чтобы загрузить живые упоминания из API."
        />
      ) : !mentions.length ? (
        <EmptyState
          title="Inbox пока пуст"
          description="Для этой компании пока не найдено упоминаний."
        />
      ) : (
        <div className="space-y-3">
          {mentions.map((mention: any) => <MentionRow key={mention.id} mention={mention} />)}
        </div>
      )}

      <div className="mt-6 text-sm text-muted">
        Страница {response.meta?.page || 1} · Всего {response.meta?.total || 0}
      </div>
    </div>
  )
}

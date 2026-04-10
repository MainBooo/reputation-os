import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import EmptyState from '@/components/ui/EmptyState'
import InboxMentionsList from '@/components/inbox/InboxMentionsList'
import { getCompanyMentions } from '@/lib/api/mentions'

export default async function CompanyInboxPage({ params }: { params: { id: string } }) {
  let response: any = { data: [], meta: { total: 0, page: 1, limit: 20 } }
  let authRequired = false

  try {
    response = await getCompanyMentions(params.id)
  } catch {
    authRequired = true
  }

  const mentions = Array.isArray(response?.data) ? response.data : []
  const total = Number(response?.meta?.total || 0)

  return (
    <div>
      <PageHeader
        title="Входящие"
        subtitle="Отзывы, упоминания, посты VK и комментарии VK в одной очереди."
      />

      <Card className="mb-6 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
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
      ) : (
        <InboxMentionsList
          companyId={params.id}
          initialMentions={mentions}
          total={total}
        />
      )}

      <div className="mt-6 text-sm text-muted">
        Страница {response.meta?.page || 1} · Всего {response.meta?.total || 0}
      </div>
    </div>
  )
}

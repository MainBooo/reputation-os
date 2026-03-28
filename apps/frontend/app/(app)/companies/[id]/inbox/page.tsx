import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import MentionRow from '@/components/mentions/MentionRow'
import EmptyState from '@/components/ui/EmptyState'
import { getCompanyMentions } from '@/lib/api/mentions'

export default async function CompanyInboxPage({ params }: { params: { id: string } }) {
  const response: any = await getCompanyMentions(params.id)
  const mentions = response.data || []

  return (
    <div>
      <PageHeader
        title="Inbox"
        subtitle="Filter reviews, mentions, VK posts and VK comments in one queue."
      />

      <Card className="mb-6 p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Input placeholder="Platform" />
          <Input placeholder="Sentiment" />
          <Input placeholder="Status" />
          <Input placeholder="Type" />
          <Input placeholder="From date" />
          <Input placeholder="To date" />
        </div>
      </Card>

      {!mentions.length ? (
        <EmptyState
          title="Inbox is empty"
          description="Seed/demo mode will populate mentions, reviews and VK content after startup."
        />
      ) : (
        <div className="space-y-3">
          {mentions.map((mention: any) => <MentionRow key={mention.id} mention={mention} />)}
        </div>
      )}

      <div className="mt-6 text-sm text-muted">
        Page {response.meta?.page || 1} · Total {response.meta?.total || 0}
      </div>
    </div>
  )
}

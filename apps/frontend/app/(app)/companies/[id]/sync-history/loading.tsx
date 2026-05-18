import Card from '@/components/ui/Card'

export default function LoadingSyncHistory() {
  return (
    <div className="space-y-4 pb-28">
      <Card className="h-24 animate-pulse bg-white/[0.04]">
        <div />
      </Card>
      <Card className="h-64 animate-pulse bg-white/[0.04]">
        <div />
      </Card>
    </div>
  )
}
